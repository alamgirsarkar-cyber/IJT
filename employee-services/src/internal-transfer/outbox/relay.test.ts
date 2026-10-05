import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { openDatabase } from "../api/app.ts";
import { relayOnce } from "./relay.ts";

function dbPath(): string {
  return join(mkdtempSync(join(tmpdir(), "relay-")), "app.sqlite");
}

test("G2-F08 a publish failure records the error class, never the message text", async () => {
  const db = openDatabase(dbPath());
  db.prepare(
    `INSERT INTO transfer_request_outbox (id, aggregate_id, event_type, payload, created_at, attempts)
     VALUES ('o1','r1','employee.transfer.requested.v1','{"payload":{"requestId":"r1"}}','2026-09-24T00:00:00Z',0)`,
  ).run();
  await relayOnce(
    db,
    async () => {
      // A downstream error whose message carries exactly the kind of text that must never persist.
      throw new Error("relocating employee Elena Vance, reason: closer to family in Pune");
    },
    "http://downstream.example/hooks",
    Date.parse("2026-09-24T00:00:01Z"),
  );
  const row = db.prepare("SELECT last_error AS lastError FROM transfer_request_outbox WHERE id = 'o1'").get() as {
    lastError: string;
  };
  assert.equal(row.lastError, "Error");
  assert.equal(row.lastError.includes("Pune"), false);
  assert.equal(row.lastError.includes("reason"), false);
  assert.equal(row.lastError.includes("Elena"), false);
});
