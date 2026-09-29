import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import test from "node:test";
import request from "supertest";
import { createApp, openDatabase } from "../api/app.ts";
import type { HrisContract } from "../integration/hris/client.ts";
import { applyReport, sign, signalOrgUpdate } from "./domain/orchestrate.ts";

const hris: HrisContract = {
  async referenceData() { throw new Error("unused"); },
  async employment() { throw new Error("unused"); },
};

const secret = "test-source-secret";
const keys = { "hris-current": secret };

function database() {
  return openDatabase(join(mkdtempSync(join(tmpdir(), "ful-")), "app.sqlite"));
}

function seed(db: ReturnType<typeof database>, orgStatus = "IN_PROGRESS") {
  const id = randomUUID();
  const now = "2026-09-24T00:00:00Z";
  db.prepare(
    `INSERT INTO transfer_request (id, reference_no, employee_id, status, version, created_at, updated_at)
     VALUES (?, 'ITR-2026-000001', 'emp-1', 'FULFILMENT', 4, ?, ?)`,
  ).run(id, now, now);
  const stages = [
    ["ORG_DATA_UPDATE", 4, orgStatus, 1],
    ["PAYROLL_UPDATE", 5, "NOT_STARTED", 1],
    ["IT_ACCESS", 6, "NOT_STARTED", 0],
    ["FACILITIES", 7, "NOT_STARTED", 1],
    ["EMPLOYEE_CONFIRMATION", 8, "NOT_STARTED", 1],
  ] as const;
  for (const [code, sequence, status, applicable] of stages) {
    db.prepare(
      `INSERT INTO transfer_request_stage (id, transfer_request_id, stage_code, sequence_no, status, assigned_role, applicable)
       VALUES (?,?,?,?,?,'HR_OPERATIONS',?)`,
    ).run(randomUUID(), id, code, sequence, status, applicable);
  }
  return id;
}

function post(app: ReturnType<typeof createApp>, body: unknown, options?: { keyId?: string; timestamp?: string; signature?: string; bearer?: boolean }) {
  const raw = JSON.stringify(body);
  const timestamp = options?.timestamp ?? new Date().toISOString();
  const keyId = options?.keyId ?? "hris-current";
  const signature = options?.signature ?? sign(secret, keyId, timestamp, Buffer.from(raw));
  const call = request(app)
    .post("/api/v1/internal-transfers/webhooks/stage-completion")
    .set("Content-Type", "application/json")
    .set("X-Portal-Webhook-Key-Id", keyId)
    .set("X-Portal-Webhook-Timestamp", timestamp)
    .set("X-Portal-Webhook-Signature", signature);
  if (options?.bearer) call.set("Authorization", "Bearer emp-1");
  return call.send(raw);
}

test("UT15 bearer token without HMAC is 401", async () => {
  const db = database();
  const app = createApp(db, hris, keys);
  const response = await request(app)
    .post("/api/v1/internal-transfers/webhooks/stage-completion")
    .set("Authorization", "Bearer emp-1")
    .send({ eventId: "e1" });
  assert.equal(response.status, 401);
});

test("UT11 bad signature is 401", async () => {
  const app = createApp(database(), hris, keys);
  const response = await post(app, { eventId: "e1", requestId: "r", stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT", outcome: "SUCCESS" }, { signature: "sha256=00" });
  assert.equal(response.status, 401);
});

test("UT23 stale timestamp is 401", async () => {
  const app = createApp(database(), hris, keys);
  const response = await post(app, { eventId: "e1" }, { timestamp: "2020-01-01T00:00:00Z" });
  assert.equal(response.status, 401);
});

test("UT24 retired key id is 401", async () => {
  const app = createApp(database(), hris, keys);
  const response = await post(app, { eventId: "e1" }, { keyId: "retired" });
  assert.equal(response.status, 401);
  assert.equal(JSON.stringify(response.body).includes("hris-current"), false);
});

test("UT01 signal writes fulfilment-stage without changing status", () => {
  const db = database();
  const id = seed(db);
  assert.equal(signalOrgUpdate(db, id), "signalled");
  const stage = db.prepare("SELECT status FROM transfer_request_stage WHERE stage_code = 'ORG_DATA_UPDATE'").get() as { status: string };
  const rows = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_outbox").get() as { n: number };
  assert.equal(stage.status, "IN_PROGRESS");
  assert.equal(rows.n, 1);
});

test("UT01b does nothing while org update is not started", () => {
  const db = database();
  const id = seed(db, "NOT_STARTED");
  assert.equal(signalOrgUpdate(db, id), "ignored");
  const rows = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_outbox").get() as { n: number };
  assert.equal(rows.n, 0);
});

test("UT03 success starts the next applicable stage", () => {
  const db = database();
  const id = seed(db);
  const result = applyReport(db, { eventId: "s1", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT", outcome: "SUCCESS" }, "hris-current");
  assert.equal(result.status, 200);
  const payroll = db.prepare("SELECT status FROM transfer_request_stage WHERE stage_code = 'PAYROLL_UPDATE'").get() as { status: string };
  const it = db.prepare("SELECT status FROM transfer_request_stage WHERE stage_code = 'IT_ACCESS'").get() as { status: string };
  assert.equal(payroll.status, "IN_PROGRESS");
  assert.equal(it.status, "NOT_STARTED");
});

test("UT27 report before the stage is current is 409", () => {
  const db = database();
  const id = seed(db);
  const result = applyReport(db, { eventId: "s2", requestId: id, stageCode: "PAYROLL_UPDATE", reportType: "FULFILMENT", outcome: "SUCCESS" }, "hris-current");
  assert.equal(result.status, 409);
});

test("UT17 org failure emits no compensate event", () => {
  const db = database();
  const id = seed(db);
  applyReport(db, { eventId: "f1", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT", outcome: "FAILED", failureCode: "HRIS_REJECTED" }, "hris-current");
  const compensate = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_outbox WHERE event_type = 'employee.transfer.compensate.v1'").get() as { n: number };
  const request = db.prepare("SELECT status FROM transfer_request WHERE id = ?").get(id) as { status: string };
  assert.equal(compensate.n, 0);
  assert.equal(request.status, "FULFILMENT");
});

test("UT32 compensate rows are created high sequence first", () => {
  const db = database();
  const id = seed(db);
  db.prepare("UPDATE transfer_request_stage SET status = 'COMPLETED' WHERE stage_code IN ('ORG_DATA_UPDATE','PAYROLL_UPDATE')").run();
  db.prepare("UPDATE transfer_request_stage SET status = 'IN_PROGRESS' WHERE stage_code = 'FACILITIES'").run();
  applyReport(db, { eventId: "f2", requestId: id, stageCode: "FACILITIES", reportType: "FULFILMENT", outcome: "FAILED", failureCode: "SITE_CLOSED" }, "hris-current");
  const rows = db.prepare("SELECT payload FROM transfer_request_outbox WHERE event_type = 'employee.transfer.compensate.v1' ORDER BY created_at, rowid").all() as Array<{ payload: string }>;
  const codes = rows.map((row) => (JSON.parse(row.payload) as { payload: { stageCode: string } }).payload.stageCode);
  assert.deepEqual(codes, ["PAYROLL_UPDATE", "ORG_DATA_UPDATE"]);
});

test("UT33 ticket intake is not success", () => {
  const db = database();
  const id = seed(db);
  const result = applyReport(db, { eventId: "s3", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT", outcome: "SUCCESS", intakeOnly: true }, "hris-current");
  assert.equal(result.status, 422);
});

test("UT18 compensation success", () => {
  const db = database();
  const id = seed(db);
  db.prepare("UPDATE transfer_request_stage SET status = 'COMPENSATION_REQUESTED' WHERE stage_code = 'ORG_DATA_UPDATE'").run();
  const result = applyReport(db, { eventId: "c1", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "COMPENSATION", outcome: "SUCCESS" }, "hris-current");
  assert.equal(result.status, 200);
  const stage = db.prepare("SELECT status FROM transfer_request_stage WHERE stage_code = 'ORG_DATA_UPDATE'").get() as { status: string };
  assert.equal(stage.status, "COMPENSATED");
});

test("UT08 replay does not increment version", () => {
  const db = database();
  const id = seed(db);
  const report = { eventId: "same", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT" as const, outcome: "SUCCESS" as const };
  applyReport(db, report, "hris-current");
  const before = db.prepare("SELECT version FROM transfer_request WHERE id = ?").get(id) as { version: number };
  const replay = applyReport(db, report, "hris-current");
  const after = db.prepare("SELECT version FROM transfer_request WHERE id = ?").get(id) as { version: number };
  assert.equal(replay.status, 200);
  assert.equal(after.version, before.version);
});

test("UT31 lost version race is 409", () => {
  const db = database();
  const id = seed(db);
  const result = applyReport(db, { eventId: "race", requestId: id, stageCode: "ORG_DATA_UPDATE", reportType: "FULFILMENT", outcome: "SUCCESS", expectedVersion: 3 }, "hris-current");
  assert.equal(result.status, 409);
  assert.equal(result.body.type, "version-conflict");
});
