export type InboxItem = {
  requestId: string;
  referenceNo: string;
  stageCode: string;
  requestStatus: string;
  waitingSince?: string;
};

export type DecisionView = {
  requestId: string;
  referenceNo?: string;
  version: number;
  status: string;
  reason?: string;
};

export const copy = {
  inboxTitle: "Transfers waiting for you",
  approve: "Approve",
  reject: "Reject",
  confirmedDate: "Confirmed effective date",
  missingDate: "Enter the confirmed effective date",
  conflict: "This request changed elsewhere. Reload it before deciding.",
  signIn: "Sign in",
};

export function managerSeesReason(view: DecisionView): boolean {
  return "reason" in view;
}
