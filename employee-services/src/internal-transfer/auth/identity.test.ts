import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import request from "supertest";
import { createApp, openDatabase } from "../api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "../integration/hris/client.ts";

const SECRET = "test-gateway-secret";

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

function productionApp() {
  const path = join(mkdtempSync(join(tmpdir(), "id-")), "app.sqlite");
  return { app: createApp(openDatabase(path), hris, {}, { gatewayHmacSecret: SECRET }), path };
}

function sign(subject: string, roles: readonly string[], timestamp: string, secret = SECRET): string {
  const material = [subject, [...roles].sort().join(","), timestamp].join("\n");
  return `sha256=${createHmac("sha256", secret).update(material).digest("hex")}`;
}

function assertion(subject: string, roles: readonly string[], over: { timestamp?: string; signature?: string } = {}) {
  const timestamp = over.timestamp ?? new Date().toISOString();
  const signature = over.signature ?? sign(subject, roles, timestamp);
  return {
    "X-Gateway-Subject": subject,
    "X-Gateway-Roles": [...roles].sort().join(","),
    "X-Gateway-Timestamp": timestamp,
    "X-Gateway-Signature": signature,
  };
}

test("G2-F02 unsigned Bearer hr-1 on GET /me is 401", async () => {
  const { app } = productionApp();
  const response = await request(app).get("/api/v1/internal-transfers/me").set("Authorization", "Bearer hr-1");
  assert.equal(response.status, 401);
  assert.equal(response.body.type, "unauthenticated");
});

test("G2-F02 unsigned Bearer hr-1 on create does not insert a row", async () => {
  const { app, path } = productionApp();
  const response = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer hr-1");
  assert.equal(response.status, 401);
  assert.equal(response.body.type, "unauthenticated");
  const db = new DatabaseSync(path);
  const row = db.prepare("SELECT COUNT(*) AS n FROM transfer_request").get() as { n: number };
  assert.equal(row.n, 0);
  db.close();
});

test("G2-F02 valid gateway assertion authenticates HR on /me", async () => {
  const { app } = productionApp();
  const headers = assertion("hr-1", ["HR_BUSINESS_PARTNER"]);
  const response = await request(app)
    .get("/api/v1/internal-transfers/me")
    .set("Authorization", "Bearer hr-1")
    .set(headers);
  assert.equal(response.status, 200);
  assert.equal(response.body.employeeId, "hr-1");
  assert.deepEqual(response.body.roles, ["HR_BUSINESS_PARTNER"]);
});

test("G2-F02 tampered gateway signature is 401", async () => {
  const { app } = productionApp();
  const headers = assertion("hr-1", ["HR_BUSINESS_PARTNER"], { signature: "sha256=00" });
  const response = await request(app)
    .get("/api/v1/internal-transfers/me")
    .set("Authorization", "Bearer hr-1")
    .set(headers);
  assert.equal(response.status, 401);
});

test("G2-F02 expired gateway timestamp is 401", async () => {
  const { app } = productionApp();
  const timestamp = "2020-01-01T00:00:00.000Z";
  const headers = assertion("hr-1", ["HR_BUSINESS_PARTNER"], { timestamp });
  const response = await request(app)
    .get("/api/v1/internal-transfers/me")
    .set("Authorization", "Bearer hr-1")
    .set(headers);
  assert.equal(response.status, 401);
});

test("G2-F02 local-dev stub turns a demo Bearer into a signed assertion", async () => {
  const path = join(mkdtempSync(join(tmpdir(), "id-")), "app.sqlite");
  const app = createApp(openDatabase(path), hris, {}, {
    gatewayHmacSecret: SECRET,
    localDevIdentity: { secret: SECRET, roles: { "hr-1": ["HR_BUSINESS_PARTNER"] } },
  });
  const response = await request(app).get("/api/v1/internal-transfers/me").set("Authorization", "Bearer hr-1");
  assert.equal(response.status, 200);
  assert.equal(response.body.employeeId, "hr-1");
  assert.deepEqual(response.body.roles, ["HR_BUSINESS_PARTNER"]);
});

test("G2-F02 bearer subject mismatch with asserted subject is 401", async () => {
  const { app } = productionApp();
  const headers = assertion("hr-1", ["HR_BUSINESS_PARTNER"]);
  const response = await request(app)
    .get("/api/v1/internal-transfers/me")
    .set("Authorization", "Bearer emp-1")
    .set(headers);
  assert.equal(response.status, 401);
});
