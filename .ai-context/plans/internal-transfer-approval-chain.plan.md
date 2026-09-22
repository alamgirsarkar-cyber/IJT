# Plan: Internal Transfer Approval Chain

## Derived From

`.ai-context/specs/internal-transfer-approval-chain.spec.md` (v1.3)

The spec's Gate 1 block records **Approved** on 2026-09-09 against v1.0, and its own
superseded note says that line does not cover v1.3. This plan was drafted on 2026-09-22
because the session was instructed that the approval chain is approved. It does not rewrite
the Gate 1 block. Implementation of v1.3 behaviour (OWN-11 `If-Match`, AC15) does not start
until that block names v1.3 Approved.

## Status

**Plan Drafted** · **Author:** Alamgir Sarkar · **Reviewer:** Abhijit Adhikari (_plan review pending_)

## Architecture Approach

- **No new service and no new aggregate.** Decisions mutate the `transfer_request` and
  `transfer_request_stage` rows owned by `internal-transfer-request`
  ([ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)). This spec adds
  routers and a read model inside the same `internal-transfer` module.
- **Backend** follows `.agent/rules/int-standards.node.md`. Code lives under
  `employee-services/src/internal-transfer/approval/{api,domain,persistence,readmodel}`.
  It does not import another feature's internals except through the module's public index,
  and it does not open the request tables from a second schema. Boundary DTOs use
  `class-validator` with unknown properties rejected. HTTP errors go through the shared
  RFC 7807 middleware. Persistence tests use a real SQLite file. No new dependency: OIDC
  is the middleware the request plan already uses; reason decryption uses the platform
  crypto module.
- **A decision and its outbox row share one transaction** that contains no HTTP call
  ([ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md)). HR
  approval does not call Payroll, ITSM, Facilities or the HRIS. It sets `FULFILMENT`,
  moves `ORG_DATA_UPDATE` to `IN_PROGRESS`, and writes `employee.transfer.approved.v1`.
  Downstream orchestration consumes that event; this plan does not signal fulfilment
  consumers.
- **Compare-and-swap is OWN-11, not a local lock.** API03 requires `If-Match` equal to
  the `version` API02 returned. The write is `UPDATE … WHERE version = :expected`.
  Idempotent replay is checked before that precondition. This plan does not redefine the
  version field.
- **Front end** is a separate feature from the employee wizard, per
  `.agent/rules/int-standards.react.md` (a feature does not import another feature):
  `employee-portal-web/src/features/internal-transfer-approval/` with `components/`,
  `hooks/`, `api/`, `model/`. Two route groups share that feature: manager inbox and
  decision; HR inbox and validation. Server state is RTK Query only. The session bearer
  token is attached by the existing portal client. There is no transfer login form.
  Reason text is rendered for `HR_BUSINESS_PARTNER` only and is not written to a slice,
  `localStorage`, the URL, analytics or a console statement. Copy is externalised.
  Components are queried in tests by accessible role; the network is mocked with MSW
  using this spec's success and problem bodies. `axe` plus a keyboard and screen-reader
  pass are acceptance of the frontend tasks, not a follow-up.
- **Reason disclosure (OWN-05).** The detail query omits the `reason` key unless the
  token role is `HR_BUSINESS_PARTNER`. The inbox query never selects the ciphertext.

## Data Model

No new table. The request plan's schema is the store.

- **`transfer_request.confirmed_effective_date`** — written only by an HR `APPROVE` on
  `HR_VALIDATION`. Null until then. The column already exists so this spec needs no
  migration to add it.
- **`transfer_request.version`** — incremented by exactly 1 on every successful decision.
  Not incremented on an idempotent replay.
- **Stage outcome** — a rejection is a `COMPLETED` stage plus an audit row whose event
  records the reject. No new stage status and no free-text comment column.
- **`idempotency_record`** — reused. Key is principal + `Idempotency-Key`. The stored
  response is returned for 24 hours. The key does not contain reason text.
- **Audit** — append-only table already revoked for update and delete. Actor is the token
  subject and role. Metadata does not contain reason text.
- **Indexes (stated here, not left for production):** inbox query filters manager rows by
  `assigned_party_ref` + stage `status = IN_PROGRESS'`, and HR rows by stage code
  `HR_VALIDATION` + `IN_PROGRESS`. Both need a composite index. The request-plan stage
  unique key `(transfer_request_id, stage_code)` stays.
- **Migration:** none if the request-plan migration has landed. If it has not, this spec
  does not create a parallel schema; it waits on `internal-transfer-request.T01`.

## Integration Points

| System | Direction | Sync/Async | Failure behaviour | Timeout / retry | Owner |
|---|---|---|---|---|---|
| `transfer_request` aggregate | In-process | Sync, same transaction | Decision rolls back with its outbox row; caller sees 409 or 500 problem, never a half-applied stage | None — no outbound call | Portal |
| Transactional outbox | Out | Async, after commit | `stage-pending.v1`, `approved.v1` or `rejected.v1` retries on the existing relay. The decision stays committed | Relay policy from the request plan (backoff, alert at 15 min unpublished) | Portal |
| Corporate IdP | Inbound | Sync | Gateway 401; service not reached | Platform | Security Engineering |
| HRIS, Payroll, ITSM, Facilities | None | — | This spec does not call them | — | — |
| Notification service | None | — | Events are consumed by `internal-transfer-notifications` after publish. This plan does not POST mail | — | — |

**Events emitted** (allow-list mappers, OWN-09 envelope):

- `employee.transfer.stage-pending.v1` — after `MANAGER_RELEASE` approve (payload stage
  `MANAGER_ACCEPT`) and after `MANAGER_ACCEPT` approve (payload stage `HR_VALIDATION`).
- `employee.transfer.approved.v1` — HR approve. `requestId`, `referenceNo`, `employeeId`,
  `confirmedEffectiveDate`, applicable stage codes. No reason, no names, no contact details.
- `employee.transfer.rejected.v1` — any rejection. No reason text.

## Failure and Boundary Handling

| Scenario | Behaviour | Maps to AC |
|---|---|---|
| Outbox insert fails during approve or reject | Transaction rolls back; stage stays as it was | AC1 |
| Decision on a stage that is not the current waiting approval stage | 409 `invalid-state-transition`; no write | AC5 |
| Caller is not the assignee and not `HR_BUSINESS_PARTNER` | 404 `request-not-found`; response and logs contain no request fields | AC6 |
| Caller-supplied employee id in body, query or path | Ignored. Authorisation uses the token subject and roles | AC6 |
| Manager GET detail | JSON has no `reason` key | AC7 |
| HR GET detail | `reason` key present (null if the employee left it empty) | AC7 |
| Inbox, any caller | No `reason` field | AC7 |
| Idempotency-Key replay, same principal, request, stage and body | Original 200; no second audit or outbox row. Checked before `If-Match` | AC8 |
| Same key, different request, stage or body | 409 `idempotency-key-conflict` | AC8 |
| Missing Idempotency-Key | 400; nothing persisted | AC8 |
| Decision on `WITHDRAWN`, `REJECTED`, `FULFILMENT`, `COMPLETED`, `DRAFT` or `DISCARDED` | 409 `invalid-state-transition` with `currentStatus` | AC9 |
| Withdrawal and decision in flight together | One terminal status. The loser gets 409 | AC9 |
| Manager stage with null `assigned_party_ref` | 409 `assignee-unresolved`; stage stays `IN_PROGRESS`. No live manager lookup and no delegation | AC10 |
| Missing or invalid token | 401 `unauthenticated`; no stage, status, audit or outbox change | AC13 |
| Missing `If-Match` | 400 `precondition-required` | AC15 |
| Stale `If-Match` | 409 `version-conflict` with `currentVersion`; decision not merged | AC15 |
| HR approve without `confirmedEffectiveDate` | 422 `validation-failed`; status stays `HR_VALIDATION` | AC3 |
| Confirmed date on a manager decision or on any reject | 422 | API03 exception table |
| SQLite unavailable | 503 from the shared error middleware; no partial stage write | AC1, AC13 |

## Constitution Check

- [x] **No implementation without an approved spec** — v1.0 is Approved on the spec. v1.3
      (`If-Match`, AC15) is drafted here because the session treated the spec as approved,
      and it stays blocked for implementation until the Gate 1 block names v1.3. See
      Derived From.
- [x] **No vibe coding** — tasks are generated from Sequencing. One task ID per prompt.
- [x] **Test-first** — each task names its UT IDs. Red before implementation.
- [x] **Spec is the contract** — no behaviour beyond the spec. Task-ID references only.
- [x] **No secrets or PII in this plan** — reason text is named as a field class, never
      quoted. No employee names.
- [x] **Context scoped** — a task tags this plan's section, the spec ACs it names, and
      `int-standards.node.md` or `int-standards.react.md`.
- [x] **No new datastore or service** — none. SQLite tables from the request plan.
- [x] **Testing discipline** — Jest + Supertest for API01–API03, including every exception
      row. Real SQLite file for the unique/CAS behaviour. React Testing Library + Playwright
      for the two screen groups. Coverage floor 85% (approval decisions). Contract double
      is not required here: the only outbound is the outbox row, asserted as a persisted
      payload. No snapshot-only tests. No tests that assert on log text except the
      negative PII capture the spec requires (AC11, UT24).
- [x] **Security posture** — reason ciphertext stays encrypted at rest; decrypted only into
      the HR detail response. Managers do not receive the key. Logs use employee ID.
      Identity is the token subject. 404 not 403 (OWN-02). Secrets stay in Secrets Manager
      via the platform crypto module; no new crypto package.
- [x] **Rate-limit decision for every endpoint** —
      API01: 300/hour per principal (inbox polling).
      API02: 300/hour per principal (decision view).
      API03: 30/hour per principal (a decision is rare; the lower cap is the spec's).
      Counters use the existing `rate_limit_counter` table, keyed by a salted hash of the
      token subject plus the route. Silence is not the decision.
- [x] **Cross-domain integration is async** — `approved.v1` is an outbox row. No
      synchronous downstream call.
- [x] **Events via outbox** — approve, reject and stage-pending commit with the state change.
- [x] **Portal does not write the HRIS** — confirmed date is a portal column. Employment
      data is not updated here.
- [x] **Front end state** — Redux Toolkit and RTK Query only.
- [x] **Public API** — existing `/api/v1/internal-transfers`. RFC 7807 on every error.
- [x] **Latency** — API01 and API02 are indexed reads, p95 under 400 ms. API03 is one
      short transaction and an outbox insert, p95 under 700 ms, measured at the gateway.
      No external I/O inside the transaction.
- [x] **Availability 99.9%** — same process as the request API. A notification failure
      cannot roll this transaction back because notification work is not in it.
- [x] **Durability** — same SQLite file and backup as the request aggregate.
- [x] **Accessibility** — WCAG 2.1 AA on the four surfaces (AC12), task-level.
- [x] **Degradation** — this spec has no downstream dependency on the decision path. HRIS
      unavailability does not affect an approval; manager refs were snapshotted at submit.
- [x] **Audit** — every approve and reject writes an immutable audit row with actor, role,
      timestamp and correlation ID.
- [x] **Versioning** — no break of `/api/v1/`. New routes. Events are `.v1` and additive
      only. No migration that rewrites existing rows.

## ADR Candidates

| Decision | Significant? | ADR |
|---|---|---|
| Decisions mutate the request aggregate in-process rather than via a new service | No — reversing it would violate the constitution's "no new service" rule; the alternative is already forbidden | Not warranted |
| `If-Match` on API03 rather than a body version field | No — one header, owned by OWN-11. Reversal is less than a day | Recorded here; mechanics stay in the request spec |
| HR inbox is the same feature folder as the manager inbox | No — one feature, two route groups. Splitting later is a move | Recorded here |
| Rejection stored as audit outcome, not a new stage status | No — matches OWN-10. A new status would be a spec change | Not warranted |

## Explicitly Deferred

- Creating, editing, submitting or withdrawing a request — `internal-transfer-request`.
- Re-running BR1–BR8, or hiding BR9 behind a portal check (BR4). HR's approve records
  that the person finished the disciplinary check. This plan does not call a disciplinary API.
- Fulfilment webhook delivery — `internal-transfer-downstream-orchestration`. This plan
  only emits `approved.v1` and sets `ORG_DATA_UPDATE` to `IN_PROGRESS`.
- Notifications — `internal-transfer-notifications`.
- Return-for-edit after rejection (BRD-001 OQ-07).
- Approver delegation (BR7, OQ-16) and SLA escalation (BR8, OQ-15).
- HR cancellation after `FULFILMENT` has begun.
- Free-text approver comments.
- Manager- or HR-initiated transfers.
- The employee wizard and status page.
- Login, registration, password reset, MFA (OWN-07).
- A second locale.

## Sequencing

1. **Inbox read model (backend)** — API01. Stages the caller may decide, paginated,
   oldest `startedAt` first, no reason.
2. **Decision view (backend)** — API02, including `version`, HR-only `reason`, 404 for
   everyone else.
3. **Approve transaction (backend)** — `MANAGER_RELEASE`, `MANAGER_ACCEPT`, then HR
   approve with confirmed date, each with its outbox row.
4. **Reject transaction (backend)** — terminal `REJECTED`, later stages `CANCELLED`,
   `rejected.v1`. Out-of-order decisions refused.
5. **Concurrency and auth failures (backend)** — idempotency, `If-Match`, withdraw race,
   null assignee, 401. Its own task so the happy path cannot hide them.
6. **Audit and narrative exclusion (backend)** — log capture, append-only audit, rate-limit
   counters.
7. **Manager screens (frontend)** — inbox and decision. No reason field in the UI because
   the key is absent.
8. **HR screens (frontend)** — inbox and validation, including confirmed date and the
   reason rendered from the response and then forgotten by the client.

## Documentation Impact

- [ ] `architecture.md` — no new component or datastore. On merge, the internal-transfer
      module note gains "approval decisions" as a responsibility of the same module.
      Currency check updates when this plan is reviewed.
- [ ] `decisions/` — none
- [ ] `README.md` — none
- [ ] `docs/contracts/` — `stage-pending.v1`, `approved.v1`, `rejected.v1` schemas when
      the approve and reject tasks merge
