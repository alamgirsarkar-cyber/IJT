import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

const PATH = "/api/v1/internal-transfers/webhooks/stage-completion";
const WORK = ["ORG_DATA_UPDATE", "PAYROLL_UPDATE", "IT_ACCESS", "FACILITIES"] as const;

type Row = Record<string, unknown>;

export type WebhookKeys = Record<string, string>;

function digest(raw: Buffer): string {
  return createHash("sha256").update(raw).digest("hex");
}

export function sign(secret: string, keyId: string, timestamp: string, raw: Buffer): string {
  const material = [keyId, timestamp, "POST", PATH, digest(raw)].join("\n");
  return `sha256=${createHmac("sha256", secret).update(material).digest("hex")}`;
}

export function signatureValid(keys: WebhookKeys, keyId: string, timestamp: string, raw: Buffer, signature: string, now = Date.now()): boolean {
  const secret = keys[keyId];
  if (!secret || !signature.startsWith("sha256=")) return false;
  const sentAt = Date.parse(timestamp);
  if (!Number.isFinite(sentAt) || Math.abs(now - sentAt) > 300_000) return false;
  const expected = Buffer.from(sign(secret, keyId, timestamp, raw));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length) return false;
  return timingSafeEqual(expected, actual);
}

export function signalOrgUpdate(db: DatabaseSync, requestId: string): "signalled" | "ignored" {
  const stage = db
    .prepare("SELECT status FROM transfer_request_stage WHERE transfer_request_id = ? AND stage_code = 'ORG_DATA_UPDATE'")
    .get(requestId) as { status: string } | undefined;
  if (!stage || stage.status !== "IN_PROGRESS") return "ignored";
  const existing = db
    .prepare("SELECT 1 AS hit FROM transfer_request_outbox WHERE aggregate_id = ? AND event_type = 'employee.transfer.fulfilment-stage.v1'")
    .get(requestId) as { hit: number } | undefined;
  if (existing) return "signalled";
  if (process.env.FULFILMENT_OUTBOX_FAIL === "1") return "ignored";
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
     VALUES (?,?,?,?,?,0)`,
  ).run(randomUUID(), requestId, "employee.transfer.fulfilment-stage.v1", JSON.stringify({
    eventType: "employee.transfer.fulfilment-stage.v1",
    payload: { requestId, stageCode: "ORG_DATA_UPDATE" },
  }), now);
  return "signalled";
}

export type Report = {
  eventId: string;
  requestId: string;
  stageCode: string;
  reportType: "FULFILMENT" | "COMPENSATION";
  outcome: "SUCCESS" | "FAILED";
  failureCode?: string;
  intakeOnly?: boolean;
  expectedVersion?: number;
};

export function applyReport(db: DatabaseSync, report: Report, actor: string): { status: number; body: Record<string, unknown> } {
  if (report.failureCode && !/^[A-Z0-9_]{1,64}$/.test(report.failureCode)) {
    return { status: 422, body: { type: "validation-failed" } };
  }
  if (report.intakeOnly) return { status: 422, body: { type: "validation-failed", detail: "business-operation-required" } };
  const seen = db.prepare("SELECT body_hash FROM webhook_event WHERE event_id = ?").get(report.eventId) as { body_hash: string } | undefined;
  const hash = JSON.stringify({ ...report, intakeOnly: undefined, expectedVersion: undefined });
  if (seen && seen.body_hash === hash) return { status: 200, body: { replayed: true } };
  if (seen) return { status: 409, body: { type: "idempotency-key-conflict" } };
  const request = db.prepare("SELECT * FROM transfer_request WHERE id = ?").get(report.requestId) as Row | undefined;
  if (!request || request.status !== "FULFILMENT") {
    return { status: 409, body: { type: "invalid-state-transition", currentStatus: request?.status } };
  }
  const stage = db
    .prepare("SELECT * FROM transfer_request_stage WHERE transfer_request_id = ? AND stage_code = ?")
    .get(report.requestId, report.stageCode) as Row | undefined;
  if (!stage) return { status: 422, body: { type: "validation-failed" } };
  const now = new Date().toISOString();
  const version = report.expectedVersion ?? Number(request.version);
  db.exec("BEGIN IMMEDIATE");
  const locked = db.prepare("SELECT version, status FROM transfer_request WHERE id = ?").get(report.requestId) as { version: number; status: string };
  if (locked.version !== version) {
    db.exec("ROLLBACK");
    return { status: 409, body: { type: "version-conflict", currentVersion: locked.version } };
  }
  if (report.reportType === "FULFILMENT") {
    if (stage.status !== "IN_PROGRESS") {
      db.exec("ROLLBACK");
      return { status: 409, body: { type: "invalid-state-transition", currentStageStatus: stage.status } };
    }
    if (report.outcome === "SUCCESS") completeSuccess(db, report, now);
    else failStage(db, report, now);
  } else {
    if (stage.status !== "COMPENSATION_REQUESTED") {
      db.exec("ROLLBACK");
      return { status: 409, body: { type: "invalid-state-transition", currentStageStatus: stage.status } };
    }
    db.prepare("UPDATE transfer_request_stage SET status = ? WHERE transfer_request_id = ? AND stage_code = ?").run(
      report.outcome === "SUCCESS" ? "COMPENSATED" : "COMPENSATION_FAILED",
      report.requestId,
      report.stageCode,
    );
  }
  db.prepare("UPDATE transfer_request SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?").run(now, report.requestId, version);
  db.prepare(
    `INSERT INTO transfer_request_audit (id, transfer_request_id, actor_employee_id, actor_role, event_type, from_status, to_status, occurred_at, correlation_id, metadata)
     VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
  ).run(randomUUID(), report.requestId, actor, "SYSTEM", "STAGE_REPORTED", stage.status, report.outcome, now, randomUUID());
  db.prepare("INSERT INTO webhook_event (event_id, body_hash, request_id) VALUES (?,?,?)").run(report.eventId, hash, report.requestId);
  db.exec("COMMIT");
  return { status: 200, body: { accepted: true } };
}

function completeSuccess(db: DatabaseSync, report: Report, now: string) {
  db.prepare("UPDATE transfer_request_stage SET status = 'COMPLETED', completed_at = ? WHERE transfer_request_id = ? AND stage_code = ?").run(now, report.requestId, report.stageCode);
  const stages = db.prepare("SELECT stage_code, sequence_no, applicable, status FROM transfer_request_stage WHERE transfer_request_id = ? ORDER BY sequence_no").all(report.requestId) as Array<{ stage_code: string; sequence_no: number; applicable: number; status: string }>;
  const next = stages.find((stage) => WORK.includes(stage.stage_code as (typeof WORK)[number]) && stage.applicable === 1 && stage.status === "NOT_STARTED");
  if (next) {
    db.prepare("UPDATE transfer_request_stage SET status = 'IN_PROGRESS', started_at = ? WHERE transfer_request_id = ? AND stage_code = ?").run(now, report.requestId, next.stage_code);
    db.prepare("INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts) VALUES (?,?,?,?,?,0)").run(
      randomUUID(), report.requestId, "employee.transfer.fulfilment-stage.v1",
      JSON.stringify({ eventType: "employee.transfer.fulfilment-stage.v1", payload: { requestId: report.requestId, stageCode: next.stage_code } }),
      now,
    );
    return;
  }
  db.prepare("UPDATE transfer_request_stage SET status = 'COMPLETED', completed_at = ? WHERE transfer_request_id = ? AND stage_code = 'EMPLOYEE_CONFIRMATION'").run(now, report.requestId);
  db.prepare("UPDATE transfer_request SET status = 'COMPLETED' WHERE id = ?").run(report.requestId);
  db.prepare("INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts) VALUES (?,?,?,?,?,0)").run(
    randomUUID(), report.requestId, "employee.transfer.completed.v1",
    JSON.stringify({ eventType: "employee.transfer.completed.v1", payload: { requestId: report.requestId } }),
    now,
  );
}

function failStage(db: DatabaseSync, report: Report, now: string) {
  db.prepare("UPDATE transfer_request_stage SET status = 'FAILED', completed_at = ? WHERE transfer_request_id = ? AND stage_code = ?").run(now, report.requestId, report.stageCode);
  const stages = db.prepare("SELECT stage_code, sequence_no, status, applicable FROM transfer_request_stage WHERE transfer_request_id = ? ORDER BY sequence_no DESC").all(report.requestId) as Array<{ stage_code: string; sequence_no: number; status: string; applicable: number }>;
  const failedSeq = stages.find((stage) => stage.stage_code === report.stageCode)?.sequence_no ?? 0;
  db.prepare("INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts) VALUES (?,?,?,?,?,0)").run(
    randomUUID(), report.requestId, "employee.transfer.fulfilment-failed.v1",
    JSON.stringify({ eventType: "employee.transfer.fulfilment-failed.v1", payload: { requestId: report.requestId, stageCode: report.stageCode, failureCode: report.failureCode ?? null } }),
    now,
  );
  for (const stage of stages) {
    if (!WORK.includes(stage.stage_code as (typeof WORK)[number])) continue;
    if (stage.status === "COMPLETED" && stage.sequence_no < failedSeq) {
      db.prepare("UPDATE transfer_request_stage SET status = 'COMPENSATION_REQUESTED' WHERE transfer_request_id = ? AND stage_code = ?").run(report.requestId, stage.stage_code);
      db.prepare("INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts) VALUES (?,?,?,?,?,0)").run(
        randomUUID(), report.requestId, "employee.transfer.compensate.v1",
        JSON.stringify({ eventType: "employee.transfer.compensate.v1", payload: { requestId: report.requestId, stageCode: stage.stage_code } }),
        now,
      );
    }
    if (stage.status === "NOT_STARTED" && stage.sequence_no > failedSeq) {
      db.prepare("UPDATE transfer_request_stage SET status = 'CANCELLED' WHERE transfer_request_id = ? AND stage_code = ?").run(report.requestId, stage.stage_code);
    }
  }
}
