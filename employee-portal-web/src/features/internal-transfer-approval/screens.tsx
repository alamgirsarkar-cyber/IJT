import { useState } from "react";
import { Button } from "../../components/ui/button.tsx";
import { Card } from "../../components/ui/card.tsx";
import { Input } from "../../components/ui/input.tsx";
import { copy, type DecisionView, type InboxItem } from "./inbox.ts";

const stageLabel: Record<string, string> = {
  MANAGER_RELEASE: "Manager release",
  MANAGER_ACCEPT: "Receiving manager",
  HR_VALIDATION: "HR validation",
};

export function ApprovalInbox({ items, onOpen }: { items: InboxItem[]; onOpen: (requestId: string) => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Approvals Inbox</h1>
        <p className="text-xs text-[#8a8a8a]">Badge in the shell is this list’s total.</p>
      </div>
      <table className="w-full text-left text-sm">
        <thead>
          <tr>
            <th className="pb-3 pr-6 font-semibold text-white">Reference</th>
            <th className="px-6 pb-3 font-semibold text-white">Stage</th>
            <th className="px-6 pb-3 font-semibold text-white">Employee</th>
            <th className="pb-3 pl-6 font-semibold text-white">Waiting since</th>
          </tr>
        </thead>
        <tbody className="text-sm text-[#cecece]">
          {items.map((item) => (
            <tr key={item.requestId}>
              <td className="py-3.5 pr-6 font-mono">
                <button type="button" className="text-[#dcdcdc]" onClick={() => onOpen(item.requestId)}>{item.referenceNo}</button>
              </td>
              <td className="px-6 py-3.5">{stageLabel[item.stageCode] ?? item.stageCode}</td>
              <td className="px-6 py-3.5">Employee</td>
              <td className="py-3.5 pl-6">{item.waitingSince ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function Decision({
  view,
  hr,
  message,
  onApprove,
  onReject,
}: {
  view: DecisionView;
  hr: boolean;
  message: string;
  onApprove: (date: string) => void;
  onReject: () => void;
}) {
  const [date, setDate] = useState("");
  const reference = view.referenceNo ?? view.requestId;
  return (
    <div className="space-y-5">
      <h1 className="text-lg font-semibold text-zinc-100">{hr ? "Validate" : "Release"} {reference}</h1>
      {hr && view.reason ? (
        <Card>
          <h2 className="text-xs font-semibold text-neutral-200">Employee reason</h2>
          <p className="text-xs text-neutral-300">{view.reason}</p>
          <p className="pt-1 text-[11px] text-neutral-500">Rendered from the response. Not stored in the page state, URL, or browser storage.</p>
        </Card>
      ) : null}
      {!hr ? (
        <div>
          <p className="text-sm font-medium text-zinc-300">Reason hidden</p>
          <p className="text-xs text-zinc-400">The manager response has no reason field. This screen does not show the narrative.</p>
        </div>
      ) : null}
      {hr ? (
        <label className="block text-xs text-neutral-400">
          {copy.confirmedDate}
          <Input aria-label={copy.confirmedDate} className="mt-2" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
      ) : null}
      <p role="status" className="text-xs text-neutral-300">{message}</p>
      <div className="flex gap-2">
        <Button type="button" onClick={() => onApprove(date)}>{hr ? copy.approve : "Approve release"}</Button>
        <Button type="button" variant="outline" onClick={onReject}>{copy.reject}</Button>
      </div>
    </div>
  );
}
