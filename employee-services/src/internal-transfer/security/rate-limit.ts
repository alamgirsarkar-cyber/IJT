import { createHash } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

// G2-F03: rate-limit counters live in SQLite (constitution: approved datastore for
// rate-limit counters), so they survive a restart and are shared across workers that open
// the same database file. AC17: the counter key is a salted hash of the subject, never the
// raw employee identifier.

const WINDOW_MS = 3_600_000;
const SALT = "itr-rate-limit:v1";

export function counterKey(bucket: string, subject: string): string {
  return createHash("sha256").update(`${SALT}:${bucket}:${subject}`).digest("hex");
}

export function enforceRateLimit(
  db: DatabaseSync,
  bucket: string,
  subject: string,
  max: number,
  now: number = Date.now(),
): { limited: boolean } {
  const key = counterKey(bucket, subject);
  const row = db
    .prepare("SELECT window_start AS windowStart, count FROM rate_limit_counter WHERE counter_key = ?")
    .get(key) as { windowStart: number; count: number } | undefined;
  if (!row || now - row.windowStart >= WINDOW_MS) {
    db.prepare(
      `INSERT INTO rate_limit_counter (counter_key, window_start, count) VALUES (?, ?, 1)
       ON CONFLICT(counter_key) DO UPDATE SET window_start = excluded.window_start, count = 1`,
    ).run(key, now);
    return { limited: false };
  }
  const next = row.count + 1;
  db.prepare("UPDATE rate_limit_counter SET count = ? WHERE counter_key = ?").run(next, key);
  return { limited: next > max };
}
