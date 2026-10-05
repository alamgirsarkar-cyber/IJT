import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import request from "supertest";
import { createApp, openDatabase } from "../api/app.ts";
import type { Employment, HrisContract, ReferenceData } from "../integration/hris/client.ts";
import { migrate } from "../persistence/schema.ts";
import { counterKey, enforceRateLimit } from "./rate-limit.ts";

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

function dbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "rl-")), "app.sqlite");
}

test("UT49 the counter blocks once the subject passes the limit", () => {
  const db = openDatabase(dbPath());
  migrate(db);
  const results = [1, 2, 3, 4].map(() => enforceRateLimit(db, "create", "emp-1", 3).limited);
  assert.deepEqual(results, [false, false, false, true]);
});

test("UT49 the window resets after an hour", () => {
  const db = openDatabase(dbPath());
  migrate(db);
  const base = Date.parse("2026-09-29T00:00:00Z");
  assert.equal(enforceRateLimit(db, "create", "emp-1", 1, base).limited, false);
  assert.equal(enforceRateLimit(db, "create", "emp-1", 1, base + 1000).limited, true);
  assert.equal(enforceRateLimit(db, "create", "emp-1", 1, base + 3_600_000).limited, false);
});

test("UT50 the counter key is a salted hash, not the raw identifier", () => {
  const key = counterKey("create", "emp-1");
  assert.match(key, /^[0-9a-f]{64}$/);
  assert.equal(key.includes("emp-1"), false);
  assert.notEqual(counterKey("create", "emp-1"), counterKey("submit", "emp-1"));
});

test("UT49 the create endpoint returns 429 with Retry-After once over the limit", async () => {
  const app = createApp(openDatabase(dbPath()), hris);
  let last = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  for (let call = 0; call < 20; call += 1) {
    last = await request(app).post("/api/v1/internal-transfers").set("Authorization", "Bearer emp-1");
  }
  assert.equal(last.status, 429);
  assert.equal(last.body.type, "rate-limited");
  assert.ok(last.headers["retry-after"]);
});
