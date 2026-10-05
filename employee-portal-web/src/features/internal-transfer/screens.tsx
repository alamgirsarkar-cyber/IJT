import { Alert } from "../../components/ui/alert.tsx";
import { Badge } from "../../components/ui/badge.tsx";
import { Button } from "../../components/ui/button.tsx";
import { Card } from "../../components/ui/card.tsx";
import { Input, Textarea } from "../../components/ui/input.tsx";
import { advisoryTone, canWithdraw, stageText } from "./logic.ts";

export type TransferDetail = {
  requestId: string;
  referenceNo: string;
  version: number;
  status: string;
  statusDisplay: string;
  requestedEffectiveDate?: string;
  effectiveDateStatus?: string;
  reason?: string | null;
  currentAssignment?: { departmentName?: string; locationName?: string; positionTitle?: string };
  target?: { departmentId?: string; locationId?: string; positionId?: string };
  pendingWith?: { role?: string; partyName?: string | null } | null;
  advisories?: Array<{ code: string }>;
  stages?: Array<{
    stageCode: string;
    sequence: number;
    status: string;
    applicable: boolean;
    assignedPartyName?: string | null;
  }>;
};

const stageLabel: Record<string, string> = {
  MANAGER_RELEASE: "Manager release",
  MANAGER_ACCEPT: "Receiving manager",
  HR_VALIDATION: "HR validation",
  ORG_DATA_UPDATE: "Organisation data",
  PAYROLL_UPDATE: "Payroll",
  IT_ACCESS: "Access",
  FACILITIES: "Facilities",
  EMPLOYEE_CONFIRMATION: "Employee confirmation",
};

const advisoryCopy: Record<string, { title: string; body: string }> = {
  PAYROLL_CYCLE_MISALIGNED: {
    title: "Payroll cycle",
    body: "The requested date is not the first of the month. Payroll may need an extra check.",
  },
  HR_CHECKS_FURTHER: {
    title: "HR will check further",
    body: "Submitting does not approve the transfer. HR still validates eligibility.",
  },
};

export function RequestList({
  items,
  message,
  onNew,
  onOpen,
}: {
  items: Array<{ requestId: string; referenceNo: string; statusDisplay: string; pendingWith?: string | null; requestedEffectiveDate?: string | null; effectiveDateStatus?: string | null }>;
  message: string;
  onNew: () => void;
  onOpen: (requestId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <h1 className="text-xl font-semibold text-white">My Transfer Requests</h1>
        <Button type="button" variant="outline" onClick={onNew}>New request</Button>
      </div>
      <p role="status" className="text-xs text-[#9aa2b1]">{message}</p>
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[#2a2e36] text-xs uppercase tracking-wider text-[#9aa2b1]">
            <th className="py-3 pr-6 font-medium">Reference</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Pending with</th>
            <th className="py-3 pl-6 font-medium">Effective date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[#2a2e36]">
          {items.map((item) => (
            <tr key={item.requestId} className="text-gray-300">
              <td className="py-4 pr-6">
                <button type="button" className="text-gray-200" onClick={() => onOpen(item.requestId)}>{item.referenceNo}</button>
              </td>
              <td className="px-6 py-4">{item.statusDisplay}</td>
              <td className="px-6 py-4">{item.pendingWith ?? "—"}</td>
              <td className="py-4 pl-6">
                {item.requestedEffectiveDate ?? "—"}
                {item.effectiveDateStatus ? <span className="text-[#9aa2b1]"> · {item.effectiveDateStatus === "CONFIRMED" ? "Confirmed" : "Requested"}</span> : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#22252e] pt-4 text-xs text-[#9aa2b1]">Reason text is not on this list.</p>
    </div>
  );
}

export function Wizard({
  step,
  date,
  reason,
  message,
  onDate,
  onReason,
  onBack,
  onNext,
  onSubmit,
}: {
  step: 1 | 2 | 3 | 4;
  date: string;
  reason: string;
  message: string;
  onDate: (value: string) => void;
  onReason: (value: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  const titles = ["Target", "Effective date", "Reason", "Review"];
  const payroll = date.slice(8, 10) !== "" && date.slice(8, 10) !== "01";
  return (
    <div className="max-w-3xl space-y-5">
      <h1 className="text-xl font-semibold text-white">New transfer · {titles[step - 1]}</h1>
      <p className="text-xs text-neutral-400">Step {step} of 4</p>
      {step === 1 ? (
        <Card>
          <h2 className="font-medium">Open position</h2>
          <p>Operations · Analyst · Site B</p>
        </Card>
      ) : null}
      {step === 2 ? (
        <label className="block space-y-2 text-sm">
          Requested effective date
          <Input type="date" value={date} onChange={(event) => onDate(event.target.value)} />
        </label>
      ) : null}
      {step === 2 && payroll ? <Alert tone="warning" title={advisoryCopy.PAYROLL_CYCLE_MISALIGNED.title}>{advisoryCopy.PAYROLL_CYCLE_MISALIGNED.body}</Alert> : null}
      {step === 3 ? (
        <label className="block space-y-2 text-sm">
          Why are you requesting this transfer?
          <Textarea value={reason} onChange={(event) => onReason(event.target.value)} />
        </label>
      ) : null}
      {step === 4 ? (
        <Card>
          <p>Operations · Analyst · Site B</p>
          <p>Effective date {date}</p>
          <p>{reason ? "Reason recorded" : "No reason"}</p>
        </Card>
      ) : null}
      {step === 4 ? <Alert title={advisoryCopy.HR_CHECKS_FURTHER.title}>{advisoryCopy.HR_CHECKS_FURTHER.body}</Alert> : null}
      <p role="status" className="text-sm">{message}</p>
      <div className="flex gap-2">
        <Button type="button" variant="outline" onClick={onBack}>Back</Button>
        {step < 4 ? <Button type="button" onClick={onNext}>Continue</Button> : <Button type="button" onClick={onSubmit}>Submit</Button>}
      </div>
    </div>
  );
}

export function RequestDetailView({ detail, onWithdraw }: { detail: TransferDetail; onWithdraw: () => void }) {
  const stages = detail.stages ?? [];
  const active = stages.find((stage) => stage.status === "IN_PROGRESS");
  const pending = detail.pendingWith;
  const withdrawable = canWithdraw(detail.status);
  return (
    <article aria-label="Internal transfer request" className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold text-white">{detail.referenceNo}</h1>
          <Badge>{`v${detail.version}`}</Badge>
        </div>
        {withdrawable ? <Button type="button" variant="outline" onClick={onWithdraw}>Withdraw</Button> : null}
      </div>
      <p className="text-sm text-[#9da1aa]">{detail.statusDisplay} · Pending with {pending?.partyName ?? pending?.role ?? "Nobody"}</p>
      <p className="text-xs text-[#9aa0aa]">Active stage: {active ? stageLabel[active.stageCode] ?? active.stageCode : "None"}</p>
      {(detail.advisories ?? []).map((item) => {
        const text = advisoryCopy[item.code];
        return text ? <Alert key={item.code} tone={advisoryTone(item.code)} title={text.title}>{text.body}</Alert> : null;
      })}
      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <h2 className="mb-2 border-b border-[#25272e] pb-1 text-sm font-semibold text-white">Current</h2>
          <p>{detail.currentAssignment?.departmentName}</p>
          <p>{detail.currentAssignment?.positionTitle}</p>
          <p>{detail.currentAssignment?.locationName}</p>
        </Card>
        <Card>
          <h2 className="mb-2 border-b border-[#25272e] pb-1 text-sm font-semibold text-white">Requested</h2>
          <p>{detail.target?.departmentId}</p>
          <p>{detail.target?.positionId}</p>
          <p>{detail.target?.locationId}</p>
        </Card>
      </div>
      <p>Effective date {detail.requestedEffectiveDate ?? "Not set"} · {detail.effectiveDateStatus}</p>
      {detail.reason ? (
        <Card>
          <h2 className="mb-1 text-xs font-semibold text-white">Your reason</h2>
          <p>{detail.reason}</p>
        </Card>
      ) : null}
      <h2 className="text-sm font-semibold text-white">Stages</h2>
      <table className="w-full text-left text-xs">
        <tbody className="divide-y divide-[#202227] text-[#9da2ac]">
          {stages.map((stage) => (
            <tr key={stage.stageCode}>
              <td className="w-8 py-2 pr-3 font-mono text-[#686c75]">{stage.sequence}</td>
              <td className="py-2 pr-4 font-medium text-white">{stageLabel[stage.stageCode] ?? stage.stageCode}</td>
              <td className="py-2 pr-4">{stageText(stage)}</td>
              <td className="py-2">{stage.assignedPartyName ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-[#23252a] pt-4 text-[11px] text-[#717680]">Stage 8 is a row, not a button. A name appears only for your own line manager. Status is written out, not colour alone.</p>
    </article>
  );
}
