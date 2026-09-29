import { DatabaseSync } from "node:sqlite";

export function migrate(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS transfer_reference_seq (
      year INTEGER PRIMARY KEY,
      last INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS transfer_request (
      id TEXT PRIMARY KEY,
      reference_no TEXT NOT NULL UNIQUE,
      employee_id TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN (
        'DRAFT','MANAGER_REVIEW','HR_VALIDATION','FULFILMENT',
        'COMPLETED','REJECTED','WITHDRAWN','CANCELLED','DISCARDED'
      )),
      current_department_id TEXT,
      current_location_id TEXT,
      current_position_id TEXT,
      current_grade TEXT,
      current_cost_centre TEXT,
      current_department_name TEXT,
      current_location_name TEXT,
      current_position_title TEXT,
      line_manager_ref TEXT,
      target_department_id TEXT,
      target_location_id TEXT,
      target_position_id TEXT,
      target_grade TEXT,
      target_cost_centre TEXT,
      service_in_position_months INTEGER,
      requested_effective_date TEXT,
      confirmed_effective_date TEXT,
      reason_ciphertext BLOB,
      withdrawal_reason_ciphertext BLOB,
      version INTEGER NOT NULL,
      submitted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_transfer_request_employee
      ON transfer_request (employee_id);

    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_request_per_employee
      ON transfer_request (employee_id)
      WHERE status IN ('DRAFT','MANAGER_REVIEW','HR_VALIDATION','FULFILMENT');

    CREATE TABLE IF NOT EXISTS transfer_request_stage (
      id TEXT PRIMARY KEY,
      transfer_request_id TEXT NOT NULL REFERENCES transfer_request(id),
      stage_code TEXT NOT NULL,
      sequence_no INTEGER NOT NULL,
      status TEXT NOT NULL,
      assigned_role TEXT NOT NULL,
      assigned_party_ref TEXT,
      applicable INTEGER NOT NULL,
      sla_due_at TEXT,
      started_at TEXT,
      completed_at TEXT,
      UNIQUE (transfer_request_id, stage_code)
    );

    CREATE INDEX IF NOT EXISTS idx_stage_assignee_in_progress
      ON transfer_request_stage (assigned_party_ref, status);

    CREATE INDEX IF NOT EXISTS idx_stage_hr_in_progress
      ON transfer_request_stage (stage_code, status);

    CREATE TABLE IF NOT EXISTS transfer_request_audit (
      id TEXT PRIMARY KEY,
      transfer_request_id TEXT NOT NULL,
      actor_employee_id TEXT NOT NULL,
      actor_role TEXT NOT NULL,
      event_type TEXT NOT NULL,
      from_status TEXT,
      to_status TEXT,
      occurred_at TEXT NOT NULL,
      correlation_id TEXT NOT NULL,
      metadata TEXT
    );

    CREATE TRIGGER IF NOT EXISTS transfer_request_audit_no_update
    BEFORE UPDATE ON transfer_request_audit
    BEGIN
      SELECT RAISE(ABORT, 'audit immutable');
    END;

    CREATE TRIGGER IF NOT EXISTS transfer_request_audit_no_delete
    BEFORE DELETE ON transfer_request_audit
    BEGIN
      SELECT RAISE(ABORT, 'audit immutable');
    END;

    CREATE TABLE IF NOT EXISTS transfer_request_outbox (
      id TEXT PRIMARY KEY,
      aggregate_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      published_at TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT
    );

    CREATE TABLE IF NOT EXISTS reference_data_cache (
      cache_key TEXT PRIMARY KEY,
      payload TEXT NOT NULL,
      fetched_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS webhook_event (
      event_id TEXT PRIMARY KEY,
      body_hash TEXT NOT NULL,
      request_id TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS idempotency_record (
      idempotency_key TEXT NOT NULL,
      request_id TEXT NOT NULL,
      body_hash TEXT NOT NULL,
      response_status INTEGER NOT NULL,
      response_body TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (idempotency_key)
    );
  `);
}

export function nextReference(db: DatabaseSync, year: number): string {
  const row = db
    .prepare("SELECT last FROM transfer_reference_seq WHERE year = ?")
    .get(year) as { last: number } | undefined;
  const next = (row?.last ?? 0) + 1;
  if (row) {
    db.prepare("UPDATE transfer_reference_seq SET last = ? WHERE year = ?").run(next, year);
  } else {
    db.prepare("INSERT INTO transfer_reference_seq (year, last) VALUES (?, ?)").run(year, next);
  }
  return `ITR-${year}-${String(next).padStart(6, "0")}`;
}
