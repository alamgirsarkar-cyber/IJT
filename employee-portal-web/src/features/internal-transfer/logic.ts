// G2-F10: logic-bearing helpers for the transfer screens, kept free of JSX so they can be
// unit-tested with node:test. The components import these; the tests assert them directly.

export type StageView = {
  stageCode: string;
  sequence: number;
  status: string;
  applicable: boolean;
  assignedPartyName?: string | null;
};

export function stageText(stage: StageView): string {
  if (!stage.applicable) return "Not required";
  if (stage.status === "IN_PROGRESS") return "In progress";
  if (stage.status === "NOT_STARTED") return "Not started";
  return stage.status;
}

// A request can be withdrawn only while it is with the managers or HR. Once it is in
// FULFILMENT (or terminal) the control is not offered (AC14).
export function canWithdraw(status: string): boolean {
  return status === "MANAGER_REVIEW" || status === "HR_VALIDATION";
}

export function advisoryTone(code: string): "warning" | "info" {
  return code === "PAYROLL_CYCLE_MISALIGNED" ? "warning" : "info";
}

// AC11: the failed-fulfilment employee label. "HR is completing this" when a work stage has
// failed or is compensating; otherwise the plain status display is used.
export function isFailedFulfilment(stages: ReadonlyArray<Pick<StageView, "status">>): boolean {
  return stages.some((stage) =>
    ["FAILED", "COMPENSATION_REQUESTED", "COMPENSATED", "COMPENSATION_FAILED"].includes(stage.status),
  );
}

// EMPLOYEE_CONFIRMATION (stage 8) is never an actionable control for the employee.
export function isActionableStage(stageCode: string): boolean {
  return stageCode !== "EMPLOYEE_CONFIRMATION";
}

export type PortalRole = "EMPLOYEE" | "LINE_MANAGER" | "RECEIVING_MANAGER" | "HR_BUSINESS_PARTNER";

// G2-F02: the portal lays out navigation from the server-resolved role list returned by /me,
// not from anything encoded in the bearer token.
export function roleFromList(roles: string[]): PortalRole {
  if (roles.includes("HR_BUSINESS_PARTNER")) return "HR_BUSINESS_PARTNER";
  if (roles.includes("RECEIVING_MANAGER")) return "RECEIVING_MANAGER";
  if (roles.includes("LINE_MANAGER")) return "LINE_MANAGER";
  return "EMPLOYEE";
}
