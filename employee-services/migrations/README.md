# Database schema and migrations

Schema creation for `employee-services` is **in code**, in
[`src/internal-transfer/persistence/schema.ts`](../src/internal-transfer/persistence/schema.ts).
`migrate(db)` runs `CREATE TABLE IF NOT EXISTS …` (and the indexes, triggers and the partial
unique index) idempotently at startup and at the top of `createApp`, against the single
SQLite file. This directory documents that decision and the one mechanism a reviewer is most
likely to look for here.

## Why schema creation is in code, not a migration tool

- The constitution mandates **SQLite only, no ORM**. There is no migration framework in the
  dependency set, and adding one would need an ADR and a "why a platform built-in will not
  do" justification (constitution: no new dependency without that).
- The datastore is a single file opened by one process. `CREATE TABLE IF NOT EXISTS` plus a
  forward-only `migrate()` is sufficient and is exercised by every test (each test migrates a
  fresh temporary database), so the DDL is continuously verified rather than drifting in a
  separate, unrun `.sql` file.
- `schema.ts` is therefore the single authoritative source of the DDL. A mirror `.sql` file
  is intentionally **not** kept here, to avoid two copies drifting apart.

When the schema needs a forward change, add the new `CREATE`/`ALTER` to `migrate()` guarded by
`IF NOT EXISTS` (or an additive, idempotent statement) and cover it with a test. Record any
destructive change through an ADR first.

## Audit immutability (AC18 / G2-F04)

`transfer_request_audit` is append-only. SQLite has no `REVOKE`, so the guarantee is **not**
revoked table privileges. It is a pair of triggers in `schema.ts`:

```sql
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
```

`UT52` (`src/internal-transfer/internal-transfer-request.test.ts`) proves an `UPDATE` on an
audit row is rejected by the database, not by application code.
