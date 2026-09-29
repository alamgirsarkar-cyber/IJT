import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { handleNotice, relayDispatches, type Notice } from "./domain/dispatch.ts";

function db(): DatabaseSync {
  return new DatabaseSync(join(mkdtempSync(join(tmpdir(), "note-")), "n.sqlite"));
}

const base: Notice = {
  eventId: "evt-1",
  eventType: "employee.transfer.requested.v1",
  requestId: "req-1",
  employeeId: "emp-1",
  referenceNo: "ITR-2026-000001",
  lineManagerRef: "mgr-line",
  reason: "must-not-appear",
};

test("UT01 UT02 requested notifies employee and line manager without reason", () => {
  const database = db();
  const count = handleNotice(database, base);
  assert.equal(count, 2);
  const rows = database.prepare("SELECT template_id, recipient_ref, data FROM notification_dispatch").all() as Array<{ template_id: string; recipient_ref: string; data: string }>;
  assert.equal(rows.some((row) => row.recipient_ref === "employee:emp-1"), true);
  assert.equal(rows.some((row) => row.recipient_ref === "employee:mgr-line"), true);
  assert.equal(JSON.stringify(rows).includes("must-not-appear"), false);
});

test("UT10 null manager still notifies the employee", () => {
  const database = db();
  const count = handleNotice(database, { ...base, eventId: "evt-2", lineManagerRef: null });
  assert.equal(count, 1);
});

test("UT12 unique index keeps one row", () => {
  const database = db();
  handleNotice(database, base);
  assert.throws(() => {
    database.prepare(
      `INSERT INTO notification_dispatch (id, request_id, event_type, stage_code, template_id, recipient_ref, window_start, status, attempts, data)
       SELECT 'dup', request_id, event_type, stage_code, template_id, recipient_ref, window_start, status, 0, data FROM notification_dispatch LIMIT 1`,
    ).run();
  });
});

test("UT08 second delivery of one eventId enqueues nothing", () => {
  const database = db();
  handleNotice(database, { ...base, eventType: "employee.transfer.stage-pending.v1", stageCode: "MANAGER_ACCEPT", receivingManagerRef: "mgr-recv" });
  const again = handleNotice(database, { ...base, eventType: "employee.transfer.stage-pending.v1", stageCode: "MANAGER_ACCEPT", receivingManagerRef: "mgr-recv" });
  assert.equal(again, 0);
});

test("UT03 UT04 stage pending uses the receiving manager or the HR role", () => {
  const database = db();
  handleNotice(database, { ...base, eventId: "a", eventType: "employee.transfer.stage-pending.v1", stageCode: "MANAGER_ACCEPT", receivingManagerRef: "mgr-recv" });
  handleNotice(database, { ...base, eventId: "b", eventType: "employee.transfer.stage-pending.v1", stageCode: "HR_VALIDATION" });
  const rows = database.prepare("SELECT recipient_ref, stage_code FROM notification_dispatch").all() as Array<{ recipient_ref: string; stage_code: string }>;
  assert.equal(rows.some((row) => row.recipient_ref === "employee:mgr-recv"), true);
  assert.equal(rows.some((row) => row.recipient_ref === "role:HR_BUSINESS_PARTNER"), true);
});

test("UT05 UT06 terminal events notify the employee", () => {
  const database = db();
  handleNotice(database, { ...base, eventId: "c", eventType: "employee.transfer.completed.v1" });
  handleNotice(database, { ...base, eventId: "d", eventType: "employee.transfer.rejected.v1" });
  const templates = database.prepare("SELECT template_id FROM notification_dispatch").all() as Array<{ template_id: string }>;
  assert.deepEqual(templates.map((row) => row.template_id).sort(), ["itr.employee.completed", "itr.employee.rejected"]);
});

test("UT22 silent fulfilment events enqueue nothing", () => {
  const database = db();
  for (const eventType of ["employee.transfer.fulfilment-failed.v1", "employee.transfer.fulfilment-stage.v1", "employee.transfer.compensate.v1"]) {
    assert.equal(handleNotice(database, { ...base, eventId: eventType, eventType }), 0);
  }
  const count = database.prepare("SELECT COUNT(*) AS n FROM notification_dispatch").get() as { n: number };
  assert.equal(count.n, 0);
});

test("UT23 unsuffixed name is ignored", () => {
  const database = db();
  assert.equal(handleNotice(database, { ...base, eventId: "old", eventType: "employee.transfer.requested" }), 0);
});

test("UT20 stale pending mail is skipped", () => {
  const database = db();
  database.exec("CREATE TABLE transfer_request_stage (transfer_request_id TEXT, stage_code TEXT, status TEXT)");
  database.prepare("INSERT INTO transfer_request_stage VALUES ('req-1','MANAGER_ACCEPT','IN_PROGRESS')").run();
  handleNotice(database, { ...base, eventId: "late", eventType: "employee.transfer.stage-pending.v1", stageCode: "MANAGER_RELEASE" }, "MANAGER_REVIEW");
  const row = database.prepare("SELECT status FROM notification_dispatch").get() as { status: string };
  assert.equal(row.status, "SKIPPED");
});

test("UT16 5xx stays pending then SENT", async () => {
  const database = db();
  handleNotice(database, base);
  process.env.NOTIFY_FAST = "1";
  let calls = 0;
  await relayDispatches(database, async () => {
    calls += 1;
    return { status: calls === 1 ? 500 : 202 };
  });
  await relayDispatches(database, async () => ({ status: 202 }));
  delete process.env.NOTIFY_FAST;
  const statuses = database.prepare("SELECT status FROM notification_dispatch").all() as Array<{ status: string }>;
  assert.ok(statuses.every((row) => row.status === "SENT"));
});

test("UT18 4xx is undeliverable", async () => {
  const database = db();
  handleNotice(database, { ...base, eventId: "bad", lineManagerRef: null });
  process.env.NOTIFY_FAST = "1";
  await relayDispatches(database, async () => ({ status: 400 }));
  delete process.env.NOTIFY_FAST;
  const row = database.prepare("SELECT status FROM notification_dispatch").get() as { status: string };
  assert.equal(row.status, "UNDELIVERABLE");
});
