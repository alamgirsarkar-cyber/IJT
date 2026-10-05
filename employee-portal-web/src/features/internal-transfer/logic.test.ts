import assert from "node:assert/strict";
import test from "node:test";
import {
  advisoryTone,
  canWithdraw,
  isActionableStage,
  isFailedFulfilment,
  roleFromList,
  stageText,
  type StageView,
} from "./logic.ts";

function stage(over: Partial<StageView> = {}): StageView {
  return { stageCode: "ORG_DATA_UPDATE", sequence: 4, status: "NOT_STARTED", applicable: true, ...over };
}

test("stageText reads 'Not required' for an inapplicable stage before its status", () => {
  assert.equal(stageText(stage({ applicable: false, status: "IN_PROGRESS" })), "Not required");
  assert.equal(stageText(stage({ status: "IN_PROGRESS" })), "In progress");
  assert.equal(stageText(stage({ status: "NOT_STARTED" })), "Not started");
  assert.equal(stageText(stage({ status: "COMPLETED" })), "COMPLETED");
});

test("canWithdraw is true only with the managers or HR", () => {
  assert.equal(canWithdraw("MANAGER_REVIEW"), true);
  assert.equal(canWithdraw("HR_VALIDATION"), true);
  assert.equal(canWithdraw("DRAFT"), false);
  assert.equal(canWithdraw("FULFILMENT"), false);
  assert.equal(canWithdraw("COMPLETED"), false);
});

test("advisoryTone warns on payroll misalignment and informs otherwise", () => {
  assert.equal(advisoryTone("PAYROLL_CYCLE_MISALIGNED"), "warning");
  assert.equal(advisoryTone("HR_CHECKS_FURTHER"), "info");
});

test("isFailedFulfilment detects a failed or compensating work stage", () => {
  assert.equal(isFailedFulfilment([{ status: "IN_PROGRESS" }, { status: "NOT_STARTED" }]), false);
  assert.equal(isFailedFulfilment([{ status: "FAILED" }]), true);
  assert.equal(isFailedFulfilment([{ status: "COMPENSATION_REQUESTED" }]), true);
});

test("the employee confirmation stage is never an actionable control", () => {
  assert.equal(isActionableStage("EMPLOYEE_CONFIRMATION"), false);
  assert.equal(isActionableStage("ORG_DATA_UPDATE"), true);
});

test("roleFromList picks the highest-privilege role and defaults to employee", () => {
  assert.equal(roleFromList(["HR_BUSINESS_PARTNER"]), "HR_BUSINESS_PARTNER");
  assert.equal(roleFromList(["LINE_MANAGER"]), "LINE_MANAGER");
  assert.equal(roleFromList(["RECEIVING_MANAGER"]), "RECEIVING_MANAGER");
  assert.equal(roleFromList([]), "EMPLOYEE");
  assert.equal(roleFromList(["SOMETHING_ELSE"]), "EMPLOYEE");
});
