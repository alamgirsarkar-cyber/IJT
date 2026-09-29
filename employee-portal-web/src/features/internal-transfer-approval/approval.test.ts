import assert from "node:assert/strict";
import test from "node:test";
import { copy, managerSeesReason, type DecisionView } from "./inbox.ts";

test("UT26 manager decision has no reason field", () => {
  const view: DecisionView = { requestId: "r1", version: 2, status: "MANAGER_REVIEW" };
  assert.equal(managerSeesReason(view), false);
  assert.equal(copy.approve, "Approve");
  assert.equal(JSON.stringify(copy).includes("reason"), false);
});

test("UT29 unauthenticated copy points at portal sign-in", () => {
  assert.equal(copy.signIn, "Sign in");
});

test("UT27 HR validation shows reason only in the document model and requires a date", () => {
  const view: DecisionView = { requestId: "r1", version: 4, status: "HR_VALIDATION", reason: "fixture reason" };
  assert.equal(view.reason, "fixture reason");
  assert.equal(copy.missingDate.length > 0, true);
  assert.equal(copy.conflict.includes("changed elsewhere"), true);
});
