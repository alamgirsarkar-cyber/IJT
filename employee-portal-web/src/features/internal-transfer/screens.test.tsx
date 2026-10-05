import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { axe } from "jest-axe";
import { RequestDetailView, RequestList, Wizard, type TransferDetail } from "./screens.tsx";

// G2-F10: logic-bearing render/interaction tests for the transfer screens (not snapshots),
// plus an automated axe pass per screen. `region` is disabled because these render isolated
// component fragments, not a full landmarked page.
const axeRules = { rules: { region: { enabled: false } } };

const detail: TransferDetail = {
  requestId: "r1",
  referenceNo: "ITR-2026-000001",
  version: 3,
  status: "MANAGER_REVIEW",
  statusDisplay: "With your manager",
  requestedEffectiveDate: "2026-07-01",
  effectiveDateStatus: "REQUESTED",
  reason: "My recorded reason",
  currentAssignment: { departmentName: "Operations", locationName: "Site A", positionTitle: "Analyst" },
  target: { departmentId: "Engineering", locationId: "Site B", positionId: "Senior Analyst" },
  pendingWith: { role: "LINE_MANAGER", partyName: "Line manager" },
  advisories: [{ code: "HR_CHECKS_FURTHER" }],
  stages: [
    { stageCode: "MANAGER_RELEASE", sequence: 1, status: "IN_PROGRESS", applicable: true, assignedPartyName: "Line manager" },
    { stageCode: "PAYROLL_UPDATE", sequence: 5, status: "NOT_STARTED", applicable: false },
  ],
};

describe("RequestList", () => {
  it("opens a request and starts a new one", async () => {
    const onOpen = vi.fn();
    const onNew = vi.fn();
    render(
      <RequestList
        items={[{
          requestId: "r1",
          referenceNo: "ITR-2026-000001",
          statusDisplay: "With your manager",
          pendingWith: "Line manager",
          requestedEffectiveDate: "2026-07-01",
          effectiveDateStatus: "REQUESTED",
        }]}
        message="1 request"
        onNew={onNew}
        onOpen={onOpen}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "ITR-2026-000001" }));
    expect(onOpen).toHaveBeenCalledWith("r1");
    await userEvent.click(screen.getByRole("button", { name: "New request" }));
    expect(onNew).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Reason text is not on this list.")).toBeInTheDocument();
  });

  it("shows an em dash when nobody is pending", () => {
    render(
      <RequestList
        items={[{ requestId: "r2", referenceNo: "ITR-2026-000002", statusDisplay: "Completed", pendingWith: null }]}
        message=""
        onNew={() => {}}
        onOpen={() => {}}
      />,
    );
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("has no accessibility violations", async () => {
    const { container } = render(
      <RequestList items={[]} message="No requests" onNew={() => {}} onOpen={() => {}} />,
    );
    const results = await axe(container, axeRules);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("Wizard", () => {
  const noop = () => {};

  it("flags a payroll-misaligned date at step 2 and clears it for an aligned one", () => {
    const { rerender } = render(
      <Wizard step={2} date="2026-06-15" reason="" message="" onDate={noop} onReason={noop} onBack={noop} onNext={noop} onSubmit={noop} />,
    );
    expect(screen.getByText("Payroll cycle")).toBeInTheDocument();
    rerender(
      <Wizard step={2} date="2026-06-01" reason="" message="" onDate={noop} onReason={noop} onBack={noop} onNext={noop} onSubmit={noop} />,
    );
    expect(screen.queryByText("Payroll cycle")).not.toBeInTheDocument();
  });

  it("advances, goes back, captures the date and submits on the last step", async () => {
    const onNext = vi.fn();
    const onBack = vi.fn();
    const onDate = vi.fn();
    const onSubmit = vi.fn();
    const { rerender } = render(
      <Wizard step={2} date="" reason="" message="" onDate={onDate} onReason={noop} onBack={onBack} onNext={onNext} onSubmit={onSubmit} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(onNext).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(onBack).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByLabelText(/Requested effective date/i), { target: { value: "2026-07-01" } });
    expect(onDate).toHaveBeenCalledWith("2026-07-01");

    rerender(
      <Wizard step={4} date="2026-07-01" reason="Growth" message="" onDate={onDate} onReason={noop} onBack={onBack} onNext={onNext} onSubmit={onSubmit} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Submit" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("has no accessibility violations on the date step", async () => {
    const { container } = render(
      <Wizard step={2} date="2026-06-15" reason="" message="" onDate={noop} onReason={noop} onBack={noop} onNext={noop} onSubmit={noop} />,
    );
    const results = await axe(container, axeRules);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});

describe("RequestDetailView", () => {
  it("offers withdraw while the request is with the manager and renders stage state", async () => {
    const onWithdraw = vi.fn();
    render(<RequestDetailView detail={detail} onWithdraw={onWithdraw} />);
    await userEvent.click(screen.getByRole("button", { name: "Withdraw" }));
    expect(onWithdraw).toHaveBeenCalledTimes(1);
    expect(screen.getByText("My recorded reason")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument(); // MANAGER_RELEASE
    expect(screen.getByText("Not required")).toBeInTheDocument(); // PAYROLL not applicable
  });

  it("hides withdraw once the request is in fulfilment", () => {
    render(<RequestDetailView detail={{ ...detail, status: "FULFILMENT" }} onWithdraw={() => {}} />);
    expect(screen.queryByRole("button", { name: "Withdraw" })).not.toBeInTheDocument();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<RequestDetailView detail={detail} onWithdraw={() => {}} />);
    const results = await axe(container, axeRules);
    expect(results.violations.map((violation) => violation.id)).toEqual([]);
  });
});
