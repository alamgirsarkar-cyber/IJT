# Plan: Employee Internal Transfer Request

## Derived From

`.ai-context/specs/internal-transfer-request.spec.md` (v1.5, Approved 2026-09-15, Abhijit Adhikari)

Realigned 2026-09-22 to that approved spec. The 2026-08-31 draft described v1.2.

## Status

**Plan Drafted** · **Author:** Alamgir Sarkar · **Reviewer:** Abhijit Adhikari (_plan review pending_)
Review record: `.ai-context/reviews/internal-transfer-request.gate1-plan.md`

## Architecture Approach

- **No new service.** The feature is a bounded module `internal-transfer` inside the
  existing `employee-services` Express application, per the constitution's "no new service
  without an ADR." It owns its own schema namespace and exposes its own routers; nothing
  outside the module reads its tables.
- **The request aggregate is portal-owned.** `transfer_request` and its children are the
  system of record for the _request_; the HRIS remains the system of record for employment
  and organisational data, which the portal only ever reads and snapshots. See
  [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md).
- **Downstream integration is event-driven through a transactional outbox.** Submission
  writes the state change and the outbox row in one transaction; a separate relay POSTs to
  downstream webhooks. No Payroll, ITSM or Facilities call ever appears in a request path. See
  [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md). This is
  what makes AC9's all-or-nothing guarantee achievable without a distributed transaction,
  and what stops a slow downstream system from turning into a slow submit.
- **HRIS reads are synchronous but cached.** Reference data (departments, locations,
  positions) is cached in SQLite (`reference_data_cache`) with a 15-minute TTL and served
  stale when the HRIS is unreachable, with an explicit `stale` flag (AC15). Employment data
  used for eligibility (BR1, BR2, BR4) is **not** cached and is read fresh at submission — a
  stale probation or resignation status would produce a wrong eligibility decision, and
  correctness beats availability at that specific point. That is why AC15 refuses the submit
  with a 503 rather than falling back to cached employment data.
- **Rules are evaluated by a small explicit rule set in code**, one function per rule ID,
  each returning a violation carrying its own `ruleId`. Not a rules engine: nine rules do not
  justify one, and a rules engine would put business logic somewhere Gate 2 cannot review it
  against the spec. Each rule function is named for its ID so the traceability from BR to
  test to code is greppable.
- **Reference number generation** uses a SQLite sequence table per year plus formatting, not
  application-side counting, so concurrent submissions cannot collide.
- **Front end** is a new feature route in `employee-portal-web`, not a new app.
  `.agent/rules/int-standards.react.md` fixes the shape: `src/features/internal-transfer/`
  with `components/`, `hooks/`, `api/`, `model/`; function components; server state only
  through RTK Query; no second state library; copy in resource files; tests query by
  accessible role (React Testing Library) and journeys in Playwright, with MSW at the
  network boundary using this spec's problem+json shapes. Screens: a four-step wizard
  (target → date → reason → review) and a status timeline, both on the portal design
  system. Reason text is submitted and not kept in a slice, `localStorage`, the URL or
  analytics. The wizard **reuses the portal OIDC session**; RTK Query attaches the bearer
  token. There is no transfer login page. Unauthenticated users hit the portal's existing
  sign-in (AC21). WCAG 2.1 AA is part of the frontend task, including `axe` and a keyboard
  and screen-reader pass.
- **Backend layout** follows `.agent/rules/int-standards.node.md` inside the existing
  `employee-services` module: `src/internal-transfer/{api,domain,rules,persistence,integration,readmodel}`.
  Boundary validation is `class-validator` (`whitelist`, `forbidNonWhitelisted`). Persistence
  tests use a real SQLite file. No new npm dependency: encryption is the platform crypto
  module, auth is the existing OIDC middleware.
- **Authentication and authorisation** reuse the platform: gateway validates OIDC;
  Express middleware `requireAuthenticatedEmployee` reads the token subject as
  `employee_id` and never a body field. Ownership checks run in the service (AC13, AC20).
  No new auth-adjacent npm package — platform OIDC middleware already on `employee-services`.
  Rate-limit counters stay keyed by a salted hash of that subject (AC17).

## Data Model

New tables in the `internal_transfer` schema. All additive; no existing table is altered, so
the migration is rolling-deploy safe.

**`transfer_request`**

| Column                                                                | Type               | Notes                                                                                      |
| --------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------ |
| `id`                                                                  | uuid PK            |                                                                                            |
| `reference_no`                                                        | varchar(16) unique | `ITR-<yyyy>-<6 digits>` from `transfer_reference_seq`                                      |
| `employee_id`                                                         | varchar(32)        | Pseudonymous HRIS identifier; indexed                                                      |
| `status`                                                              | varchar(24)        | Enum-checked; see the spec's state machine                                                 |
| `current_department_id`, `current_location_id`, `current_position_id` | varchar(32)        | Snapshot, frozen at submit                                                                 |
| `current_grade`, `current_cost_centre`                                | varchar(32)        | Snapshot; drives stage applicability                                                       |
| `target_department_id`, `target_location_id`, `target_position_id`    | varchar(32)        |                                                                                            |
| `target_grade`, `target_cost_centre`                                  | varchar(32)        | Resolved from position management at submit                                                |
| `service_in_position_months`                                          | int                | Snapshot at submit, for audit of the BR2 decision                                          |
| `requested_effective_date`                                            | date               |                                                                                            |
| `confirmed_effective_date`                                            | date null          | Never set by this feature; the column exists so the approval-chain spec needs no migration |
| `reason_ciphertext`                                                   | bytea null         | Field-level encrypted (AC16)                                                               |
| `withdrawal_reason_ciphertext`                                        | bytea null         | Same handling                                                                              |
| `version`                                                             | int                | Optimistic concurrency (AC2)                                                               |
| `submitted_at`, `created_at`, `updated_at`                            | timestamptz        |                                                                                            |

Column types above are logical. The engine is SQLite (constitution). Timestamps and JSON
are `TEXT`, ciphertext is `BLOB`, counters are `INTEGER`. There is no `bytea`,
`timestamptz` or `jsonb` type to migrate to.

**Partial unique index** `uniq_active_request_per_employee` on `employee_id`
`WHERE status IN ('DRAFT','MANAGER_REVIEW','HR_VALIDATION','FULFILMENT')`.
`SUBMITTED` is not a request status (v1.5). BR3 is enforced by the database, not only by
a read-then-write check — that is what makes AC8 and AC25 pass if the application check
is absent.

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

**SQLite auxiliary tables** — all in the same database file:

| Table                  | Purpose                                                 | TTL / retention                 |
| ---------------------- | ------------------------------------------------------- | ------------------------------- |
| `reference_data_cache` | HRIS reference data (departments, locations, positions) | 900 s, served stale past expiry |
| `idempotency_record`   | Idempotency key and stored response (AC10)              | 24 h                            |
| `rate_limit_counter`   | Per-endpoint rate-limit window (AC17)                   | Window length                   |

**Migration:** forward-only, additive. Rollback is by leaving the tables in place, unused —
dropping them would lose submitted requests.

## Integration Points

| System                                          | Direction | Sync/Async             | Failure behaviour                                                 | Timeout / retry                                                            | Owner                |
| ----------------------------------------------- | --------- | ---------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------- | -------------------- |
| HRIS read API — employee employment data        | Outbound  | Sync, **uncached**     | Submit returns 503, request stays `DRAFT` (AC15)                  | 2 s timeout, 1 retry, circuit breaker at 50% over 20 calls                 | HR Systems           |
| HRIS read API — org and position reference data | Outbound  | Sync, cached 15 min    | Serve cached, flag `stale`; 503 only if the cache is empty        | 2 s timeout, 1 retry                                                       | HR Systems           |
| Downstream webhooks `employee.transfer.v1`      | Outbound  | Async via outbox relay | Outbox retains and retries with backoff; submission is unaffected | Relay: exponential backoff, unbounded retries, alert at 15 min unpublished | Portal               |
| Corporate IdP                                   | Inbound   | Sync                   | Gateway rejects before the service is reached                     | Platform standard                                                          | Security Engineering |

**Events emitted** (schemas registered, additive-only per the constitution):

- `employee.transfer.requested.v1` — on submit. Payload allow-list: `requestId`,
  `referenceNo`, `employeeId`, current and target department/location/position/grade/cost
  centre IDs, `requestedEffectiveDate`, applicable stage codes, `submittedAt`,
  `correlationId`. **No reason text, no names, no contact details.**
- `employee.transfer.withdrawn.v1` — on withdrawal. `requestId`, `referenceNo`,
  `employeeId`, `withdrawnAt`, `correlationId`. **No withdrawal reason text.**

## Failure and Boundary Handling

| Scenario                                                               | Behaviour                                                                                                                                           | Maps to AC |
| ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| HRIS unavailable at draft creation                                     | 503; no request created — the current-assignment snapshot is part of the record and a request without it is not usable                              | AC1, AC15  |
| HRIS unavailable at submit                                             | 503; request stays `DRAFT`, nothing partially written; eligibility is never evaluated against cached employment data                                | AC15       |
| HRIS reference data unavailable, cache warm                            | Serve cached with `stale` flag; the wizard displays a freshness notice                                                                              | AC15       |
| Position closed between drafting and submitting                        | 422 citing BR6 — validated at submit against live reference data, not against what was selectable when drafted                                      | AC6        |
| Two concurrent creates for one employee                                | Partial unique index rejects the second; the service maps the constraint violation to 409, it does not surface a database error                     | AC8        |
| Two concurrent draft updates                                           | Optimistic concurrency on `version`; second gets 409 with the current version                                                                       | AC2        |
| Double-clicked submit                                                  | Idempotency record returns the stored response; no second event, no second audit row                                                                | AC10       |
| Submit succeeds, outbox insert fails                                   | Whole transaction rolls back; request stays `DRAFT`                                                                                                 | AC9        |
| Outbox row committed, downstream webhook unreachable                   | Relay retries with backoff; the request is `SUBMITTED` and correct, the event is merely late; alert fires at 15 minutes                             | AC9        |
| Relay publishes twice after a crash between publish and mark-published | At-least-once by design; consumers must be idempotent, and the event carries `requestId` as the natural dedupe key. Stated in the event contract    | ADR-0001   |
| Withdrawal races a stage transition into `FULFILMENT`                  | Compare-and-swap on `version`. Still inside the window: 409 `version-conflict`. Already `FULFILMENT`: 409 `withdrawal-window-closed`                 | AC14, AC23 |
| Authoritative HRIS cannot resolve either manager at submit             | 422 `assignee-unresolved`; row stays `DRAFT`; no stage plan and no outbox row                                                                       | AC29       |
| `(status, operation)` absent from the transition table                  | 409 `invalid-state-transition` with `currentStatus`; no audit row and no event                                                                      | AC27       |
| API02 or API06 without `If-Match`, or with a stale version              | 400 `precondition-required`, or 409 `version-conflict` with `currentVersion`; no merge                                                               | AC2, AC30  |
| SQLite unavailable                                                     | All transfer endpoints return 503; no partial writes                                                                                                | AC1, AC15  |
| Clock skew across instances for date-window checks                     | All date arithmetic in UTC against the database clock, not the application clock                                                                    | AC4        |
| Employee's line manager changes between submit and view                | `assigned_party_ref` is snapshotted at submit; the view resolves the name at read time and shows the role alone if the reference no longer resolves | AC11       |

## Constitution Check

- [x] **No new datastore or service introduced without an ADR** — none introduced. All state
      in SQLite, used within its approved role.
- [x] **Testing discipline matches `constitution.md`** — Jest + Supertest, test-first per task,
      real SQLite database file for constraint and transaction behaviour, React
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

| Decision                                                                                        | Significant?                                                                                                          | ADR                                                                             |
| ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Event-driven downstream orchestration via a transactional outbox, rather than synchronous calls | **Yes** — reversing it would mean rewriting every downstream integration and the submit path; far more than a day     | [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) |
| Portal owns the transfer request; HRIS stays the system of record for employment data           | **Yes** — the alternative changes data ownership across two organisations                                             | [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)          |
| Rules in explicit code functions rather than a rules engine                                     | No — nine rule functions could be moved behind an engine in well under a day if the rule count grows                  | Recorded here only                                                              |
| Optimistic concurrency rather than pessimistic locking on drafts                                | No — localised to one endpoint                                                                                        | Recorded here only                                                              |
| Eligibility data read uncached while reference data is cached                                   | Borderline; the reasoning is load-bearing enough to be worth writing down, but reversing it is a configuration change | Recorded here and in Architecture Approach                                      |

## Explicitly Deferred

- **Approval decisioning** — every stage transition after submit has committed
  `MANAGER_REVIEW`. Deferred to `internal-transfer-approval-chain`. This plan creates the
  stage rows and nothing else acts on them. _Gate 2 must verify that no approval logic
  appeared in the implementation._
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
- **Identity administration** — login, registration, password reset, MFA enrolment, a
  second session timeout, or an auth-adjacent package. Authentication is the existing
  portal OIDC session (BRD-001 KD-07). _Gate 2 must verify no transfer login form appeared._

## v1.5 alignment

Behaviour the v1.2 draft did not yet fix. These do not add screens or endpoints.

- **Submit is synchronous.** API03 commits `MANAGER_REVIEW` with `MANAGER_RELEASE` already
  `IN_PROGRESS` and the other seven stages `NOT_STARTED`. `SUBMITTED` is an audit/history
  event type only. At most one stage is `IN_PROGRESS`. Zero `IN_PROGRESS` stages is legal
  only on the failed-fulfilment rest shape, which this spec displays and does not cause.
- **Unresolved managers fail closed (AC29).** If the uncached HRIS read cannot resolve the
  current line manager or the receiving manager, submit returns 422 `assignee-unresolved`,
  the row stays `DRAFT`, and no stage plan or `requested.v1` row is written.
- **BR12 (AC22).** Service length is whole calendar months with the last-day clamp in the
  spec. The draft-time `serviceInPositionMonths` on API01 is display only and is not an
  input to the rule.
- **Cache is not a decision source (AC24).** API07 may serve stale reference data. Submit
  re-reads authoritative HRIS data. A closed position is 422 BR6. An unreachable
  authoritative source is 503 and the draft is unchanged.
- **Compare-and-swap (AC23, AC30, OWN-11).** API02 and API06 require `If-Match: "<version>"`.
  Absent header is 400 `precondition-required`. Mismatch is 409 `version-conflict` with
  `currentVersion`. The write is `UPDATE … WHERE version = :expected`. Already-`WITHDRAWN`
  replay on API06 is checked before the precondition. A withdrawal that loses to an
  approval still inside the window is `version-conflict`; a withdrawal after `FULFILMENT`
  is `withdrawal-window-closed`.
- **Unlisted pairs fail closed (AC27).** Any `(status, operation)` absent from the request
  transition table is 409 `invalid-state-transition` with `currentStatus`, and writes no
  audit row and no event. `DISCARDED` and `CANCELLED` have no producer.
- **Event envelope (AC26, AC28).** `employee.transfer.requested.v1` and
  `withdrawn.v1` use the OWN-09 envelope (`eventId`, `eventType` with `.v1`,
  `eventVersion`, `occurredAt`, `correlationId`, `requestId`, allow-listed `payload`).
  `lineManagerRef` on `requested.v1` is non-null because AC29 already refused a null manager.
- **Employee view of failed fulfilment.** API04 and API05 return `statusDisplay`
  "HR is completing this" when status is `FULFILMENT` and any stage is `FAILED` or
  `COMPENSATION_*`, with `pendingWith.role` `HR_OPERATIONS` and `partyName` null. Healthy
  fulfilment stays "Being actioned". The status screen renders those strings; it does not
  add a resume control. `EMPLOYEE_CONFIRMATION` is not a button.

## Sequencing

Each step is independently generatable, reviewable and mergeable. Steps 1–10 keep the
task IDs already issued. Step 11 is the only new task: the failed-fulfilment screen. The
v1.5 backend behaviour is folded into steps 3–9 so those tasks stay the owners of the
endpoints they already name.

1. **Schema, migrations and the audit guarantee** — tables, indexes, the partial unique
   index (no `SUBMITTED`), revoked audit privileges. SQLite affinities only.
2. **Reference-data provider** — HRIS client, SQLite cache, staleness handling, the API07
   endpoint. Cache is never an input to a submit rule.
3. **Draft lifecycle** — create and update, `If-Match` on API02, OIDC middleware and
   ownership checks (API01, API02, AC13, AC20, AC30).
4. **Rule set** — one function per business rule, including BR12's last-day clamp (AC22).
5. **Submit transaction** — validation, unresolved-manager refusal, stage-plan construction
   straight to `MANAGER_REVIEW`, audit, outbox, idempotency (API03, AC28, AC29).
6. **Outbox relay** — webhook publisher, backoff, at-least-once semantics, unpublished-age
   alert, OWN-09 envelope (AC26).
7. **Read model** — status detail and list, `pendingWith` naming, failed-fulfilment
   `statusDisplay` (API04, API05).
8. **Withdrawal** — state guard, `If-Match`, stage cancellation, event, race against
   approval (API06, AC23).
9. **Cross-cutting hardening** — rate limiting, log redaction and its test, field-level
   encryption, correlation-ID propagation, unlisted-transition refusal (AC27).
10. **Front end — wizard and status timeline** — `employee-portal-web` feature folder,
    accessibility, existing portal session (AC19, AC21).
11. **Front end — failed-fulfilment labels** — status and list screens render
    "HR is completing this" and the stage vocabulary as text, with no resume action.

## Documentation Impact

- [x] `architecture.md` — Components, Data Model, Integration Points, Authentication and
      Authorisation, Decisions in Force and Known Constraints updated (AuthN/AuthZ section
      2026-09-08; remainder on plan drafting 2026-09-01)
- [x] `decisions/` — ADR-0001 and ADR-0002 filed
- [ ] `README.md` — no operational change until the first deploy adds a migration step
- [ ] `docs/contracts/` — event schemas to be registered when T06 merges
