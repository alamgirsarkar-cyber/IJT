import { createHash, randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";
import type { Express, Request, Response } from "express";
import { allowListPayload } from "../../outbox/relay.ts";

type Row = Record<string, unknown>;
const SALT = "approval-rate";
const limits = new Map<string, { count: number; reset: number }>();

function problem(res: Response, status: number, type: string, extra: Record<string, unknown> = {}) {
  res.status(status).type("application/problem+json").json({ type, title: type, status, ...extra });
}

function principal(req: Request): { id: string; hr: boolean } | undefined {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) return undefined;
  const token = header.slice("Bearer ".length).trim();
  if (!token || token === "invalid") return undefined;
  const [id, role] = token.split("|");
  if (!id) return undefined;
  return { id, hr: role === "HR_BUSINESS_PARTNER" };
}

function limited(res: Response, id: string, bucket: string, max: number): boolean {
  const key = createHash("sha256").update(`${SALT}:${bucket}:${id}`).digest("hex");
  const now = Date.now();
  const current = limits.get(key);
  if (!current || current.reset < now) {
    limits.set(key, { count: 1, reset: now + 3_600_000 });
    return false;
  }
  current.count += 1;
  if (current.count > max) {
    res.set("Retry-After", "3600");
    problem(res, 429, "rate-limited");
    return true;
  }
  return false;
}

export function registerApproval(app: Express, db: DatabaseSync): void {
  app.get("/api/v1/internal-transfers/approvals", (req, res) => {
    const caller = principal(req);
    if (!caller) return problem(res, 401, "unauthenticated");
    if (limited(res, caller.id, "inbox", 300)) return;
    const size = Number(req.query.size ?? 10);
    if (![10, 25, 50].includes(size)) return problem(res, 400, "validation-failed");
    const page = Math.max(1, Number(req.query.page ?? 1));
    const rows = visibleStages(db, caller);
    const slice = rows.slice((page - 1) * size, page * size);
    res.json({
      items: slice.map(inboxItem),
      page,
      size,
      totalItems: rows.length,
      totalPages: Math.max(1, Math.ceil(rows.length / size)),
    });
  });

  app.get("/api/v1/internal-transfers/:requestId/approval", (req, res) => {
    const caller = principal(req);
    if (!caller) return problem(res, 401, "unauthenticated");
    if (limited(res, caller.id, "detail", 300)) return;
    const request = load(db, req.params.requestId);
    if (!request || !canSee(db, request, caller)) return problem(res, 404, "request-not-found");
    res.json(detail(db, request, caller));
  });

  app.post("/api/v1/internal-transfers/:requestId/stages/:stageCode/decision", (req, res) => {
    const caller = principal(req);
    if (!caller) return problem(res, 401, "unauthenticated");
    if (limited(res, caller.id, "decision", 30)) return;
    const key = req.header("idempotency-key");
    if (!key) return problem(res, 400, "idempotency-key-required");
    const stored = db.prepare("SELECT * FROM idempotency_record WHERE idempotency_key = ?").get(key) as Row | undefined;
    const fingerprint = `${req.params.requestId}:${req.params.stageCode}:${JSON.stringify(req.body ?? {})}`;
    if (stored && stored.body_hash !== fingerprint) return problem(res, 409, "idempotency-key-conflict");
    if (stored) return res.status(stored.response_status as number).json(JSON.parse(String(stored.response_body)));
    const match = req.header("if-match");
    if (!match) return problem(res, 400, "precondition-required");
    const request = load(db, req.params.requestId);
    if (!request) return problem(res, 404, "request-not-found");
    const stageCode = req.params.stageCode;
    if (!["MANAGER_RELEASE", "MANAGER_ACCEPT", "HR_VALIDATION"].includes(stageCode)) {
      return problem(res, 422, "validation-failed", { violations: [{ field: "stageCode" }] });
    }
    const decision = req.body?.decision;
    if (decision !== "APPROVE" && decision !== "REJECT") {
      return problem(res, 422, "validation-failed", { violations: [{ field: "decision" }] });
    }
    const confirmed = req.body?.confirmedEffectiveDate ?? null;
    if (decision === "APPROVE" && stageCode === "HR_VALIDATION" && !confirmed) {
      return problem(res, 422, "validation-failed", { violations: [{ field: "confirmedEffectiveDate" }] });
    }
    if ((stageCode !== "HR_VALIDATION" || decision === "REJECT") && confirmed) {
      return problem(res, 422, "validation-failed", { violations: [{ field: "confirmedEffectiveDate" }] });
    }
    if (confirmed && !/^\d{4}-\d{2}-\d{2}$/.test(String(confirmed))) {
      return problem(res, 422, "validation-failed", { violations: [{ field: "confirmedEffectiveDate" }] });
    }
    if (!["MANAGER_REVIEW", "HR_VALIDATION"].includes(String(request.status))) {
      return problem(res, 409, "invalid-state-transition", { currentStatus: request.status });
    }
    const stage = stageRow(db, String(request.id), stageCode);
    if (!stage || stage.status !== "IN_PROGRESS") {
      return problem(res, 409, "invalid-state-transition", { currentStageCode: stageCode });
    }
    if (stageCode !== "HR_VALIDATION" && !stage.assigned_party_ref) {
      return problem(res, 409, "assignee-unresolved");
    }
    if (!mayDecide(stage, caller)) return problem(res, 404, "request-not-found");
    const expected = match.replaceAll('"', "");
    if (expected !== String(request.version)) {
      return problem(res, 409, "version-conflict", { currentVersion: request.version });
    }
    const now = new Date().toISOString();
    db.exec("BEGIN IMMEDIATE");
    const locked = load(db, String(request.id));
    if (!locked || !["MANAGER_REVIEW", "HR_VALIDATION"].includes(String(locked.status))) {
      db.exec("ROLLBACK");
      return problem(res, 409, "invalid-state-transition", { currentStatus: locked?.status });
    }
    if (decision === "REJECT") {
      db.prepare(
        `UPDATE transfer_request SET status = 'REJECTED', version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(now, request.id, request.version);
      db.prepare(
        `UPDATE transfer_request_stage SET status = 'COMPLETED', completed_at = ?
         WHERE transfer_request_id = ? AND stage_code = ?`,
      ).run(now, request.id, stageCode);
      db.prepare(
        `UPDATE transfer_request_stage SET status = 'CANCELLED', completed_at = ?
         WHERE transfer_request_id = ? AND status NOT IN ('COMPLETED','CANCELLED')`,
      ).run(now, request.id);
      writeAudit(db, request, caller.id, "REJECTED", String(request.status), "REJECTED", now);
      writeEvent(db, request, "employee.transfer.rejected.v1", allowListPayload({
        requestId: request.id,
        referenceNo: request.reference_no,
        employeeId: request.employee_id,
        correlationId: randomUUID(),
      }), now);
    } else if (stageCode === "MANAGER_RELEASE") {
      advance(db, request, caller.id, "MANAGER_REVIEW", "MANAGER_ACCEPT", now);
      writeEvent(db, request, "employee.transfer.stage-pending.v1", allowListPayload({
        requestId: request.id,
        referenceNo: request.reference_no,
        employeeId: request.employee_id,
        applicableStageCodes: ["MANAGER_ACCEPT"],
        correlationId: randomUUID(),
      }), now);
    } else if (stageCode === "MANAGER_ACCEPT") {
      db.prepare(
        `UPDATE transfer_request SET status = 'HR_VALIDATION', version = version + 1, updated_at = ?
         WHERE id = ? AND version = ?`,
      ).run(now, request.id, request.version);
      completeAndStart(db, String(request.id), "MANAGER_ACCEPT", "HR_VALIDATION", now);
      writeAudit(db, request, caller.id, "STAGE_APPROVED", "MANAGER_REVIEW", "HR_VALIDATION", now);
      writeEvent(db, request, "employee.transfer.stage-pending.v1", allowListPayload({
        requestId: request.id,
        referenceNo: request.reference_no,
        employeeId: request.employee_id,
        applicableStageCodes: ["HR_VALIDATION"],
        correlationId: randomUUID(),
      }), now);
    } else {
      db.prepare(
        `UPDATE transfer_request SET status = 'FULFILMENT', confirmed_effective_date = ?,
          version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
      ).run(confirmed, now, request.id, request.version);
      db.prepare(
        `UPDATE transfer_request_stage SET status = 'COMPLETED', completed_at = ?
         WHERE transfer_request_id = ? AND stage_code = 'HR_VALIDATION'`,
      ).run(now, request.id);
      db.prepare(
        `UPDATE transfer_request_stage SET status = 'IN_PROGRESS', started_at = ?
         WHERE transfer_request_id = ? AND stage_code = 'ORG_DATA_UPDATE'`,
      ).run(now, request.id);
      writeAudit(db, request, caller.id, "APPROVED", "HR_VALIDATION", "FULFILMENT", now);
      writeEvent(db, request, "employee.transfer.approved.v1", allowListPayload({
        requestId: request.id,
        referenceNo: request.reference_no,
        employeeId: request.employee_id,
        requestedEffectiveDate: confirmed,
        correlationId: randomUUID(),
      }), now);
    }
    const updated = load(db, String(request.id));
    const body = detail(db, updated as Row, caller);
    db.prepare(
      `INSERT INTO idempotency_record (idempotency_key, request_id, body_hash, response_status, response_body, created_at)
       VALUES (?,?,?,?,?,?)`,
    ).run(key, request.id, fingerprint, 200, JSON.stringify(body), now);
    db.exec("COMMIT");
    res.json(body);
  });
}

function visibleStages(db: DatabaseSync, caller: { id: string; hr: boolean }): Row[] {
  return db
    .prepare(
      `SELECT s.*, r.reference_no, r.status AS request_status, r.requested_effective_date, r.current_position_title
       FROM transfer_request_stage s
       JOIN transfer_request r ON r.id = s.transfer_request_id
       WHERE s.status = 'IN_PROGRESS'
         AND (
           s.assigned_party_ref = ?
           OR (? = 1 AND s.stage_code = 'HR_VALIDATION')
         )
       ORDER BY s.started_at ASC`,
    )
    .all(caller.id, caller.hr ? 1 : 0) as Row[];
}

function inboxItem(row: Row) {
  return {
    requestId: row.transfer_request_id,
    referenceNo: row.reference_no,
    stageCode: row.stage_code,
    assignedRole: row.assigned_role,
    requestStatus: row.request_status,
    targetPositionTitle: row.current_position_title,
    requestedEffectiveDate: row.requested_effective_date,
    waitingSince: row.started_at,
  };
}

function load(db: DatabaseSync, id: string): Row | undefined {
  return db.prepare("SELECT * FROM transfer_request WHERE id = ?").get(id) as Row | undefined;
}

function stageRow(db: DatabaseSync, requestId: string, code: string): Row | undefined {
  return db
    .prepare("SELECT * FROM transfer_request_stage WHERE transfer_request_id = ? AND stage_code = ?")
    .get(requestId, code) as Row | undefined;
}

function canSee(db: DatabaseSync, request: Row, caller: { id: string; hr: boolean }): boolean {
  if (caller.hr) return true;
  const hit = db
    .prepare(
      `SELECT 1 AS hit FROM transfer_request_stage
       WHERE transfer_request_id = ? AND assigned_party_ref = ?`,
    )
    .get(request.id, caller.id) as { hit: number } | undefined;
  return Boolean(hit);
}

function mayDecide(stage: Row, caller: { id: string; hr: boolean }): boolean {
  if (stage.stage_code === "HR_VALIDATION") return caller.hr;
  return stage.assigned_party_ref === caller.id;
}

function detail(db: DatabaseSync, request: Row | undefined, caller: { id: string; hr: boolean }) {
  if (!request) return {};
  const stages = db
    .prepare("SELECT * FROM transfer_request_stage WHERE transfer_request_id = ? ORDER BY sequence_no")
    .all(request.id) as Row[];
  const body: Record<string, unknown> = {
    requestId: request.id,
    referenceNo: request.reference_no,
    status: request.status,
    version: request.version,
    confirmedEffectiveDate: request.confirmed_effective_date,
    stages: stages.map((stage) => ({
      stageCode: stage.stage_code,
      status: stage.status,
      assignedRole: stage.assigned_role,
    })),
  };
  if (caller.hr && request.reason_ciphertext) {
    body.reason = Buffer.from(request.reason_ciphertext as Uint8Array).toString();
  }
  return body;
}

function advance(db: DatabaseSync, request: Row, actor: string, from: string, next: string, now: string) {
  db.prepare(
    `UPDATE transfer_request SET version = version + 1, updated_at = ? WHERE id = ? AND version = ?`,
  ).run(now, request.id, request.version);
  completeAndStart(db, String(request.id), "MANAGER_RELEASE", next, now);
  writeAudit(db, request, actor, "STAGE_APPROVED", from, from, now);
}

function completeAndStart(db: DatabaseSync, requestId: string, done: string, next: string, now: string) {
  db.prepare(
    `UPDATE transfer_request_stage SET status = 'COMPLETED', completed_at = ?
     WHERE transfer_request_id = ? AND stage_code = ?`,
  ).run(now, requestId, done);
  db.prepare(
    `UPDATE transfer_request_stage SET status = 'IN_PROGRESS', started_at = ?
     WHERE transfer_request_id = ? AND stage_code = ?`,
  ).run(now, requestId, next);
}

function writeAudit(db: DatabaseSync, request: Row, actor: string, eventType: string, from: string, to: string, now: string) {
  db.prepare(
    `INSERT INTO transfer_request_audit (
      id, transfer_request_id, actor_employee_id, actor_role, event_type,
      from_status, to_status, occurred_at, correlation_id, metadata
    ) VALUES (?,?,?,?,?,?,?,?,?,NULL)`,
  ).run(randomUUID(), request.id, actor, "APPROVER", eventType, from, to, now, randomUUID());
}

function writeEvent(db: DatabaseSync, request: Row, eventType: string, payload: Record<string, unknown>, now: string) {
  db.prepare(
    `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
     VALUES (?,?,?,?,?,0)`,
  ).run(randomUUID(), request.id, eventType, JSON.stringify({ eventType, payload }), now);
}
