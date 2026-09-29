import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import request from "supertest";
import { createApp, openDatabase } from "./api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "./integration/hris/client.ts";
import { relayOnce } from "./outbox/relay.ts";
import { migrate } from "./persistence/schema.ts";
import { evaluate, serviceMonths } from "./rules/evaluate.ts";

const reference: ReferenceData = {
  departments: [{ id: "d1", name: "Finance" }, { id: "d2", name: "Ops" }],
  locations: [{ id: "l1", name: "HQ", city: "Kolkata", country: "IN" }, { id: "l2", name: "Plant", city: "Pune", country: "IN" }],
  positions: [
    {
      id: "p-open",
      title: "Analyst",
      departmentId: "d2",
      locationId: "l2",
      grade: "G2",
      costCentre: "CC2",
      open: true,
      internallyFillable: true,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
    {
      id: "p-closed",
      title: "Closed",
      departmentId: "d2",
      locationId: "l1",
      grade: "G2",
      costCentre: "CC2",
      open: false,
      internallyFillable: true,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
    {
      id: "p-external",
      title: "External",
      departmentId: "d2",
      locationId: "l1",
      grade: "G2",
      costCentre: "CC2",
      open: true,
      internallyFillable: false,
      openFrom: "2026-01-01",
      receivingManagerRef: "mgr-recv",
    },
  ],
};

function employment(over: Partial<Employment> = {}): Employment {
  return {
    departmentId: "d1",
    departmentName: "Finance",
    locationId: "l1",
    locationName: "HQ",
    positionId: "p-cur",
    positionTitle: "Clerk",
    grade: "G1",
    costCentre: "CC1",
    serviceInPositionMonths: 18,
    positionStartDate: "2024-01-01",
    employmentStatus: "ACTIVE",
    probation: false,
    resignationActive: false,
    lineManagerRef: "mgr-line",
    ...over,
  };
}

function hris(options?: { fail?: boolean; employment?: Employment }): HrisContract {
  return {
    async referenceData() {
      if (options?.fail) throw new Error("unreachable");
      return reference;
    },
    async employment() {
      if (options?.fail) throw new Error("unreachable");
      return options?.employment ?? employment();
    },
  };
}

function dbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "itr-")), "app.sqlite");
}

function baseInput(over: Partial<Parameters<typeof evaluate>[0]> = {}) {
  return {
    employmentStatus: "ACTIVE",
    probation: false,
    positionStartDate: "2024-01-01",
    requestedEffectiveDate: "2026-10-15",
    resignationActive: false,
    currentDepartmentId: "d1",
    currentLocationId: "l1",
    currentPositionId: "p-cur",
    targetDepartmentId: "d2",
    targetLocationId: "l2",
    targetPositionId: "p-open",
    positionOpen: true,
    internallyFillable: true,
    asOf: "2026-09-01",
    ...over,
  };
}

test("UT01 reference matches ITR-year-six digits", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const response = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 201);
  assert.match(response.body.referenceNo, /^ITR-\d{4}-\d{6}$/);
  assert.equal(response.body.currentAssignment.departmentId, "d1");
});

test("UT23 concurrent inserts produce one row", () => {
  const path = dbPath();
  const first = new DatabaseSync(path);
  const second = new DatabaseSync(path);
  migrate(first);
  migrate(second);
  first.exec("PRAGMA busy_timeout = 2000");
  second.exec("PRAGMA busy_timeout = 2000");
  const insert = (db: DatabaseSync, id: string) => {
    db.exec("BEGIN IMMEDIATE");
    db.prepare(
      `INSERT INTO transfer_request (
        id, reference_no, employee_id, status, version, created_at, updated_at
      ) VALUES (?, ?, 'emp-1', 'DRAFT', 1, '2026-09-24T00:00:00Z', '2026-09-24T00:00:00Z')`,
    ).run(id, `ITR-2026-${id.slice(0, 6)}`);
    db.exec("COMMIT");
  };
  const results = [0, 1].map((index) => {
    try {
      insert(index === 0 ? first : second, `id-${index}-abcdef`);
      return "ok";
    } catch {
      try {
        (index === 0 ? first : second).exec("ROLLBACK");
      } catch {
        /* already closed */
      }
      return "rejected";
    }
  });
  assert.deepEqual(results.sort(), ["ok", "rejected"]);
  const count = first.prepare("SELECT COUNT(*) AS n FROM transfer_request").get() as { n: number };
  assert.equal(count.n, 1);
});

test("UT52 audit update is rejected by the database", () => {
  const db = openDatabase(dbPath());
  db.prepare(
    `INSERT INTO transfer_request_audit (
      id, transfer_request_id, actor_employee_id, actor_role, event_type, occurred_at, correlation_id
    ) VALUES ('a1','r1','e1','EMPLOYEE','SUBMITTED','2026-09-24T00:00:00Z','c1')`,
  ).run();
  assert.throws(() => db.prepare("UPDATE transfer_request_audit SET actor_role = 'HR' WHERE id = 'a1'").run());
});

test("UT42 cache within TTL serves stale false", async () => {
  const db = openDatabase(dbPath());
  db.prepare(
    "INSERT INTO reference_data_cache (cache_key, payload, fetched_at) VALUES ('ref', ?, strftime('%Y-%m-%dT%H:%M:%SZ','now'))",
  ).run(JSON.stringify(reference));
  const app = createApp(db, hris({ fail: true }));
  const response = await request(app).get("/api/v1/internal-transfers/reference-data").set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 200);
  assert.equal(response.body.stale, false);
});

test("UT43 cache past TTL serves stale true", async () => {
  const db = openDatabase(dbPath());
  db.prepare(
    "INSERT INTO reference_data_cache (cache_key, payload, fetched_at) VALUES ('ref', ?, datetime('now','-1 hour'))",
  ).run(JSON.stringify(reference));
  const app = createApp(db, hris({ fail: true }));
  const response = await request(app).get("/api/v1/internal-transfers/reference-data").set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 200);
  assert.equal(response.body.stale, true);
});

test("UT44 empty cache is 503", async () => {
  const app = createApp(openDatabase(dbPath()), hris({ fail: true }));
  const response = await request(app).get("/api/v1/internal-transfers/reference-data").set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 503);
  assert.equal(response.body.type, "reference-data-unavailable");
  assert.ok(response.headers["retry-after"]);
});

test("AC6 closed and external positions are omitted", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const response = await request(app).get("/api/v1/internal-transfers/reference-data").set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.positions.map((item: { id: string }) => item.id), ["p-open"]);
});

test("UT02 snapshot is informational on create", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const response = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1").send({});
  assert.equal(response.body.currentAssignment.positionTitle, "Clerk");
  assert.equal(response.body.status, "DRAFT");
});

test("UT03 If-Match match increments version", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const updated = await request(app)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", `"${created.body.version}"`)
    .send({ targetDepartmentId: "d2" });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.version, 2);
});

test("UT04 stale If-Match is version-conflict", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const updated = await request(app)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", '"0"')
    .send({ targetDepartmentId: "d2" });
  assert.equal(updated.status, 409);
  assert.equal(updated.body.type, "version-conflict");
});

test("UT05 absent If-Match is precondition-required", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const updated = await request(app)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .send({});
  assert.equal(updated.status, 400);
  assert.equal(updated.body.type, "precondition-required");
});

test("UT21 second non-terminal request is 409", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const second = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  assert.equal(second.status, 409);
  assert.equal(second.body.type, "active-request-exists");
});

test("UT22 terminal request does not block a new draft", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  db.prepare("UPDATE transfer_request SET status = 'REJECTED' WHERE id = ?").run(created.body.requestId);
  const second = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  assert.equal(second.status, 201);
});

test("UT36 another employee gets 404", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const read = await request(app).get(`/api/v1/internal-transfers/${created.body.requestId}`).set("Authorization", "Bearer emp-2");
  assert.equal(read.status, 404);
  assert.equal(JSON.stringify(read.body).includes(created.body.referenceNo), false);
});

test("UT37 body employeeId is ignored", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const response = await request(app)
    .post("/api/v1/internal-transfers")
    .set("Authorization", "Bearer emp-1")
    .send({ employeeId: "emp-2" });
  assert.equal(response.status, 201);
  const read = await request(app).get(`/api/v1/internal-transfers/${response.body.requestId}`).set("Authorization", "Bearer emp-1");
  assert.equal(read.status, 200);
});

test("UT56 missing Authorization inserts nothing", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const response = await request(app).post("/api/v1/internal-transfers");
  assert.equal(response.status, 401);
  const count = db.prepare("SELECT COUNT(*) AS n FROM transfer_request").get() as { n: number };
  assert.equal(count.n, 0);
});

test("UT09 and UT17 inclusive boundaries pass", () => {
  assert.equal(serviceMonths("2025-10-01", "2026-10-01"), 12);
  const exact = evaluate(baseInput({ asOf: "2026-09-01", requestedEffectiveDate: "2026-09-15" }));
  assert.equal(exact.violations.some((item) => item.ruleId.endsWith("BR7")), false);
  const year = evaluate(baseInput({ positionStartDate: "2025-10-01", requestedEffectiveDate: "2026-10-01" }));
  assert.equal(year.violations.some((item) => item.ruleId.endsWith("BR2")), false);
});

test("UT16 BR2 uses the effective date", () => {
  const result = evaluate(baseInput({ positionStartDate: "2025-10-01", requestedEffectiveDate: "2026-09-30", asOf: "2026-09-01" }));
  assert.ok(result.violations.some((item) => item.ruleId.endsWith("BR2")));
});

test("UT11 mid-cycle date succeeds with BR8 advisory", () => {
  const result = evaluate(baseInput({ requestedEffectiveDate: "2026-10-15" }));
  assert.equal(result.violations.length, 0);
  assert.ok(result.advisories.some((item) => item.code === "PAYROLL_CYCLE_MISALIGNED" && item.ruleId.endsWith("BR8")));
});

test("UT19 two failed rules return two violations", () => {
  const result = evaluate(baseInput({ probation: true, resignationActive: true }));
  const ids = result.violations.map((item) => item.ruleId);
  assert.ok(ids.some((id) => id.endsWith("BR1")));
  assert.ok(ids.some((id) => id.endsWith("BR4")));
});

test("UT20 success still carries BR9 advisory", () => {
  const result = evaluate(baseInput({ requestedEffectiveDate: "2026-10-01" }));
  assert.equal(result.violations.length, 0);
  assert.ok(result.advisories.some((item) => item.ruleId.endsWith("BR9")));
});

test("UT06 through UT20 remaining rule ids", () => {
  assert.ok(evaluate(baseInput({ employmentStatus: "LEAVE" })).violations.some((item) => item.ruleId.endsWith("BR1")));
  assert.ok(evaluate(baseInput({ targetDepartmentId: "d1", targetLocationId: "l1", targetPositionId: "p-cur" })).violations.some((item) => item.ruleId.endsWith("BR5")));
  assert.ok(evaluate(baseInput({ positionOpen: false })).violations.some((item) => item.ruleId.endsWith("BR6")));
  assert.ok(evaluate(baseInput({ requestedEffectiveDate: "2026-09-02" })).violations.some((item) => item.ruleId.endsWith("BR7")));
  assert.equal(evaluate(baseInput({ requestedEffectiveDate: "2026-10-01" })).advisories.some((item) => item.code === "PAYROLL_CYCLE_MISALIGNED"), false);
  assert.equal(serviceMonths("2025-03-31", "2025-04-30"), 1);
  assert.equal(serviceMonths("2025-01-31", "2026-02-28"), 13);
});

function futureDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function draftReady(app: ReturnType<typeof createApp>) {
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const updated = await request(app)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", `"${created.body.version}"`)
    .send({
      targetDepartmentId: "d2",
      targetLocationId: "l2",
      targetPositionId: "p-open",
      requestedEffectiveDate: futureDate(30),
    });
  return { id: created.body.requestId as string, version: updated.body.version as number };
}

test("UT24 submit commits manager review, stages, audit and outbox", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${id}/submit`)
    .set("Authorization", "Bearer emp-1")
    .set("Idempotency-Key", "k1");
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "MANAGER_REVIEW");
  const stages = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_stage WHERE transfer_request_id = ?").get(id) as { n: number };
  const audits = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_audit WHERE transfer_request_id = ?").get(id) as { n: number };
  const outbox = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_outbox WHERE aggregate_id = ?").get(id) as { n: number };
  assert.equal(stages.n, 8);
  assert.equal(audits.n, 1);
  assert.equal(outbox.n, 1);
});

test("UT25 non-applicable stages are persisted", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const same = reference.positions.map((position) =>
    position.id === "p-open"
      ? { ...position, departmentId: "d1", locationId: "l1", grade: "G1", costCentre: "CC1" }
      : position,
  );
  const app = createApp(db, {
    async referenceData() {
      return { ...reference, positions: same };
    },
    async employment() {
      return employment();
    },
  });
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  await request(app)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", '"1"')
    .send({ targetDepartmentId: "d1", targetLocationId: "l1", targetPositionId: "p-open", requestedEffectiveDate: futureDate(30) });
  await request(app)
    .post(`/api/v1/internal-transfers/${created.body.requestId}/submit`)
    .set("Authorization", "Bearer emp-1")
    .set("Idempotency-Key", "k-same");
  const rows = db.prepare("SELECT stage_code, applicable FROM transfer_request_stage").all() as Array<{ stage_code: string; applicable: number }>;
  for (const code of ["PAYROLL_UPDATE", "IT_ACCESS", "FACILITIES"]) {
    assert.equal(rows.find((row) => row.stage_code === code)?.applicable, 0);
  }
});

test("UT26 outbox failure rolls back", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  process.env.OUTBOX_FAIL = "1";
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${id}/submit`)
    .set("Authorization", "Bearer emp-1")
    .set("Idempotency-Key", "k-fail");
  delete process.env.OUTBOX_FAIL;
  assert.equal(response.status, 500);
  const row = db.prepare("SELECT status FROM transfer_request WHERE id = ?").get(id) as { status: string };
  const stages = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_stage").get() as { n: number };
  assert.equal(row.status, "DRAFT");
  assert.equal(stages.n, 0);
});

test("UT27 replay returns the stored response", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const draft = await draftReady(app);
  const id = draft.id;
  const first = await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "same");
  const second = await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "same");
  assert.equal(second.status, first.status);
  assert.equal(second.body.status, "MANAGER_REVIEW");
});

test("UT28 key reused on another request conflicts", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "shared");
  db.prepare("UPDATE transfer_request SET status = 'REJECTED' WHERE id = ?").run(id);
  const other = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${other.body.requestId}/submit`)
    .set("Authorization", "Bearer emp-1")
    .set("Idempotency-Key", "shared");
  assert.equal(response.status, 409);
  assert.equal(response.body.type, "idempotency-key-conflict");
});

test("UT29 missing idempotency key", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const draft = await draftReady(app);
  const id = draft.id;
  const response = await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1");
  assert.equal(response.status, 400);
  assert.equal(response.body.type, "idempotency-key-required");
});

test("UT45 HRIS down leaves the draft", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  const down = createApp(db, hris({ fail: true }));
  const response = await request(down).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "down");
  assert.equal(response.status, 503);
  const row = db.prepare("SELECT status FROM transfer_request WHERE id = ?").get(id) as { status: string };
  assert.equal(row.status, "DRAFT");
});

test("UT46 published payload has no reason or name", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "pub");
  const seen: unknown[] = [];
  await relayOnce(db, async (_url, body) => {
    seen.push(body);
  }, "http://downstream.example/hooks");
  const text = JSON.stringify(seen[0]);
  assert.equal(text.includes("reason"), false);
  assert.equal(text.includes("Clerk"), false);
  assert.equal(text.includes("must-not-pass"), false);
});

test("relay republishes when publish is not marked", async () => {
  const db = openDatabase(dbPath());
  db.prepare(
    `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
     VALUES ('o1','r1','employee.transfer.requested.v1','{"payload":{"requestId":"r1"}}','2026-09-24T00:00:00Z',0)`,
  ).run();
  let calls = 0;
  await relayOnce(db, async () => {
    calls += 1;
    throw new Error("crash");
  }, "http://downstream.example/hooks", Date.parse("2026-09-24T00:00:01Z"));
  await relayOnce(db, async () => {
    calls += 1;
  }, "http://downstream.example/hooks", Date.parse("2026-09-24T00:01:00Z"));
  assert.equal(calls, 2);
});

test("UT30 all stages including inapplicable", async () => {
  const path = dbPath();
  const app = createApp(openDatabase(path), hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "list");
  const detail = await request(app).get(`/api/v1/internal-transfers/${id}`).set("Authorization", "Bearer emp-1");
  assert.equal(detail.body.stages.length, 8);
});

test("UT31 line manager name only for that stage", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "name");
  const detail = await request(app).get(`/api/v1/internal-transfers/${id}`).set("Authorization", "Bearer emp-1");
  const release = detail.body.stages.find((stage: { stageCode: string }) => stage.stageCode === "MANAGER_RELEASE");
  const accept = detail.body.stages.find((stage: { stageCode: string }) => stage.stageCode === "MANAGER_ACCEPT");
  assert.equal(release.assignedPartyName, "Line manager");
  assert.equal(accept.assignedPartyName, null);
  assert.equal(detail.body.effectiveDateStatus, "REQUESTED");
});

test("UT34 list is own requests without reason", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1").send({ reason: "private text" });
  await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-2");
  const list = await request(app).get("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  assert.equal(list.body.items.length, 1);
  assert.equal(JSON.stringify(list.body).includes("reason"), false);
  assert.equal(JSON.stringify(list.body).includes("private text"), false);
});

test("UT48 reason is on detail for the owner", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1").send({ reason: "private text" });
  const detail = await request(app).get(`/api/v1/internal-transfers/${created.body.requestId}`).set("Authorization", "Bearer emp-1");
  assert.equal(detail.body.reason, "private text");
});

test("UT38 withdraw cancels incomplete stages", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "w");
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${id}/withdraw`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", `"${draft.version + 1}"`)
    .send({ withdrawalReason: "secret reason" });
  assert.equal(response.status, 200);
  const open = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_stage WHERE status = 'IN_PROGRESS'").get() as { n: number };
  const audits = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_audit").get() as { n: number };
  assert.equal(open.n, 0);
  assert.equal(audits.n, 2);
  const event = db.prepare("SELECT payload FROM transfer_request_outbox WHERE event_type LIKE '%withdrawn%'").get() as { payload: string };
  assert.equal(event.payload.includes("secret reason"), false);
});

test("UT39 fulfilment is withdrawal-window-closed", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  db.prepare("UPDATE transfer_request SET status = 'FULFILMENT' WHERE id = ?").run(created.body.requestId);
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${created.body.requestId}/withdraw`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", '"1"');
  assert.equal(response.status, 409);
  assert.equal(response.body.type, "withdrawal-window-closed");
});

test("UT40 repeat withdrawal is unchanged", async () => {
  const path = dbPath();
  const db = openDatabase(path);
  const app = createApp(db, hris());
  const draft = await draftReady(app);
  const id = draft.id;
  await request(app).post(`/api/v1/internal-transfers/${id}/submit`).set("Authorization", "Bearer emp-1").set("Idempotency-Key", "w2");
  await request(app).post(`/api/v1/internal-transfers/${id}/withdraw`).set("Authorization", "Bearer emp-1").set("If-Match", `"${draft.version + 1}"`);
  const before = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_audit").get() as { n: number };
  const again = await request(app).post(`/api/v1/internal-transfers/${id}/withdraw`).set("Authorization", "Bearer emp-1");
  const after = db.prepare("SELECT COUNT(*) AS n FROM transfer_request_audit").get() as { n: number };
  assert.equal(again.status, 200);
  assert.equal(after.n, before.n);
});

test("UT41 draft withdraw is invalid-state-transition", async () => {
  const app = createApp(openDatabase(dbPath()), hris());
  const created = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  const response = await request(app)
    .post(`/api/v1/internal-transfers/${created.body.requestId}/withdraw`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", '"1"');
  assert.equal(response.status, 409);
  assert.equal(response.body.type, "invalid-state-transition");
});
