import type { DatabaseSync } from "node:sqlite";

const ALLOWED = [
  "requestId",
  "referenceNo",
  "employeeId",
  "currentDepartmentId",
  "currentLocationId",
  "currentPositionId",
  "currentGrade",
  "currentCostCentre",
  "targetDepartmentId",
  "targetLocationId",
  "targetPositionId",
  "targetGrade",
  "targetCostCentre",
  "requestedEffectiveDate",
  "applicableStageCodes",
  "submittedAt",
  "withdrawnAt",
  "correlationId",
] as const;

export function allowListPayload(source: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const key of ALLOWED) {
    if (key in source) payload[key] = source[key];
  }
  return payload;
}

export type PublishResult = { published: string[]; alerted: string[] };

export async function relayOnce(
  db: DatabaseSync,
  post: (url: string, body: unknown) => Promise<void>,
  webhookUrl: string,
  now = Date.now(),
): Promise<PublishResult> {
  const rows = db
    .prepare(
      `SELECT id, event_type, payload, created_at, attempts
       FROM transfer_request_outbox
       WHERE published_at IS NULL
       ORDER BY created_at ASC, id ASC`,
    )
    .all() as Array<{
    id: string;
    event_type: string;
    payload: string;
    created_at: string;
    attempts: number;
  }>;
  const published: string[] = [];
  const alerted: string[] = [];
  for (const row of rows) {
    const ageMs = now - Date.parse(row.created_at);
    const wait = Math.min(60_000, 1000 * 2 ** row.attempts);
    if (row.attempts > 0 && ageMs < wait) continue;
    if (ageMs > 15 * 60 * 1000) alerted.push(row.id);
    try {
      const body = JSON.parse(row.payload) as unknown;
      await post(webhookUrl, body);
      db.prepare(
        "UPDATE transfer_request_outbox SET published_at = ?, attempts = attempts + 1 WHERE id = ?",
      ).run(new Date(now).toISOString(), row.id);
      published.push(row.id);
    } catch (error) {
      // G2-F08: persist the error class only, never error.message. Downstream error text can
      // carry names, identifiers or reason text; the class is enough to triage a stuck row.
      const code = error instanceof Error && error.name ? error.name : "PublishError";
      db.prepare(
        "UPDATE transfer_request_outbox SET attempts = attempts + 1, last_error = ? WHERE id = ?",
      ).run(code.slice(0, 80), row.id);
    }
  }
  return { published, alerted };
}
