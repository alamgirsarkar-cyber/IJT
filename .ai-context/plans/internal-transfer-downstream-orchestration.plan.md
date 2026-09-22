# Plan: Internal Transfer Downstream Orchestration

## Derived From

`.ai-context/specs/internal-transfer-downstream-orchestration.spec.md`

Gate 1 **Approved** v1.3 on 2026-09-11 (Abhijit Adhikari). The file's v1.4 text adds
OWN-11 compare-and-swap on API01 (AC20) and is **not** Approved until a new Gate 1 pass.
This plan sequences AC20 as its own task and marks that task blocked on that pass. The
rest of the plan is the Approved v1.3 contract.

## Status

**Plan Drafted** · **Author:** Alamgir Sarkar · **Reviewer:** Abhijit Adhikari (_plan review pending_)

## Architecture Approach

- **No new service.** Fulfilment is a bounded area of the existing `internal-transfer`
  module: `employee-services/src/internal-transfer/fulfilment/{api,domain,persistence,integration}`.
  Layout, validation, errors and tests follow `.agent/rules/int-standards.node.md`.
  HMAC uses the platform crypto module. No new dependency, and no auth-adjacent package.
- **No employee-facing screen.** The spec's Surfaces section is explicit. Stage labels,
  including `FAILED` and `COMPENSATION_*`, are rendered by `internal-transfer-request`
  (its API04 and T11). This plan does not add a route in `employee-portal-web` and does
  not add a resume, retry or "mark complete" control. There is no React task.
- **Start signal is `employee.transfer.approved.v1`**, consumed by an internal handler
  after the approval transaction has committed. The handler does not run inside the
  approval HTTP request. It does not consume `requested.v1`.
- **Delivery is the existing outbox relay** ([ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md)).
  Applicability flags are read from the stage plan frozen at submit. They are not
  recomputed. Order is sequential: at most one fulfilment work stage is `IN_PROGRESS`.
  The next stage is signalled only when the previous applicable one is `COMPLETED`.
- **The portal does not write the HRIS** ([ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)).
  `ORG_DATA_UPDATE` is an event. The HRIS adapter is the system that writes employment data.
- **API01 is machine-to-machine.** Authentication is the webhook signature contract in
  the spec (HMAC-SHA256 over the five-line canonical string, ±300 s, key id for rotation).
  An employee bearer token on this URL is 401. Comparison is constant-time. The raw body
  is hashed before JSON parse. Secrets come from AWS Secrets Manager at runtime. The body,
  signature and secret are not logged.
- **Consumers are not built** (architecture known debt). Until they exist, outbox rows
  retry and stages stay `IN_PROGRESS`. That is the specified resting shape, not a bug
  this plan papers over with a fake completer.
- **Transactions contain no outbound HTTP.** The relay is the only caller of Payroll,
  ITSM, Facilities and the HRIS adapter webhook.

## Data Model

No new datastore. Additive use of tables the request plan already creates.

- **`transfer_request_stage.status`** — this spec is the writer for fulfilment work
  stages and for `EMPLOYEE_CONFIRMATION` (portal-set under BR7). Legal values include
  the additive set `FAILED`, `COMPENSATION_REQUESTED`, `COMPENSATED`, `COMPENSATION_FAILED`.
  The request migration must allow those values (a check constraint that listed only the
  original five would reject this spec). That constraint, if present, is widened in this
  spec's migration additively. Forward-only. Rollback leaves the extra values unused.
- **`idempotency_record`** — one row per API01 `eventId`. Stores a hash of the raw body,
  not the body, so a replay can be compared without retaining `failureCode` text beyond
  the pattern already accepted. TTL follows the request plan's 24 h only if the hash
  check does not need to last longer: BR11's conflict must still be detectable after
  24 h, so this record is retained for the life of the request (7 years with the
  aggregate), not 24 hours. The key is `eventId`. It does not contain a name or a narrative.
- **`transfer_request_outbox`** — four event types, each built by an allow-list mapper.
- **`transfer_request_audit`** — actor role `SYSTEM` or the configured webhook source id.
  Never a person's name. Append-only, already revoked.
- **`transfer_request.version`** — AC20's compare-and-swap. Not implemented until v1.4
  is Approved. The column already exists.
- **Index:** `idempotency_record (event_id)` unique, stated here so API01's conflict
  check is not a table scan.

## Integration Points

| System | Direction | Sync/Async | Failure behaviour | Timeout / retry | Owner |
|---|---|---|---|---|---|
| Approval-chain `approved.v1` | In (outbox) | Async | Handler does not start fulfilment until the event is published. A duplicate delivery is a no-op once `ORG_DATA_UPDATE` is already `IN_PROGRESS` | Relay | Portal |
| HRIS org adapter webhook | Out | Async | Outbox retains the `fulfilment-stage.v1` row. Request stays `FULFILMENT`. No employee error | Exponential backoff; alert at 15 min unpublished | HR Systems |
| Payroll webhook | Out | Async | Same. Stage stays `IN_PROGRESS` if the consumer does not exist | Same | Finance Systems |
| ITSM webhook | Out | Async | Same. Ticket adapter is their backlog | Same | IT Service Management |
| Facilities webhook | Out | Async | Same | Same | Facilities |
| API01 stage-completion | In | Sync HTTP, no further downstream call inside the transaction | Invalid signature 401, no state change. Valid report commits stage, audit and any follow-on outbox rows together | Caller retries 409 `version-conflict` (v1.4) and transient 5xx. 4xx other than 409 is not retried by this plan | Portal |
| Notification service | None | — | `completed.v1` and `fulfilment-failed.v1` are available for the notifications spec. This plan does not mail anyone | — | — |

**Events emitted** — envelope in the spec (`eventId`, `eventType` with `.v1`,
`eventVersion`, `occurredAt`, `correlationId`, `requestId`, `payload`):

- `employee.transfer.fulfilment-stage.v1`
- `employee.transfer.fulfilment-failed.v1` (exactly one per failure)
- `employee.transfer.compensate.v1` (one per already-`COMPLETED` work stage, reverse sequence)
- `employee.transfer.completed.v1`

## Failure and Boundary Handling

| Scenario | Behaviour | Maps to AC |
|---|---|---|
| Outbox write fails while starting `ORG_DATA_UPDATE` | Transaction rolls back; stage is not left `IN_PROGRESS` without a signal | AC1 |
| `SUCCESS` on the current stage | That stage `COMPLETED`; next applicable work stage `IN_PROGRESS` and signalled; `applicable: false` rows never signalled | AC2 |
| Last applicable work stage `SUCCESS` | `EMPLOYEE_CONFIRMATION` `COMPLETED`; request `COMPLETED`; one `completed.v1` | AC3 |
| `FAILED` on an `IN_PROGRESS` work stage | Stage `FAILED`; request stays `FULFILMENT`; one `fulfilment-failed.v1`; compensate signals for earlier `COMPLETED` stages; no `completed.v1`. If the failing stage is org update, zero compensate events | AC4 |
| Same `eventId`, byte-identical body | 200; no second audit or outbox row; `version` not incremented | AC5 |
| Same `eventId`, different body | 409 `idempotency-key-conflict`; no write | AC5 |
| Employee or approver HTTP handler | No call to Payroll, ITSM, Facilities or an HRIS write | AC6 |
| Payload or API01 log | No reason, legal name or contact detail. `failureCode` that fails `^[A-Z0-9_]{1,64}$` is 422 and is not logged | AC7, AC15 |
| Bad HMAC, stale timestamp, unknown or retired key id | 401 `unauthenticated`; no state change; response does not list known sources | AC8, AC16 |
| Report while request is not `FULFILMENT` | 409 `invalid-state-transition` | AC9 |
| Employee bearer token and no valid HMAC | 401 | AC11 |
| Later work stages still `NOT_STARTED` when one stage fails | Those stages `CANCELLED` in the same transaction and never signalled. `EMPLOYEE_CONFIRMATION` stays `NOT_STARTED` | AC12 |
| Compensation `SUCCESS` | Stage `COMPENSATED`; request stays `FULFILMENT`; nothing re-signalled | AC13 |
| Compensation `FAILED` | Stage `COMPENSATION_FAILED`; no further compensate event; no portal retry | AC14 |
| Report against `FAILED` or `CANCELLED` | 409. No scheduled job retries the stage | AC17 |
| Report for a stage that is not yet `IN_PROGRESS` | 409 with `currentStageStatus`; no event | AC19 |
| Two reports read the same `version` | One commits and increments by 1; the other is 409 `version-conflict`. **Blocked until v1.4 is Approved** | AC20 |
| `reportType` absent | 422. Never defaulted | API01 |
| `EMPLOYEE_CONFIRMATION` as `stageCode` | 422 | API01 |

## Constitution Check

- [x] **No implementation without an approved spec** — v1.3 is Approved. AC20 is sequenced
      and blocked, not implemented under the v1.3 approval.
- [x] **No vibe coding** — tasks from Sequencing only.
- [x] **Test-first** — UT IDs named per task. Integration rows UT28–UT30 use a contract
      double of the downstream consumer, not a stub shaped like the handler.
- [x] **Spec is the contract** — no resume API, no parallel fan-out, no employee mail.
- [x] **No secrets or PII in this plan** — signing secrets are named as a Secrets Manager
      lookup, never a value. `failureCode` is a pattern, not an example sentence.
- [x] **Context scoped** — one task, its ACs, this plan, `int-standards.node.md`.
- [x] **No new datastore or service** — SQLite only. No new service.
- [x] **Testing discipline** — Jest + Supertest for API01's full exception table. Real
      SQLite file. Coverage floor 85% because this module handles downstream orchestration.
      No snapshot-only tests. No skipped tests.
- [x] **Security posture** — HMAC, not employee tokens (OWN-06). Constant-time compare.
      Body not logged. Allow-list event payloads. Employee ID permitted. No narrative.
- [x] **Rate-limit decision** — API01: 600 per hour per configured source (HRIS adapter,
      Payroll, ITSM, Facilities), as the spec states. Counter key is the source key id,
      not an employee id. No other endpoint is added, so no other limit is invented.
- [x] **Cross-domain integration is async** — relay only. A request path from an employee
      or approver makes no fulfilment HTTP call.
- [x] **Outbox** — stage signal, failure, compensate and completed commit with the state change.
- [x] **No HRIS write** — event only.
- [x] **Front end state** — not touched, because the spec defines no screen. The employee
      view stays in the request feature's Redux Toolkit usage.
- [x] **Public API** — one new route under `/api/v1/`. RFC 7807. Not an OIDC route.
- [x] **Latency** — API01 is one transaction and no outbound call, inside the 700 ms
      write budget at the gateway. Employee read latency is unchanged.
- [x] **Availability** — a missing consumer degrades fulfilment stages, not the portal's
      other journeys. Submit and approval do not wait on webhooks.
- [x] **Durability** — same SQLite backup.
- [x] **Accessibility** — no new screen. Not a waiver for the request spec's status view.
- [x] **Degradation** — unpublished outbox rows do not fail an unrelated journey.
- [x] **Audit** — every transition this spec performs writes an append-only row (AC10).
- [x] **Versioning** — events are `.v1`, additive payloads. The stage-status values added
      in v1.2 are additive. A breaking payload change would be a new suffix, not this plan.

## ADR Candidates

| Decision | Significant? | ADR |
|---|---|---|
| Sequential fulfilment rather than parallel fan-out | Already decided in the spec (BR2) and ADR-0001. Reversal is a new spec increment, more than a day | ADR-0001 stands. No new ADR |
| `eventId` idempotency retained for the life of the request, not 24 h | Yes for correctness of BR11, but reversal is a retention change on one table, under a day if done before data exists | Recorded here. Not a new ADR unless retention policy is challenged |
| In-transaction CAS without `If-Match` on API01 | Specified in v1.4 / OWN-11. Not chosen by this plan | No ADR until v1.4 is Approved |
| No portal resume | Specified (BR10, OWN-08). Reversal is a new spec | Not an ADR candidate for this plan |

## Explicitly Deferred

- Approval decisions — `internal-transfer-approval-chain`.
- Employee submit, withdraw and status UI — `internal-transfer-request`. The failed-fulfilment
  labels are that spec's T11.
- Notifications, including completion mail — `internal-transfer-notifications`.
- Payroll, ITSM and Facilities consumer implementations, and the ITSM ticket adapter.
- Writing the HRIS as system of record.
- Retry UI, "mark complete", automatic resume, portal-driven resume (BR10, OQ-20).
- Parallel fan-out of payroll, IT and facilities (BR2).
- Retry of a compensate signal beyond the relay's own delivery attempts (BR9).
- Verifying that a reversal actually happened inside the downstream system.
- HR cancellation after `COMPLETED`.
- SLA on fulfilment stages (OQ-15).
- Starting fulfilment from `requested.v1`.
- **AC20 / v1.4 compare-and-swap** — sequenced as T07 and not started until Gate 1
  re-reviews v1.4.

## Sequencing

1. **Webhook authentication (backend)** — canonical string, replay window, key rotation,
   bearer-token rejection. No state change on 401.
2. **Start fulfilment (backend)** — consume `approved.v1`; `ORG_DATA_UPDATE` to
   `IN_PROGRESS` with one `fulfilment-stage.v1` row, or neither.
3. **Sequential success (backend)** — `SUCCESS` advances the next applicable stage or
   completes the request. Out-of-order and `applicable: false` reports refused.
4. **Failure, cancel and compensate (backend)** — `FAILED`, BR8 cancellations, reverse-sequence
   `compensate.v1`, including the zero-compensate case when org update itself fails.
5. **Compensation acknowledgement (backend)** — `COMPENSATED` / `COMPENSATION_FAILED`,
   and the refusal to restart a `FAILED` or `CANCELLED` stage.
6. **Idempotency, allow-list and audit (backend)** — `eventId` replay and conflict,
   envelope, PII absence, `failureCode` pattern, append-only audit, rate-limit counter.
7. **Compare-and-swap (backend)** — AC20. **Blocked** until v1.4 Gate 1 Approval.
   Not folded into T03–T06, so those can merge against the Approved v1.3 contract.

There is no frontend step.

## Documentation Impact

- [ ] `architecture.md` — on merge, Known Constraints records that the fulfilment contract
      is specified and the consumers are still unbuilt; Integration Points gain API01 as
      the inbound completion route. Currency check updates when this plan is reviewed.
- [ ] `decisions/` — none. ADR-0001 and ADR-0002 already cover the approach.
- [ ] `README.md` — relay configuration for four webhook URLs and signing key ids is an
      operational note when T02 merges. No secret values in the README.
- [ ] `docs/contracts/` — the four event schemas and the API01 signature contract when
      T02–T04 merge
