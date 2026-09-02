# Plan: Employee Internal Transfer Request

## Derived From

`.ai-context/specs/internal-transfer-request.spec.md` (v1.1, In Peer Review — not yet Approved)

## Status

**Plan Drafted** — awaiting spec **Approved** at Gate 1, then plan review by Abhijit Adhikary
**Author:** Alamgir Sarkar · **Gate 1 reviewer:** Abhijit Adhikary (_plan review pending_)
Review record: `.ai-context/reviews/internal-transfer-request.gate1-plan.md`

## Architecture Approach

- **No new service.** The feature is a bounded module `internal-transfer` inside the
  existing `employee-services` NestJS application, per the constitution's "no new service
  without an ADR." It owns its own schema namespace and exposes its own controllers; nothing
  outside the module reads its tables.
- **The request aggregate is portal-owned.** `transfer_request` and its children are the
  system of record for the *request*; the HRIS remains the system of record for employment
  and organisational data, which the portal only ever reads and snapshots. See
  [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md).
- **Downstream integration is event-driven through a transactional outbox.** Submission
  writes the state change and the outbox row in one transaction; a separate relay publishes
  to Kafka. No Payroll, ITSM or Facilities call ever appears in a request path. See
  [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md). This is
  what makes AC9's all-or-nothing guarantee achievable without a distributed transaction,
  and what stops a slow downstream system from turning into a slow submit.
- **HRIS reads are synchronous but cached.** Reference data (departments, locations,
  positions) is cached in Redis with a 15-minute TTL and served stale when the HRIS is
  unreachable, with an explicit `stale` flag (AC15). Employment data used for eligibility
  (BR1, BR2, BR4) is **not** cached and is read fresh at submission — a stale probation or
  resignation status would produce a wrong eligibility decision, and correctness beats
  availability at that specific point. That is why AC15 refuses the submit with a 503 rather
  than falling back to cached employment data.
- **Rules are evaluated by a small explicit rule set in code**, one function per rule ID,
  each returning a violation carrying its own `ruleId`. Not a rules engine: nine rules do not
  justify one, and a rules engine would put business logic somewhere Gate 2 cannot review it
  against the spec. Each rule function is named for its ID so the traceability from BR to
  test to code is greppable.
- **Reference number generation** uses a PostgreSQL sequence per year plus formatting, not
  application-side counting, so concurrent submissions cannot collide.
- **Front end** is a new route in `employee-portal-web` using the portal design system: a
  four-step wizard (target → date → reason → review) plus a status timeline, with Redux
  Toolkit for state and RTK Query for the API layer, per the constitution's single-state-library
  rule.

## Data Model

New tables in the `internal_transfer` schema. All additive; no existing table is altered, so
the migration is rolling-deploy safe.

**`transfer_request`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `reference_no` | varchar(16) unique | `ITR-<yyyy>-<6 digits>` from `transfer_reference_seq` |
| `employee_id` | varchar(32) | Pseudonymous HRIS identifier; indexed |
| `status` | varchar(24) | Enum-checked; see the spec's state machine |
| `current_department_id`, `current_location_id`, `current_position_id` | varchar(32) | Snapshot, frozen at submit |
| `current_grade`, `current_cost_centre` | varchar(32) | Snapshot; drives stage applicability |
| `target_department_id`, `target_location_id`, `target_position_id` | varchar(32) | |
| `target_grade`, `target_cost_centre` | varchar(32) | Resolved from position management at submit |
| `service_in_position_months` | int | Snapshot at submit, for audit of the BR2 decision |
| `requested_effective_date` | date | |
| `confirmed_effective_date` | date null | Never set by this feature; the column exists so the approval-chain spec needs no migration |
| `reason_ciphertext` | bytea null | Field-level encrypted (AC16) |
| `withdrawal_reason_ciphertext` | bytea null | Same handling |
| `version` | int | Optimistic concurrency (AC2) |
| `submitted_at`, `created_at`, `updated_at` | timestamptz | |

**Partial unique index** `uniq_active_request_per_employee` on `employee_id`
`WHERE status IN ('DRAFT','SUBMITTED','MANAGER_REVIEW','HR_VALIDATION','FULFILMENT')`.
BR3 is enforced by the database, not only by a read-then-write check — that is what makes
AC8's concurrent case pass deterministically rather than usually.

**`transfer_request_stage`** — `id`, `transfer_request_id` FK, `stage_code`, `sequence_no`,
`status`, `assigned_role`, `assigned_party_ref` (opaque employee ID, never a name),
`applicable` bool, `sla_due_at` (populated null in v1, present so BRD-001 OQ-15 needs no
migration), `started_at`, `completed_at`. Unique on `(transfer_request_id, stage_code)`.

**`transfer_request_audit`** — `id`, `transfer_request_id`, `actor_employee_id`,
`actor_role`, `event_type`, `from_status`, `to_status`, `occurred_at`, `correlation_id`,
`metadata` jsonb. Append-only: `REVOKE UPDATE, DELETE` on the table from the application
role, so AC18's immutability is a database guarantee rather than a code convention.

**`transfer_request_outbox`** — `id`, `aggregate_id`, `event_type`, `payload` jsonb,
`created_at`, `published_at` null, `attempts`, `last_error`. Payload is constructed by an
explicit mapper that lists the fields it emits, rather than serialising the aggregate — an
allow-list, so a future column cannot leak into an event by default (AC16).

**Redis keys** — all namespaced `itr:`:

| Key | Purpose | TTL |
|---|---|---|
| `itr:refdata:departments:v1`, `:locations:v1`, `:positions:{deptId}:v1` | Reference-data cache | 900 s, served stale past TTL |
| `itr:idem:{sha256(employeeId+salt)}:{key}` | Idempotency record and stored response | 24 h |
| `itr:rl:{endpoint}:{sha256(employeeId+salt)}` | Rate-limit counter (AC17) | Window length |

Employee IDs are hashed in Redis keys even though the constitution classifies them as
non-PII, because Redis is a shared estate with broader operational access than PostgreSQL,
and a hash costs nothing here.

**Migration:** forward-only, additive. Rollback is by leaving the tables in place, unused —
dropping them would lose submitted requests.

## Integration Points

| System | Direction | Sync/Async | Failure behaviour | Timeout / retry | Owner |
|---|---|---|---|---|---|
| HRIS read API — employee employment data | Outbound | Sync, **uncached** | Submit returns 503, request stays `DRAFT` (AC15) | 2 s timeout, 1 retry, circuit breaker at 50% over 20 calls | HR Systems |
| HRIS read API — org and position reference data | Outbound | Sync, cached 15 min | Serve cached, flag `stale`; 503 only if the cache is empty | 2 s timeout, 1 retry | HR Systems |
| Kafka `employee.transfer.v1` | Outbound | Async via outbox | Outbox retains and retries with backoff; submission is unaffected | Relay: exponential backoff, unbounded retries, alert at 15 min unpublished | Portal |
| Corporate IdP | Inbound | Sync | Gateway rejects before the service is reached | Platform standard | Security Engineering |

**Events emitted** (schemas registered, additive-only per the constitution):

- `employee.transfer.requested.v1` — on submit. Payload allow-list: `requestId`,
  `referenceNo`, `employeeId`, current and target department/location/position/grade/cost
  centre IDs, `requestedEffectiveDate`, applicable stage codes, `submittedAt`,
  `correlationId`. **No reason text, no names, no contact details.**
- `employee.transfer.withdrawn.v1` — on withdrawal. `requestId`, `referenceNo`,
  `employeeId`, `withdrawnAt`, `correlationId`. **No withdrawal reason text.**

## Failure and Boundary Handling

| Scenario | Behaviour | Maps to AC |
|---|---|---|
| HRIS unavailable at draft creation | 503; no request created — the current-assignment snapshot is part of the record and a request without it is not usable | AC1, AC15 |
| HRIS unavailable at submit | 503; request stays `DRAFT`, nothing partially written; eligibility is never evaluated against cached employment data | AC15 |
| HRIS reference data unavailable, cache warm | Serve cached with `stale` flag; the wizard displays a freshness notice | AC15 |
| Position closed between drafting and submitting | 422 citing BR6 — validated at submit against live reference data, not against what was selectable when drafted | AC6 |
| Two concurrent creates for one employee | Partial unique index rejects the second; the service maps the constraint violation to 409, it does not surface a database error | AC8 |
| Two concurrent draft updates | Optimistic concurrency on `version`; second gets 409 with the current version | AC2 |
| Double-clicked submit | Idempotency record returns the stored response; no second event, no second audit row | AC10 |
| Submit succeeds, outbox insert fails | Whole transaction rolls back; request stays `DRAFT` | AC9 |
| Outbox row committed, Kafka unavailable | Relay retries with backoff; the request is `SUBMITTED` and correct, the event is merely late; alert fires at 15 minutes | AC9 |
| Relay publishes twice after a crash between publish and mark-published | At-least-once by design; consumers must be idempotent, and the event carries `requestId` as the natural dedupe key. Stated in the event contract | ADR-0001 |
| Withdrawal races a stage transition into `FULFILMENT` | Row-level lock on the aggregate for the status check and the write; the loser gets 409 `withdrawal-window-closed` | AC14 |
| Redis unavailable | Reference data falls through to the HRIS (slower, still correct). **Rate limiting fails closed** for submit and open for reads. Idempotency **fails closed** — a submit without a working idempotency store is refused with 503 rather than risking a duplicate request | AC10, AC15, AC17 |
| Clock skew across instances for date-window checks | All date arithmetic in UTC against the database clock, not the application clock | AC4 |
| Employee's line manager changes between submit and view | `assigned_party_ref` is snapshotted at submit; the view resolves the name at read time and shows the role alone if the reference no longer resolves | AC11 |

## Constitution Check

- [x] **No new datastore or service introduced without an ADR** — none introduced. New tables
      in PostgreSQL and new keys in Redis, both approved stores used within their approved
      roles; nothing authoritative is held in Redis.
- [x] **Testing discipline matches `constitution.md`** — Jest + Supertest, test-first per task,
      real PostgreSQL via Testcontainers for constraint and transaction behaviour, React
      Testing Library plus Playwright for the wizard. Coverage floor 85% applies to this
      module because it handles employee records.
- [x] **Security posture matches `constitution.md`** — reason and withdrawal-reason text are
      field-level encrypted, excluded from events by an allow-list mapper, excluded from
      list responses, and covered by a log-capture test (AC16). Employee ID is used in logs
      as permitted; no name, contact detail or narrative is. Authorisation is derived from the
      token subject only, and is enforced in the service, not at the gateway alone.
- [x] **Rate-limit decision explicit for every new or changed endpoint** — seven endpoints,
      seven stated limits in the spec's API Contract; the autosave pattern on API02 is why
      its limit is 120/hour rather than the default.
- [x] **Non-functional baselines respected** — the only synchronous external dependency in a
      read path is the cached HRIS call; p95 budget for API03 is dominated by one uncached
      HRIS read plus one transaction, measured in SIT before release. HRIS failure degrades
      this journey alone, satisfying the no-cascade rule.
- [x] **Versioning rules respected** — new endpoints under the existing `/api/v1/`; no
      breaking change to any existing contract; event schemas registered as `.v1` with
      additive-only evolution; migration is additive and rolling-safe.
- [x] **Accessibility** — WCAG 2.1 AA is a task-level acceptance condition on T10, not a
      follow-up ticket, with automated axe checks plus a manual keyboard and screen-reader
      pass.
- [x] **Audit** — append-only enforced by revoked table privileges, not by convention.

## ADR Candidates

| Decision | Significant? | ADR |
|---|---|---|
| Event-driven downstream orchestration via a transactional outbox, rather than synchronous calls | **Yes** — reversing it would mean rewriting every downstream integration and the submit path; far more than a day | [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) |
| Portal owns the transfer request; HRIS stays the system of record for employment data | **Yes** — the alternative changes data ownership across two organisations | [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md) |
| Rules in explicit code functions rather than a rules engine | No — nine rule functions could be moved behind an engine in well under a day if the rule count grows | Recorded here only |
| Optimistic concurrency rather than pessimistic locking on drafts | No — localised to one endpoint | Recorded here only |
| Eligibility data read uncached while reference data is cached | Borderline; the reasoning is load-bearing enough to be worth writing down, but reversing it is a configuration change | Recorded here and in Architecture Approach |

## Explicitly Deferred

- **Approval decisioning** — every stage transition after `SUBMITTED`. Deferred to
  `internal-transfer-approval-chain`. This plan creates the stage rows and nothing else acts
  on them. *Gate 2 must verify that no approval logic appeared in the implementation.*
- **Downstream fulfilment consumers** — Payroll, ITSM, Facilities. Deferred to
  `internal-transfer-downstream-orchestration`. v1 emits an event with no consumer, knowingly.
- **Notifications** — deferred to `internal-transfer-notifications`. No email, no push, no
  in-portal alert is built here, including the "thanks, we've got it" confirmation that will
  be tempting to add to the submit response handler.
- **Confirmed effective date** — the column exists, nothing writes to it. Deferred by
  BRD-001 OQ-05 to the HR validation stage.
- **Stage SLA and escalation** (OQ-15) — `sla_due_at` exists and stays null.
- **Approver delegation** (OQ-16) — deferred by HR Ops; no delegation resolution in the
  party reference.
- **Reason-text purge job at 24 months** (OQ-17) — retention is specified but the scheduled
  purge is a platform-wide capability; raised as a separate backlog item rather than built
  here, because a feature-local purge job is the wrong place for it.
- **Localisation** — copy is externalised into resource files; no second locale is delivered.

## Sequencing

Each step is independently generatable, reviewable and mergeable.

1. **Schema, migrations and the audit guarantee** — tables, indexes, the partial unique
   index, revoked audit privileges.
2. **Reference-data provider** — HRIS client, Redis cache, staleness handling, the API07
   endpoint.
3. **Draft lifecycle** — create and update, optimistic concurrency, ownership checks
   (API01, API02).
4. **Rule set** — one function per business rule, returning violations carrying rule IDs.
5. **Submit transaction** — validation, stage-plan construction, audit, outbox, idempotency
   (API03).
6. **Outbox relay** — publisher, backoff, at-least-once semantics, unpublished-age alert.
7. **Read model** — status detail and list, `pendingWith` derivation and the naming rule
   (API04, API05).
8. **Withdrawal** — state guard, stage cancellation, event (API06).
9. **Cross-cutting hardening** — rate limiting, log redaction and its test, field-level
   encryption, correlation-ID propagation.
10. **Front end** — wizard, status timeline, accessibility.

## Documentation Impact

- [x] `architecture.md` — Components, Data Model, Integration Points, Decisions in Force and
      Known Constraints all updated on plan approval (2026-09-01)
- [x] `decisions/` — ADR-0001 and ADR-0002 filed
- [ ] `README.md` — no operational change until the first deploy adds a migration step
- [ ] `docs/contracts/` — event schemas to be registered when T06 merges
