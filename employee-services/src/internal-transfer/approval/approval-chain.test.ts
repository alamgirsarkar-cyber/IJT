import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import request from "supertest";
import { createApp, openDatabase } from "../api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "../integration/hris/client.ts";

const reference: ReferenceData = {
  departments: [{ id: "d1", name: "Finance" }, { id: "d2", name: "Ops" }],
  locations: [{ id: "l1", name: "HQ", city: "Kolkata", country: "IN" }, { id: "l2", name: "Plant", city: "Pune", country: "IN" }],
  positions: [{
    id: "p-open", title: "Analyst", departmentId: "d2", locationId: "l2", grade: "G2", costCentre: "CC2",
    open: true, internallyFillable: true, openFrom: "2026-01-01", receivingManagerRef: "mgr-recv",
  }],
};

const job: Employment = {
  departmentId: "d1", departmentName: "Finance", locationId: "l1", locationName: "HQ",
  positionId: "p-cur", positionTitle: "Clerk", grade: "G1", costCentre: "CC1",
  serviceInPositionMonths: 18, positionStartDate: "2024-01-01", employmentStatus: "ACTIVE",
  probation: false, resignationActive: false, lineManagerRef: "mgr-line",
};

const hris: HrisContract = {
  async referenceData() { return reference; },
  async employment() { return job; },
};

function app() {
  const path = join(mkdtempSync(join(tmpdir(), "appr-")), "app.sqlite");
  return createApp(openDatabase(path), hris);
}

async function submitted(server: ReturnType<typeof app>, reason = "private text") {
  const created = await request(server).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1").send({ reason });
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + 30);
  const updated = await request(server)
    .put(`/api/v1/internal-transfers/${created.body.requestId}`)
    .set("Authorization", "Bearer emp-1")
    .set("If-Match", `"${created.body.version}"`)
    .send({
      targetDepartmentId: "d2",
      targetLocationId: "l2",
      targetPositionId: "p-open",
      requestedEffectiveDate: date.toISOString().slice(0, 10),
    });
  await request(server)
    .post(`/api/v1/internal-transfers/${created.body.requestId}/submit`)
    .set("Authorization", "Bearer emp-1")
    .set("Idempotency-Key", `sub-${created.body.requestId}`);
  return { id: created.body.requestId as string, version: (updated.body.version as number) + 1 };
}

test("UT17 inbox has no reason and only the caller's stage", async () => {
  const server = app();
  const row = await submitted(server);
  const inbox = await request(server).get("/api/v1/internal-transfers/approvals").set("Authorization", "Bearer mgr-line");
  assert.equal(inbox.status, 200);
  assert.equal(inbox.body.items.length, 1);
  assert.equal(inbox.body.items[0].requestId, row.id);
  assert.equal(JSON.stringify(inbox.body).includes("reason"), false);
  assert.equal(JSON.stringify(inbox.body).includes("private text"), false);
  const other = await request(server).get("/api/v1/internal-transfers/approvals").set("Authorization", "Bearer someone");
  assert.equal(other.body.items.length, 0);
  const anon = await request(server).get("/api/v1/internal-transfers/approvals");
  assert.equal(anon.status, 401);
});

test("UT13 UT15 UT16 detail hides reason from managers and 404s strangers", async () => {
  const server = app();
  const row = await submitted(server);
  const manager = await request(server).get(`/api/v1/internal-transfers/${row.id}/approval`).set("Authorization", "Bearer mgr-line");
  assert.equal(manager.status, 200);
  assert.equal(manager.body.version, row.version);
  assert.equal("reason" in manager.body, false);
  const hr = await request(server).get(`/api/v1/internal-transfers/${row.id}/approval`).set("Authorization", "Bearer hr-1|HR_BUSINESS_PARTNER");
  assert.equal(hr.body.reason, "private text");
  const stranger = await request(server).get(`/api/v1/internal-transfers/${row.id}/approval`).set("Authorization", "Bearer stranger");
  assert.equal(stranger.status, 404);
});

test("UT01 UT02 release approve stays in manager review", async () => {
  const server = app();
  const row = await submitted(server);
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "rel-1")
    .send({ decision: "APPROVE" });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "MANAGER_REVIEW");
  const accept = response.body.stages.find((stage: { stageCode: string }) => stage.stageCode === "MANAGER_ACCEPT");
  assert.equal(accept.status, "IN_PROGRESS");
});

test("UT03 accept moves to HR validation", async () => {
  const server = app();
  const row = await submitted(server);
  await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "rel-2")
    .send({ decision: "APPROVE" });
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_ACCEPT/decision`)
    .set("Authorization", "Bearer mgr-recv")
    .set("If-Match", `"${row.version + 1}"`)
    .set("Idempotency-Key", "acc-1")
    .send({ decision: "APPROVE" });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "HR_VALIDATION");
});

test("UT04 UT33 HR approve outside the window by any HR partner", async () => {
  const server = app();
  const row = await submitted(server);
  await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "rel-3")
    .send({ decision: "APPROVE" });
  await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_ACCEPT/decision`)
    .set("Authorization", "Bearer mgr-recv")
    .set("If-Match", `"${row.version + 1}"`)
    .set("Idempotency-Key", "acc-2")
    .send({ decision: "APPROVE" });
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/HR_VALIDATION/decision`)
    .set("Authorization", "Bearer other-hr|HR_BUSINESS_PARTNER")
    .set("If-Match", `"${row.version + 2}"`)
    .set("Idempotency-Key", "hr-1")
    .send({ decision: "APPROVE", confirmedEffectiveDate: "2020-01-01" });
  assert.equal(response.status, 200);
  assert.equal(response.body.status, "FULFILMENT");
  assert.equal(response.body.confirmedEffectiveDate, "2020-01-01");
  const org = response.body.stages.find((stage: { stageCode: string }) => stage.stageCode === "ORG_DATA_UPDATE");
  assert.equal(org.status, "IN_PROGRESS");
});

test("UT06 HR approve without a date is 422", async () => {
  const server = app();
  const row = await submitted(server);
  await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "rel-4")
    .send({ decision: "APPROVE" });
  await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_ACCEPT/decision`)
    .set("Authorization", "Bearer mgr-recv")
    .set("If-Match", `"${row.version + 1}"`)
    .set("Idempotency-Key", "acc-3")
    .send({ decision: "APPROVE" });
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/HR_VALIDATION/decision`)
    .set("Authorization", "Bearer hr-1|HR_BUSINESS_PARTNER")
    .set("If-Match", `"${row.version + 2}"`)
    .set("Idempotency-Key", "hr-2")
    .send({ decision: "APPROVE" });
  assert.equal(response.status, 422);
});

test("UT07 reject is terminal and cancels later stages", async () => {
  const server = app();
  const row = await submitted(server);
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "rej-1")
    .send({ decision: "REJECT" });
  assert.equal(response.body.status, "REJECTED");
  assert.equal(response.body.confirmedEffectiveDate, null);
  const later = response.body.stages.filter((stage: { stageCode: string }) => stage.stageCode !== "MANAGER_RELEASE");
  assert.ok(later.every((stage: { status: string }) => stage.status === "CANCELLED"));
});

test("UT10 out of order decision is refused", async () => {
  const server = app();
  const row = await submitted(server);
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/HR_VALIDATION/decision`)
    .set("Authorization", "Bearer hr-1|HR_BUSINESS_PARTNER")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "oo-1")
    .send({ decision: "APPROVE", confirmedEffectiveDate: "2026-12-01" });
  assert.equal(response.status, 409);
  assert.equal(response.body.type, "invalid-state-transition");
});

test("UT30 stale If-Match does not merge", async () => {
  const server = app();
  const row = await submitted(server);
  const response = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", '"1"')
    .set("Idempotency-Key", "stale-1")
    .send({ decision: "APPROVE" });
  assert.equal(response.status, 409);
  assert.equal(response.body.type, "version-conflict");
});

test("UT18 replay writes nothing new", async () => {
  const server = app();
  const row = await submitted(server);
  const first = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("If-Match", `"${row.version}"`)
    .set("Idempotency-Key", "same-key")
    .send({ decision: "APPROVE" });
  const second = await request(server)
    .post(`/api/v1/internal-transfers/${row.id}/stages/MANAGER_RELEASE/decision`)
    .set("Authorization", "Bearer mgr-line")
    .set("Idempotency-Key", "same-key")
    .send({ decision: "APPROVE" });
  assert.equal(second.status, 200);
  assert.equal(second.body.version, first.body.version);
});
