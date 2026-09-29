import { useEffect, useState } from "react";
import { Button } from "./components/ui/button.tsx";
import { RequestDetailView, RequestList, Wizard, type TransferDetail } from "./features/internal-transfer/screens.tsx";
import { copy } from "./features/internal-transfer-approval/inbox.ts";
import { ApprovalInbox, Decision } from "./features/internal-transfer-approval/screens.tsx";
import type { DecisionView, InboxItem } from "./features/internal-transfer-approval/inbox.ts";

const API = "http://localhost:3001";

type Role = "EMPLOYEE" | "LINE_MANAGER" | "RECEIVING_MANAGER" | "HR_BUSINESS_PARTNER";
type Session = { token: string; label: string; role: Role };

const sessions: Session[] = [
  { token: "emp-1", label: "Employee", role: "EMPLOYEE" },
  { token: "mgr-line|LINE_MANAGER", label: "Line manager", role: "LINE_MANAGER" },
  { token: "mgr-recv|RECEIVING_MANAGER", label: "Receiving manager", role: "RECEIVING_MANAGER" },
  { token: "hr-1|HR_BUSINESS_PARTNER", label: "HR", role: "HR_BUSINESS_PARTNER" },
];

async function api(path: string, token: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...init, headers });
  const body = await response.json().catch(() => ({}));
  return { status: response.status, body };
}

export function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [area, setArea] = useState<"requests" | "approvals">("requests");
  if (!session) {
    return (
      <main className="mx-auto min-h-screen max-w-md space-y-4 bg-[#121418] p-8 text-gray-200">
        <h1 className="text-2xl font-semibold text-white">{copy.signIn}</h1>
        <div className="flex flex-col gap-2">
          {sessions.map((item) => (
            <Button key={item.token} type="button" onClick={() => { setSession(item); setArea(item.role === "EMPLOYEE" ? "requests" : "approvals"); }}>
              {item.label}
            </Button>
          ))}
        </div>
      </main>
    );
  }
  return (
    <div className="min-h-screen bg-[#121418] text-[#e5e7eb]">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <div className="overflow-hidden rounded-lg border border-[#2a2e36] bg-[#181b20] shadow-2xl">
          <Shell
            active={area}
            role={session.role}
            onNavigate={setArea}
            onSignOut={() => setSession(null)}
            token={session.token}
          />
          <main className="p-6 sm:p-8">
            {session.role === "EMPLOYEE"
              ? <Employee token={session.token} />
              : <Approver token={session.token} />}
          </main>
        </div>
      </div>
    </div>
  );
}

function Shell({
  role,
  token,
  onSignOut,
}: {
  active: "requests" | "approvals";
  role: Role;
  token: string;
  onNavigate: (area: "requests" | "approvals") => void;
  onSignOut: () => void;
}) {
  const approver = role !== "EMPLOYEE";
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!approver) return;
    void api("/api/v1/internal-transfers/approvals", token).then((response) => {
      setCount(Number(response.body.totalItems ?? 0));
    });
  }, [token, approver]);
  return (
    <header className="flex items-center justify-between border-b border-[#2a2e36] bg-[#15171c] px-6 py-3.5 text-sm">
      <div className="flex items-center gap-6">
        <p className="font-semibold text-white">OnePoint</p>
        {approver ? (
          <span className="flex items-center gap-1.5 border-b-2 border-slate-300 py-1 font-medium text-white">
            Approvals Inbox
            {count !== null ? <span className="rounded-full border border-[#3b414f] bg-[#272b35] px-1.5 text-[11px] text-gray-300">{count}</span> : null}
          </span>
        ) : (
          <span className="border-b-2 border-slate-300 py-1 font-medium text-white">My Transfer Requests</span>
        )}
      </div>
      <Button type="button" variant="ghost" onClick={onSignOut}>Sign out</Button>
    </header>
  );
}

function Employee({ token }: { token: string }) {
  const [list, setList] = useState<Array<{ requestId: string; referenceNo: string; statusDisplay: string; pendingWith?: string | null; requestedEffectiveDate?: string | null; effectiveDateStatus?: string | null }>>([]);
  const [detail, setDetail] = useState<TransferDetail | null>(null);
  const [wizard, setWizard] = useState<{ requestId: string; version: number; step: 1 | 2 | 3 | 4; date: string; reason: string } | null>(null);
  const [message, setMessage] = useState("");

  async function refresh() {
    const response = await api("/api/v1/internal-transfers", token);
    setList(response.body.items ?? []);
  }

  useEffect(() => { void refresh(); }, [token]);

  async function start() {
    const created = await api("/api/v1/internal-transfers", token, { method: "POST", body: "{}" });
    if (created.status !== 201) {
      setMessage(created.body.type ?? "Could not create a draft");
      return;
    }
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + 30);
    setWizard({ requestId: created.body.requestId, version: created.body.version, step: 1, date: date.toISOString().slice(0, 10), reason: "" });
    setDetail(null);
    setMessage("");
  }

  async function saveAndSubmit() {
    if (!wizard) return;
    const updated = await api(`/api/v1/internal-transfers/${wizard.requestId}`, token, {
      method: "PUT",
      headers: { "If-Match": `"${wizard.version}"` },
      body: JSON.stringify({
        targetDepartmentId: "d2",
        targetLocationId: "l2",
        targetPositionId: "p-open",
        requestedEffectiveDate: wizard.date,
        reason: wizard.reason || undefined,
      }),
    });
    if (updated.status !== 200) {
      setMessage(updated.body.type ?? "Could not save the draft");
      return;
    }
    const submitted = await api(`/api/v1/internal-transfers/${wizard.requestId}/submit`, token, {
      method: "POST",
      headers: { "Idempotency-Key": crypto.randomUUID() },
    });
    setMessage(submitted.status === 200 ? "Submitted" : String(submitted.body.type ?? submitted.status));
    setWizard(null);
    await refresh();
  }

  async function withdraw() {
    if (!detail) return;
    const response = await api(`/api/v1/internal-transfers/${detail.requestId}/withdraw`, token, {
      method: "POST",
      headers: { "If-Match": `"${detail.version}"` },
      body: "{}",
    });
    setMessage(response.status === 200 ? "Withdrawn" : String(response.body.type ?? response.status));
    setDetail(null);
    await refresh();
  }

  if (wizard) {
    return (
      <Wizard
        step={wizard.step}
        date={wizard.date}
        reason={wizard.reason}
        message={message}
        onDate={(date) => setWizard({ ...wizard, date })}
        onReason={(reason) => setWizard({ ...wizard, reason })}
        onBack={() => wizard.step === 1 ? setWizard(null) : setWizard({ ...wizard, step: (wizard.step - 1) as 1 | 2 | 3 | 4 })}
        onNext={() => setWizard({ ...wizard, step: (wizard.step + 1) as 1 | 2 | 3 | 4 })}
        onSubmit={() => void saveAndSubmit()}
      />
    );
  }
  if (detail) return <RequestDetailView detail={detail} onWithdraw={() => void withdraw()} />;
  return (
    <RequestList
      items={list}
      message={message}
      onNew={() => void start()}
      onOpen={async (requestId) => {
        const response = await api(`/api/v1/internal-transfers/${requestId}`, token);
        setDetail(response.body);
      }}
    />
  );
}

function Approver({ token }: { token: string }) {
  const [items, setItems] = useState<InboxItem[]>([]);
  const [view, setView] = useState<DecisionView | null>(null);
  const [message, setMessage] = useState("");
  const hr = token.endsWith("HR_BUSINESS_PARTNER");

  async function refresh() {
    const response = await api("/api/v1/internal-transfers/approvals", token);
    setItems(response.body.items ?? []);
  }

  useEffect(() => { void refresh(); }, [token]);

  async function decide(decision: "APPROVE" | "REJECT", date: string) {
    if (!view) return;
    if (hr && decision === "APPROVE" && !date) {
      setMessage(copy.missingDate);
      return;
    }
    const stage = items.find((item) => item.requestId === view.requestId)?.stageCode ?? "";
    const response = await api(`/api/v1/internal-transfers/${view.requestId}/stages/${stage}/decision`, token, {
      method: "POST",
      headers: { "If-Match": `"${view.version}"`, "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ decision, confirmedEffectiveDate: hr && decision === "APPROVE" ? date : null }),
    });
    if (response.status === 409 && response.body.type === "version-conflict") setMessage(copy.conflict);
    else if (response.status === 422) setMessage(copy.missingDate);
    else setMessage(response.status === 200 ? "Recorded" : String(response.body.type ?? response.status));
    setView(null);
    await refresh();
  }

  if (view) {
    return (
      <Decision
        view={view}
        hr={hr}
        message={message}
        onApprove={(date) => void decide("APPROVE", date)}
        onReject={() => void decide("REJECT", "")}
      />
    );
  }
  return (
    <ApprovalInbox
      items={items}
      onOpen={async (requestId) => {
        const response = await api(`/api/v1/internal-transfers/${requestId}/approval`, token);
        setView(response.body);
        setMessage("");
      }}
    />
  );
}
