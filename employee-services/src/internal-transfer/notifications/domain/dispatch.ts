import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

export const SUBSCRIBED = [
  "employee.transfer.requested.v1",
  "employee.transfer.stage-pending.v1",
  "employee.transfer.rejected.v1",
  "employee.transfer.approved.v1",
  "employee.transfer.withdrawn.v1",
  "employee.transfer.completed.v1",
] as const;

const SILENT = new Set([
  "employee.transfer.fulfilment-failed.v1",
  "employee.transfer.fulfilment-stage.v1",
  "employee.transfer.compensate.v1",
]);

const ALLOWED_DATA = ["referenceNo", "requestId", "stageCode"] as const;

export type Notice = {
  eventId: string;
  eventType: string;
  requestId: string;
  employeeId: string;
  referenceNo: string;
  stageCode?: string;
  lineManagerRef?: string | null;
  receivingManagerRef?: string | null;
  reason?: string;
};

type Row = { status: string; stage_code: string };

export function ensureNotificationSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS notification_ingress (
      event_id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      request_id TEXT NOT NULL,
      received_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS notification_dispatch (
      id TEXT PRIMARY KEY,
      request_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      stage_code TEXT NOT NULL,
      template_id TEXT NOT NULL,
      recipient_ref TEXT NOT NULL,
      window_start TEXT NOT NULL,
      status TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      data TEXT NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_notification_dispatch
      ON notification_dispatch (request_id, event_type, stage_code, template_id, recipient_ref, window_start);
  `);
}

export function handleNotice(db: DatabaseSync, notice: Notice, requestStatus?: string): number {
  ensureNotificationSchema(db);
  if (!notice.eventType.endsWith(".v1") || SILENT.has(notice.eventType) || !SUBSCRIBED.includes(notice.eventType as (typeof SUBSCRIBED)[number])) {
    return 0;
  }
  const seen = db.prepare("SELECT 1 AS hit FROM notification_ingress WHERE event_id = ?").get(notice.eventId) as { hit: number } | undefined;
  if (seen) return 0;
  const window = new Date().toISOString().slice(0, 13);
  const rows = recipients(notice, db, requestStatus);
  db.exec("BEGIN");
  db.prepare("INSERT INTO notification_ingress (event_id, event_type, request_id, received_at) VALUES (?,?,?,?)").run(
    notice.eventId, notice.eventType, notice.requestId, new Date().toISOString(),
  );
  for (const row of rows) {
    db.prepare(
      `INSERT OR IGNORE INTO notification_dispatch (
        id, request_id, event_type, stage_code, template_id, recipient_ref, window_start, status, attempts, data
      ) VALUES (?,?,?,?,?,?,?,?,0,?)`,
    ).run(randomUUID(), notice.requestId, notice.eventType, row.stageCode, row.templateId, row.recipientRef, window, row.status, JSON.stringify(allow(notice, row.stageCode)));
  }
  db.exec("COMMIT");
  return rows.filter((row) => row.status === "PENDING").length;
}

function recipients(notice: Notice, db: DatabaseSync, requestStatus?: string): Array<{ templateId: string; recipientRef: string; stageCode: string; status: string }> {
  const stage = notice.stageCode ?? "";
  if (notice.eventType === "employee.transfer.requested.v1") {
    const rows = [{ templateId: "itr.employee.submitted", recipientRef: `employee:${notice.employeeId}`, stageCode: "", status: "PENDING" }];
    if (notice.lineManagerRef) {
      rows.push({ templateId: "itr.approver.pending", recipientRef: `employee:${notice.lineManagerRef}`, stageCode: "MANAGER_RELEASE", status: "PENDING" });
    }
    return rows;
  }
  if (notice.eventType === "employee.transfer.stage-pending.v1") {
    let current: Row | undefined;
    try {
      current = db.prepare("SELECT status, stage_code FROM transfer_request_stage WHERE transfer_request_id = ? AND status = 'IN_PROGRESS'").get(notice.requestId) as Row | undefined;
    } catch {
      current = undefined;
    }
    const stale = requestStatus === "WITHDRAWN" || requestStatus === "REJECTED" || (current && notice.stageCode && current.stage_code !== notice.stageCode);
    const ref = notice.stageCode === "HR_VALIDATION"
      ? "role:HR_BUSINESS_PARTNER"
      : `employee:${notice.stageCode === "MANAGER_ACCEPT" ? notice.receivingManagerRef : notice.lineManagerRef}`;
    return [{ templateId: "itr.approver.pending", recipientRef: ref, stageCode: stage, status: stale ? "SKIPPED" : "PENDING" }];
  }
  const template = notice.eventType.includes("rejected")
    ? "itr.employee.rejected"
    : notice.eventType.includes("withdrawn")
      ? "itr.employee.withdrawn"
      : notice.eventType.includes("completed")
        ? "itr.employee.completed"
        : "itr.employee.hr-approved";
  return [{ templateId: template, recipientRef: `employee:${notice.employeeId}`, stageCode: "", status: "PENDING" }];
}

function allow(notice: Notice, stageCode: string): Record<string, string> {
  const data: Record<string, string> = { referenceNo: notice.referenceNo, requestId: notice.requestId };
  if (stageCode) data.stageCode = stageCode;
  for (const key of Object.keys(data)) {
    if (!ALLOWED_DATA.includes(key as (typeof ALLOWED_DATA)[number])) delete data[key];
  }
  return data;
}

export type PlatformResponse = { status: number };

export async function relayDispatches(
  db: DatabaseSync,
  send: (body: Record<string, unknown>) => Promise<PlatformResponse>,
): Promise<void> {
  ensureNotificationSchema(db);
  const rows = db.prepare("SELECT * FROM notification_dispatch WHERE status = 'PENDING' AND attempts < 5").all() as Array<Record<string, unknown>>;
  for (const row of rows) {
    const wait = Math.min(300_000, 1000 * 2 ** Number(row.attempts));
    if (Number(row.attempts) > 0 && wait > 1000 && process.env.NOTIFY_FAST !== "1") continue;
    const body = {
      templateId: row.template_id,
      locale: "en",
      recipient: { ref: row.recipient_ref },
      data: JSON.parse(String(row.data)),
    };
    try {
      const response = await send(body);
      if (response.status >= 200 && response.status < 300) {
        db.prepare("UPDATE notification_dispatch SET status = 'SENT', attempts = attempts + 1 WHERE id = ?").run(row.id);
      } else if (response.status === 429 || response.status >= 500) {
        const attempts = Number(row.attempts) + 1;
        db.prepare("UPDATE notification_dispatch SET status = ?, attempts = ? WHERE id = ?").run(attempts >= 5 ? "UNDELIVERABLE" : "PENDING", attempts, row.id);
      } else {
        db.prepare("UPDATE notification_dispatch SET status = 'UNDELIVERABLE', attempts = attempts + 1 WHERE id = ?").run(row.id);
      }
    } catch {
      db.prepare("UPDATE notification_dispatch SET attempts = attempts + 1 WHERE id = ?").run(row.id);
    }
  }
}
