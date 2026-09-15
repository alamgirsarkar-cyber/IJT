# Spec: Internal Transfer Downstream Orchestration

## Spec ID

`internal-transfer-downstream-orchestration`

## Status

**Approved (Gate 1) — v1.3**, 2026-09-11 by Abhijit Adhikari. **v1.4 (2026-09-15)** adds
OWN-11 compare-and-swap on API01 and **requires a new Gate 1 pass** (governance
re-review/supersede). Do not treat v1.4 as Approved until re-reviewed. Full state machine
in `.ai-context/status.md`.

**Reviewer note:** v1.2 answered all five Blocker and seven Should-fix findings. OQ-20 is
now **Resolved** — no automatic and no portal-driven resume in v1 (BR10, AC17, OWN-08).
v1.4 states how this spec participates in the shared aggregate `version` (request-spec
G1-F18). Finding-by-finding disposition is in _Gate 1 Review_ at the end of this file.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role                               | Name             | Date                           |
| ---------------------------------- | ---------------- | ------------------------------ |
| Author / owner                     | Alamgir Sarkar   | 2026-09-03                     |
| Gate 1 reviewer (never the author) | Abhijit Adhikari | 2026-09-11 — **Approved** on v1.3 (was Changes Requested on v1.0, 2026-09-09) |
| Gate 2 reviewer                    | Tapas Dutta      | —                              |

Gate 1 sign-off is a dated `## Gate 1 Review` block on this spec (`.agent/rules/governance.md`). Findings worksheet: `.ai-context/reviews/internal-transfer-downstream-orchestration.gate1.md`.

## Intent

After HR has approved an internal transfer request, the portal records fulfilment of the
conditional back-office stages that were fixed at submission — organisational data update
always; payroll assignment update only when cost centre or grade differs; IT access change
only when department differs; facilities arrangement only when location differs — without
calling those systems on an employee or approver request path. Each applicable stage is
signalled through the transactional outbox as an HTTPS webhook payload. Each downstream
system reports completion or failure back to the portal. When every applicable fulfilment
stage has completed, the request becomes `COMPLETED`. When a stage reports failure, that
stage is recorded `FAILED`, fulfilment stages still waiting are cancelled, already
completed fulfilment stages are signalled to compensate and must acknowledge the reversal,
and the request rests in `FULFILMENT` — the portal invents no retry UI and no resume, and
HR Operations closes the transfer out off-portal. This spec does not write employment data
into the HRIS, does not approve transfers, and does not send employee notifications.

## Context

- Builds on: `.ai-context/architecture.md` — _Integration Points_, _Authentication and
  Authorisation_, _Known Constraints and
  Debt_; [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md);
  [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)
- Constitution: `.ai-context/constitution.md` — no synchronous Payroll/ITSM/Facilities call
  on a portal request path; portal never writes HRIS as system of record; outbox is
  mandatory
- Related: `.ai-context/specs/internal-transfer-request.spec.md` — stage codes, sequence
  numbers and applicability flags created at submit (OQ-08 recorded there). That spec is
  the **single source of truth for request-level status names** and for how a stage status
  is rendered to the employee; the matrix below is the fulfilment subset, not a second
  contract. **Cross-spec follow-up:** v1.2 adds three additive stage statuses
  (`COMPENSATION_REQUESTED`, `COMPENSATED`, `COMPENSATION_FAILED`) that the request spec's
  status view (its API04) must be able to render — display labels are owned there, not here.
- Related: `.ai-context/specs/internal-transfer-approval-chain.spec.md` — **In Peer Review**.
  Emits `employee.transfer.approved.v1` and sets `FULFILMENT`. This spec consumes that
  transition, not `employee.transfer.requested.v1` (managers and HR must finish first —
  BRD-001 OQ-02).
- Related: `internal-transfer-notifications` — consumes `employee.transfer.completed.v1`
  and, from v1.2, the named failure event `employee.transfer.fulfilment-failed.v1`;
  notification loss must not change request status. Whether a fulfilment failure notifies
  the employee at all is that spec's decision, not this one's — this spec only guarantees
  the event exists and carries no PII.
- Shared facts: `.ai-context/ownership_index.md` (OWN-06, OWN-07, OWN-08, OWN-11)
- API contract consumed: downstream webhook URLs configured per function; inbound
  completion webhook defined below. HRIS write is performed by the HRIS integration
  layer, not by this service

Architecture already records that Payroll, ITSM and Facilities consumers are **not built**.
v1 of this spec still defines the contract so those teams can implement against it. Until
a consumer exists, outbox rows retry and remain unpublished; the employee-facing request
stays `FULFILMENT` with those stages `IN_PROGRESS` (architecture: known debt). That is
visible, not silent.

## Business Rules

| Rule ID                                          | Rule                                                                                                                                                                                                                                                                      | Source                                     | Business or technical decision                 |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ---------------------------------------------- |
| `internal-transfer-downstream-orchestration.BR1` | `ORG_DATA_UPDATE` always applies. `PAYROLL_UPDATE` applies only if target cost centre or grade differs from the snapshot. `IT_ACCESS` applies only if target department differs. `FACILITIES` applies only if target location differs. Flags are **not** recomputed here. | BRD-001 OQ-08                              | Business (already applied at submit)           |
| `internal-transfer-downstream-orchestration.BR2` | Fulfilment stage order is **strictly sequential** and settled for v1, not undecided: `ORG_DATA_UPDATE` (sequence 4) must reach `COMPLETED` before `PAYROLL_UPDATE` (5), `IT_ACCESS` (6) or `FACILITIES` (7) is signalled, and those three, when applicable, are signalled one at a time in sequence-number order, skipping `applicable: false` rows. **At most one fulfilment stage is `IN_PROGRESS` on a request at any time.** Parallel fan-out is deferred, not open — see Out of Scope.                     | BRD-001 journey stages 4–7                 | Business (as-is order); sequencing technical |
| `internal-transfer-downstream-orchestration.BR3` | The portal does not write employment or org data to the HRIS. It emits an event; the HRIS (or its adapter) is system of record for that update.                                                                                                                           | BRD-001 OQ-09; ADR-0002                    | Technical                                      |
| `internal-transfer-downstream-orchestration.BR4` | No Payroll, ITSM or Facilities HTTP call is made inside an employee or approver request. Delivery is outbox relay → HTTPS webhook.                                                                                                                                        | BRD-001 OQ-10; ADR-0001; constitution      | Technical                                      |
| `internal-transfer-downstream-orchestration.BR5` | Downstream systems report success or failure back. Delivery is at-least-once in both directions: consumers dedupe on the envelope `eventId` (`requestId` + `stageCode` + `eventType` is the natural key of a stage signal, not the dedupe key), and the portal dedupes inbound reports on API01's `eventId` (BR11).                                                                                                                  | ADR-0001                                   | Technical                                      |
| `internal-transfer-downstream-orchestration.BR6` | On a reported stage failure, the portal records that stage as `FAILED` and emits a compensate signal for every fulfilment stage already `COMPLETED` on that request, in reverse sequence. It does not mark the request `COMPLETED`.                                       | BRD-001 spec map (compensation on failure) | Business intent; mechanism technical           |
| `internal-transfer-downstream-orchestration.BR7` | `EMPLOYEE_CONFIRMATION` is completed by the portal when every applicable stage among `ORG_DATA_UPDATE`, `PAYROLL_UPDATE`, `IT_ACCESS` and `FACILITIES` is `COMPLETED`. It is not an employee click. Telling the employee is notifications spec.                           | BRD-001 journey stage 8                    | Business                                       |
| `internal-transfer-downstream-orchestration.BR8` | On a reported stage failure, every applicable **fulfilment work stage** on that request still `NOT_STARTED` becomes `CANCELLED` and is never signalled. `EMPLOYEE_CONFIRMATION`, being portal-set rather than signalled, stays `NOT_STARTED`: BR7's precondition can no longer be met, and the request is **not** terminal. | Gate 1 G1-F04 (2026-09-09)                 | Technical, inside BR6's business intent        |
| `internal-transfer-downstream-orchestration.BR9` | A compensate signal must be **acknowledged**, not assumed. The consumer reports the outcome of its reversal through API01 with `reportType: COMPENSATION`, moving that stage from `COMPENSATION_REQUESTED` to `COMPENSATED` or `COMPENSATION_FAILED`. An unacknowledged compensate signal is never treated as a completed reversal. | Gate 1 G1-F03 (2026-09-09)                 | Technical                                      |
| `internal-transfer-downstream-orchestration.BR10` | v1 has **no automatic and no portal-driven resume** after `FAILED` or `COMPENSATION_FAILED`. The request stays `FULFILMENT`, the named operational owner is **HR Operations** (OWN-08), and remaining work is completed off-portal. Restarting fulfilment through the portal requires a new spec increment at Gate 1. | BRD-001 OQ-20 (**Resolved 2026-09-11, Product v1 — portal resume deferred**), OQ-06; Gate 1 G1-F02, G1-F05 | Business decision |
| `internal-transfer-downstream-orchestration.BR11` | `eventId` is API01's idempotency key. The same `eventId` replayed with a byte-identical body is a no-op replay returning the current resource; the same `eventId` with a different body is a conflict that changes nothing. | Gate 1 G1-F08 (2026-09-09); constitution (idempotency records) | Technical                                      |

## Fulfilment Lifecycle and State Transitions

`internal-transfer-request` owns request-level status names (its _Request State Machine_)
and the stage plan with its sequence numbers 1–8 (its _Stage Plan_). What follows is the
**fulfilment subset** — the only statuses and transitions this spec sets — and is to be
read against that spec, never instead of it. At request level this spec performs exactly
one transition: `FULFILMENT → COMPLETED` (BR7). It never sets `REJECTED`, `WITHDRAWN` or
`CANCELLED` at request level, and a fulfilment failure never moves the request out of
`FULFILMENT`.

Two groups of stage, named here because the rules below treat them differently. The
**fulfilment work stages** are `ORG_DATA_UPDATE` (4), `PAYROLL_UPDATE` (5), `IT_ACCESS` (6)
and `FACILITIES` (7) — each signalled to a consumer, each reported back through API01.
`EMPLOYEE_CONFIRMATION` (8) is **portal-set**: it is never signalled, never reported, and is
completed by the portal alone under BR7. Stages 1–3 belong to
`internal-transfer-approval-chain`.

### Stage status vocabulary

| Stage status | Meaning | Set by |
| --- | --- | --- |
| `NOT_STARTED` | Row exists from the stage plan; not yet signalled | `internal-transfer-request` at submit |
| `IN_PROGRESS` | Signalled to its consumer; awaiting a report | This spec (AC1, AC2) |
| `COMPLETED` | Consumer reported `SUCCESS` | This spec (AC2, AC3) |
| `FAILED` | Consumer reported `FAILED` | This spec (AC4) |
| `CANCELLED` | Will not run — BR8 after a failure on the same request; or withdrawal, which the request spec owns | This spec (AC12); `internal-transfer-request` (its AC14) |
| `COMPENSATION_REQUESTED` | A compensate signal has been emitted for this previously `COMPLETED` stage and not yet acknowledged | This spec (AC4) |
| `COMPENSATED` | Consumer acknowledged that it reversed this stage | This spec (AC13) |
| `COMPENSATION_FAILED` | Consumer reported that the reversal itself failed | This spec (AC14) |

The last three are **new in v1.2 and additive** (constitution — additive-only schema
evolution) and apply only to fulfilment stages. Their employee-facing display labels are
owned by `internal-transfer-request`, not here (see Context).

### The four paths

**1. Completion.** `employee.transfer.approved.v1` starts `ORG_DATA_UPDATE` (AC1). Each
`SUCCESS` report completes that stage and signals the next applicable one in sequence
order (AC2). When the last applicable stage completes, `EMPLOYEE_CONFIRMATION` completes,
the request becomes `COMPLETED` and `employee.transfer.completed.v1` is emitted (AC3).

**2. Failure.** A `FAILED` report puts that stage in `FAILED`, emits exactly one
`employee.transfer.fulfilment-failed.v1`, and leaves the request in `FULFILMENT` (AC4).
Every applicable fulfilment stage still `NOT_STARTED` becomes `CANCELLED` and is never
signalled (BR8, AC12). `EMPLOYEE_CONFIRMATION` stays `NOT_STARTED` — BR7's precondition
can no longer be met, and the request is deliberately not terminal.

**3. Compensation.** One `employee.transfer.compensate.v1` is emitted per fulfilment stage
already `COMPLETED` on that request, in reverse sequence order, and each of those stages
moves to `COMPENSATION_REQUESTED` (AC4). The consumer performs the reversal and
acknowledges it through API01 with `reportType: COMPENSATION` — `COMPENSATED` on success
(AC13), `COMPENSATION_FAILED` on failure (AC14). An unacknowledged compensate signal is
never counted as a completed reversal (BR9). Where the failing stage is `ORG_DATA_UPDATE`
itself, no fulfilment stage is yet `COMPLETED`, so **zero** compensate events are emitted —
that is the correct outcome, not a missing one. The portal does not retry a reversal; the
only retries are the outbox relay's delivery attempts for the signal itself.

**4. Recovery — v1 is off-portal.** Nothing in the portal restarts fulfilment. The request
rests in `FULFILMENT` with a `FAILED` stage, the stage history is complete and immutable,
and **HR Operations** (OWN-08) owns closing the transfer out off-portal. There is no resume
API, no retry UI, no HR "mark complete" action, and no automatic retry of a failed stage
(BR10). Adding any of those is a new spec increment that re-enters at Gate 1
(`governance.md` — re-review convention). **OQ-20 is Resolved 2026-09-11:** this section
is the v1 contract.

### State transition matrix — fulfilment stages

Every `(from, trigger)` pair not listed is refused by API01 as 409
`invalid-state-transition` with no state change and no audit row for a transition that did
not happen. That includes out-of-order reports, such as a `PAYROLL_UPDATE` report arriving
while `ORG_DATA_UPDATE` is still `IN_PROGRESS`.

| From | Trigger | To | Side effects, committed in one transaction |
| --- | --- | --- | --- |
| `NOT_STARTED` | `approved.v1` handled (`ORG_DATA_UPDATE` only) | `IN_PROGRESS` | One `fulfilment-stage.v1` outbox row + audit row |
| `NOT_STARTED` | Previous applicable fulfilment stage reached `COMPLETED` | `IN_PROGRESS` | One `fulfilment-stage.v1` outbox row + audit row |
| `NOT_STARTED` | Another fulfilment work stage on the request reported `FAILED` (BR8) — `EMPLOYEE_CONFIRMATION` excepted, it stays `NOT_STARTED` | `CANCELLED` | Audit row only — never signalled |
| `IN_PROGRESS` | API01, `reportType: FULFILMENT`, `outcome: SUCCESS` | `COMPLETED` | Audit row; next applicable stage signalled, or `completed.v1` when it was the last |
| `IN_PROGRESS` | API01, `reportType: FULFILMENT`, `outcome: FAILED` | `FAILED` | Audit row; one `fulfilment-failed.v1`; one `compensate.v1` per already-`COMPLETED` fulfilment stage, reverse sequence; later `NOT_STARTED` stages `CANCELLED` |
| `COMPLETED` | A fulfilment stage on the same request reported `FAILED` | `COMPENSATION_REQUESTED` | `compensate.v1` outbox row + audit row |
| `COMPENSATION_REQUESTED` | API01, `reportType: COMPENSATION`, `outcome: SUCCESS` | `COMPENSATED` | Audit row |
| `COMPENSATION_REQUESTED` | API01, `reportType: COMPENSATION`, `outcome: FAILED` | `COMPENSATION_FAILED` | Audit row; off-portal escalation to OWN-08; no portal retry |
| `FAILED`, `CANCELLED`, `COMPENSATED`, `COMPENSATION_FAILED` | Any API01 report | Unchanged | 409; no state change (a byte-identical `eventId` replay still returns 200 per BR11) |

### Request-level transitions this spec performs

| From | Trigger | To | Side effects |
| --- | --- | --- | --- |
| `FULFILMENT` | Last applicable fulfilment stage reached `COMPLETED` | `COMPLETED` | `EMPLOYEE_CONFIRMATION` → `COMPLETED`; `completed.v1`; audit row |
| `FULFILMENT` | Any fulfilment stage reported `FAILED` | `FULFILMENT` — unchanged, by design | `fulfilment-failed.v1`; compensate fan-out; BR8 cancellations; audit rows |

### Where a request can come to rest

| Resting shape | Stage picture | Request status | Who acts next |
| --- | --- | --- | --- |
| Completed | Every applicable stage `COMPLETED`, `EMPLOYEE_CONFIRMATION` `COMPLETED` | `COMPLETED` | Nobody |
| Failed, reversal acknowledged | One `FAILED`; earlier stages `COMPENSATED`; later applicable stages `CANCELLED` | `FULFILMENT` | HR Operations, off-portal (OWN-08) |
| Failed, reversal itself failed | One `FAILED`; at least one `COMPENSATION_FAILED` | `FULFILMENT` | HR Operations, off-portal, escalated (OWN-08) |
| Consumer not built | A stage stays `IN_PROGRESS` with no report | `FULFILMENT` | Nobody — accepted architecture debt, visible rather than silent |

## Authentication and Authorisation

Cites BRD-001 BR14, KD-07 and `.ai-context/architecture.md` — _Authentication and
Authorisation_. This spec adds **no** employee or approver OIDC API.

| Concern | Rule on this spec |
| --- | --- |
| Authentication | API01 authenticates with an HMAC signature over the canonical string below, using the source's signing secret from Secrets Manager. Not an employee access token. |
| Authorisation | A valid signature authorises only fulfilment stage completion, failure and compensation reports. `requestId` and `employee` fields in the body are data, never identity. |
| Failure | Missing, invalid, replayed or unknown-key signature → 401 `unauthenticated`; stages unchanged; body not logged (AC8, AC16). An employee OIDC bearer token on this URL is not accepted (AC11). |
| Employee UI | None. Fulfilment visibility is the request spec status view, which uses employee OIDC. |

### Webhook signature contract

This **refines** the architecture's "HMAC of the body with the source's signing secret"
row with the detail an implementer would otherwise have to invent. It is not a second
scheme.

| Header | Required | Value |
| --- | --- | --- |
| `X-Portal-Webhook-Key-Id` | Yes | Identifier of the signing key used, so keys can rotate without a flag day |
| `X-Portal-Webhook-Timestamp` | Yes | RFC3339 UTC instant at which the caller signed the request |
| `X-Portal-Webhook-Signature` | Yes | `sha256=<lower-case hex>` of the HMAC below |

**Canonical string** — exactly these five fields, joined by a single `\n`, with no trailing
newline, so two implementations cannot disagree about what was signed:

```
<key id>
<timestamp header, byte-for-byte as sent>
POST
/api/v1/internal-transfers/webhooks/stage-completion
<lower-case hex SHA-256 of the raw request body bytes>
```

- **Algorithm:** HMAC-SHA256 over that string with the source's secret. Comparison is
  constant-time. The raw body is hashed **before** any JSON parsing or re-serialisation.
- **Replay window:** the timestamp must be within **±300 seconds** of portal time, or 401.
  The window bounds replay; `eventId` (BR11) is the durable guard, because a replay inside
  the window must also be a no-op.
- **Rotation:** more than one key id may be valid at once during a rotation, which is the
  point of sending the key id. An unknown or retired key id is 401, never 403 — an
  unauthenticated caller learns nothing about which sources exist.
- **Secrets:** from AWS Secrets Manager only (constitution). Never in this spec, in
  committed config, in `.env`, in a log line or in an agent prompt. No signature, secret,
  key material or request body is logged at any level (AC8).

## API Contract

Employee OIDC APIs are **not** added. Operators see fulfilment through the existing
employee status view (`internal-transfer-request.API04`) once stage rows change.

---

### `internal-transfer-downstream-orchestration.API01` — POST `/api/v1/internal-transfers/webhooks/stage-completion`

**Purpose:** a downstream adapter reports the outcome of one fulfilment stage — either the
fulfilment work itself (`reportType: FULFILMENT`) or the reversal of that stage after a
failure elsewhere on the request (`reportType: COMPENSATION`, BR9).
**Auth:** webhook signature per _Webhook signature contract_ above. Not an employee token.
Missing, invalid, replayed or unknown-key signatures are 401. The body must never be
trusted for the identity of an employee.
**Rate limit:** 600 per hour per configured source (HRIS adapter, Payroll, ITSM,
Facilities).
**Idempotency:** `eventId` in the body is the idempotency key (BR11). A replay of the same
`eventId` with a byte-identical body returns 200 with the current resource and writes no
second audit row, no second outbox row and no second stage transition. The same `eventId`
with a different body is 409 `idempotency-key-conflict` — the same problem type
`internal-transfer-request.API03` uses, so consumers meet one convention across the portal.
Byte-identical replay is checked **before** the version compare-and-swap and does not
increment `version`.

**Concurrency (OWN-11):** this endpoint does **not** take `If-Match`. The caller is an
HMAC-authenticated adapter; the idempotency key is `eventId`. The handler reads the
aggregate `version` at the start of its transaction and compare-and-swaps
`WHERE version = :read`. Zero rows → 409 `version-conflict` (the adapter retries). A
successful report increments `version` by 1. Mechanics are owned by
`internal-transfer-request` § _Compare-and-swap on the shared aggregate version_; this
endpoint participates, it does not redefine the field.

**Request payload:**

```json
{
  "eventId": "uuid",
  "requestId": "uuid",
  "stageCode": "ORG_DATA_UPDATE | PAYROLL_UPDATE | IT_ACCESS | FACILITIES",
  "reportType": "FULFILMENT | COMPENSATION",
  "outcome": "SUCCESS | FAILED",
  "occurredAt": "RFC3339",
  "failureCode": "SHORT_CODE, optional"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `eventId` | UUID | Yes | Idempotency key (BR11) |
| `requestId` | UUID | Yes | Data, never identity |
| `stageCode` | Enum — the four fulfilment stage codes | Yes | `EMPLOYEE_CONFIRMATION` is portal-set (BR7) and is rejected here |
| `reportType` | Enum `FULFILMENT` \| `COMPENSATION` | Yes | Absent is 422, never defaulted — a defaulted report type is how a reversal gets mistaken for fulfilment |
| `outcome` | Enum `SUCCESS` \| `FAILED` | Yes | Meaning depends on `reportType` per the matrix above |
| `occurredAt` | RFC3339 | Yes | Consumer's clock, recorded in audit; portal ordering uses its own commit order |
| `failureCode` | String matching `^[A-Z0-9_]{1,64}$` | No | Only meaningful when `outcome` is `FAILED`. A closed, consumer-defined code so the operational owner has something actionable. **Not** a free-text field — narrative, names or reasons here are a constitution breach, and a value failing the pattern is 422 (AC15) |

No employee name, reason text or narrative in any field.

**Success response (200):**

```json
{
  "requestId": "uuid",
  "stageCode": "ORG_DATA_UPDATE",
  "reportType": "FULFILMENT",
  "stageStatus": "COMPLETED",
  "requestStatus": "FULFILMENT"
}
```

When the report completes the last applicable fulfilment stage, `requestStatus` is
`COMPLETED`. After a `FAILED` report, `requestStatus` stays `FULFILMENT` and `stageStatus`
is `FAILED` — the response never implies a retry is available.

**Exceptions:**

| Code | Condition                                                                                                                            | Response body                                                   |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------- |
| 401  | Missing or invalid signature                                                                                                         | Problem, `type: unauthenticated`                                |
| 401  | Timestamp outside the ±300 s replay window, or an unknown or retired `X-Portal-Webhook-Key-Id`                                       | Problem, `type: unauthenticated` — no detail about known sources |
| 404  | `requestId` does not exist                                                                                                           | Problem, `type: request-not-found`                              |
| 409  | Request status is not `FULFILMENT`                                                                                                   | Problem, `type: invalid-state-transition`, `currentStatus`      |
| 409  | `reportType: FULFILMENT` and the stage is not `IN_PROGRESS` — already terminal, still `NOT_STARTED`, not yet signalled, or out of order | Problem, `type: invalid-state-transition`, `currentStageStatus` |
| 409  | `reportType: COMPENSATION` and the stage is not `COMPENSATION_REQUESTED`                                                             | Problem, `type: invalid-state-transition`, `currentStageStatus` |
| 409  | `eventId` reused with a different body (BR11)                                                                                        | Problem, `type: idempotency-key-conflict`                       |
| 409  | Compare-and-swap lost the aggregate `version` (OWN-11) — not a byte-identical replay                                                 | Problem, `type: version-conflict`, with `currentVersion`        |
| 422  | Unknown `stageCode`, `EMPLOYEE_CONFIRMATION` as `stageCode`, missing or unknown `reportType`, `outcome` not `SUCCESS`/`FAILED`, `applicable: false` stage, malformed `eventId`/`occurredAt`, `failureCode` failing its pattern | Problem, `type: validation-failed`                              |
| 429  | Rate limit exceeded                                                                                                                  | Problem, `type: rate-limited`                                   |

---

### Events this spec **emits** (outbox → webhook relay)

Payloads are allow-list mappers. **Never** reason text, legal names or contact details.

#### Envelope

Every event this spec emits uses the same envelope, so a consumer writes one parser and one
dedupe rule rather than four:

```json
{
  "eventId": "uuid",
  "eventType": "employee.transfer.fulfilment-stage.v1",
  "eventVersion": 1,
  "occurredAt": "RFC3339",
  "correlationId": "uuid",
  "requestId": "uuid",
  "payload": {}
}
```

| Envelope field | Type | Required | Notes |
| --- | --- | --- | --- |
| `eventId` | UUID | Yes | Unique per emitted event. **The consumer's dedupe key** (BR5) — delivery is at-least-once |
| `eventType` | String | Yes | Fully qualified name including the `.v1` suffix, exactly as listed below |
| `eventVersion` | Integer | Yes | Matches the suffix in `eventType`; present so a consumer can branch without string parsing |
| `occurredAt` | RFC3339 | Yes | Portal commit time of the state change that produced the event |
| `correlationId` | UUID | Yes | Propagated from the triggering request (constitution — audit carries correlation ID) |
| `requestId` | UUID | Yes | Lifted out of the payload so routing never needs to parse it |
| `payload` | Object | Yes | Per-event allow-list below. Employee ID is permitted (constitution — pseudonymous, not PII) |

**Evolution:** additive only within `v1` (constitution — Versioning Rules). A consumer must
ignore payload fields it does not recognise; removing or retyping a field requires a `.v2`
event type and a documented consumer migration, never an in-place change.

#### Event catalogue

| Event type                                | When                                                                                  | Payload allow-list                                                                                                                                                          |
| ----------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `employee.transfer.fulfilment-stage.v1`   | An applicable fulfilment **work stage** becomes `IN_PROGRESS` and is signalled to its consumer | `referenceNo`, `employeeId`, `stageCode`, `confirmedEffectiveDate`, current and target department/location/position/grade/cost-centre **IDs**                               |
| `employee.transfer.fulfilment-failed.v1`  | A fulfilment work stage is reported `FAILED` — one event per failure, not one per cancelled or compensating stage | `referenceNo`, `employeeId`, `failedStageCode`, `failureCode` (when supplied), `cancelledStageCodes`, `compensatingStageCodes`                                              |
| `employee.transfer.compensate.v1`         | BR6 — once per already-`COMPLETED` fulfilment work stage, reverse sequence order       | `referenceNo`, `employeeId`, `stageCode` (the stage to reverse), `failedStageCode`                                                                                          |
| `employee.transfer.completed.v1`          | Request reaches `COMPLETED`                                                            | `referenceNo`, `employeeId`, `confirmedEffectiveDate`                                                                                                                       |

`requestId` and `correlationId` are envelope fields and are therefore on every event above.
`employee.transfer.fulfilment-failed.v1` is **new in v1.2**: v1.1 described compensation but
never named the failure event that `internal-transfer-notifications` already says it
consumes, which left that spec pointing at an event with no contract.

This spec **consumes** `employee.transfer.approved.v1` from the approval-chain spec
(internal handler, not a public API): that is the only start signal for fulfilment.

## Acceptance Criteria

1. `internal-transfer-downstream-orchestration.AC1` — Given a request that has just
   entered `FULFILMENT` via `employee.transfer.approved.v1`, when the handler runs, then
   `ORG_DATA_UPDATE` is `IN_PROGRESS` and one `employee.transfer.fulfilment-stage.v1`
   outbox row for that stage is written in the same transaction as the stage update — and
   `PAYROLL_UPDATE`, `IT_ACCESS` and `FACILITIES` remain `NOT_STARTED` even if applicable.

2. `internal-transfer-downstream-orchestration.AC2` — Given `ORG_DATA_UPDATE` is reported
   `SUCCESS`, when API01 is processed, then that stage becomes `COMPLETED`, the next
   applicable stage in sequence among `PAYROLL_UPDATE`, `IT_ACCESS`, `FACILITIES` becomes
   `IN_PROGRESS` and is signalled, and non-applicable stages stay `applicable: false` and
   are never signalled.

3. `internal-transfer-downstream-orchestration.AC3` — Given a request whose applicable
   fulfilment stages are only `ORG_DATA_UPDATE` (payroll/IT/facilities not applicable),
   when org update is reported `SUCCESS`, then those three remain unsignalled,
   `EMPLOYEE_CONFIRMATION` becomes `COMPLETED`, request status becomes `COMPLETED`, an
   audit row is written, and `employee.transfer.completed.v1` is written in the same
   transaction.

4. `internal-transfer-downstream-orchestration.AC4` — Given an applicable stage is
   `IN_PROGRESS`, when API01 reports `FAILED` with `reportType: FULFILMENT`, then that
   stage becomes `FAILED`, request status remains `FULFILMENT`, exactly one
   `employee.transfer.fulfilment-failed.v1` is written,
   `employee.transfer.compensate.v1` is written once per already-`COMPLETED` fulfilment
   stage in reverse sequence order with each of those stages moving to
   `COMPENSATION_REQUESTED`, `EMPLOYEE_CONFIRMATION` is not completed, and `completed.v1`
   is not written — and given the failing stage is `ORG_DATA_UPDATE`, then no compensate
   event is written at all, because no fulfilment stage was `COMPLETED`.

5. `internal-transfer-downstream-orchestration.AC5` — Given the same `eventId` is POSTed
   twice to API01 with a byte-identical body, when the second call arrives, then HTTP 200
   is returned, stage status is unchanged from the first success, and no second audit or
   compensate/failed/completed outbox row is written; and given the same `eventId` with a
   different body, then HTTP 409 `idempotency-key-conflict` is returned, no stage changes
   and no outbox row is written.

6. `internal-transfer-downstream-orchestration.AC6` — Given a portal HTTP request from an
   employee or approver, when fulfilment is in progress, then that request path performs
   no HTTP call to Payroll, ITSM, Facilities or an HRIS write API.

7. `internal-transfer-downstream-orchestration.AC7` — Given any fulfilment-stage,
   fulfilment-failed, compensate or completed payload, then it contains no reason field, no
   legal name and no contact details; logs of API01 and the approved.v1 handler contain no
   constitution PII.

8. `internal-transfer-downstream-orchestration.AC8` — Given API01 is called with a valid
   body but an invalid HMAC, then HTTP 401 is returned, no stage changes, and the body is
   not logged.

9. `internal-transfer-downstream-orchestration.AC9` — Given a completion report for a
   request in `MANAGER_REVIEW`, `HR_VALIDATION`, `WITHDRAWN` or `REJECTED`, then HTTP 409
   `invalid-state-transition` is returned and no stage changes.

10. `internal-transfer-downstream-orchestration.AC10` — Given any stage or request
    transition this spec performs — start, complete, fail, cancel under BR8, request
    compensation, record a reversal as `COMPENSATED` or `COMPENSATION_FAILED`, or complete
    the request — when it commits, then an append-only audit row is written carrying the
    from/to status, the correlation ID and an actor of role `SYSTEM` or the configured
    webhook source id, never a person's name, and that row cannot be updated or deleted.

11. `internal-transfer-downstream-orchestration.AC11` — Given API01 is called with an
    employee or approver OIDC bearer token and no valid HMAC, then HTTP 401
    `unauthenticated` is returned and no stage changes — an employee session must not
    complete a fulfilment stage.

12. `internal-transfer-downstream-orchestration.AC12` — Given a request with applicable
    fulfilment work stages still `NOT_STARTED`, when an `IN_PROGRESS` stage is reported
    `FAILED`, then every one of those `NOT_STARTED` applicable work stages becomes
    `CANCELLED` in the same transaction and none of them is ever signalled, while
    `EMPLOYEE_CONFIRMATION` remains `NOT_STARTED` and the request remains `FULFILMENT`
    (BR8).

13. `internal-transfer-downstream-orchestration.AC13` — Given a stage is
    `COMPENSATION_REQUESTED`, when API01 reports `reportType: COMPENSATION` with
    `outcome: SUCCESS`, then that stage becomes `COMPENSATED`, an audit row is written,
    request status is still `FULFILMENT`, and no fulfilment stage is re-signalled (BR9).

14. `internal-transfer-downstream-orchestration.AC14` — Given a stage is
    `COMPENSATION_REQUESTED`, when API01 reports `reportType: COMPENSATION` with
    `outcome: FAILED`, then that stage becomes `COMPENSATION_FAILED`, an audit row is
    written, the portal emits no further compensate event for that stage and performs no
    retry, and the request remains `FULFILMENT` awaiting the operational owner in OWN-08.

15. `internal-transfer-downstream-orchestration.AC15` — Given an API01 report whose
    `failureCode` does not match `^[A-Z0-9_]{1,64}$` — including any free-text sentence,
    name or reason — then HTTP 422 `validation-failed` is returned, no stage changes, and
    the rejected value is not written to a log or an audit row.

16. `internal-transfer-downstream-orchestration.AC16` — Given an otherwise valid API01
    call, then a signature whose `X-Portal-Webhook-Timestamp` is more than 300 seconds
    from portal time is 401, a signature carrying an unknown or retired
    `X-Portal-Webhook-Key-Id` is 401, and a signature carrying either key id valid during
    a rotation window is accepted — and in every 401 case no stage changes, no signature
    or secret is logged, and the response discloses nothing about which sources exist.

17. `internal-transfer-downstream-orchestration.AC17` — Given a request resting in
    `FULFILMENT` with a `FAILED` stage, then no portal API restarts fulfilment: a
    `reportType: FULFILMENT` report against that stage is 409
    `invalid-state-transition`, a report against a `CANCELLED` stage is 409, the request
    never transitions on its own, and no scheduled job retries the failed stage (BR10).

18. `internal-transfer-downstream-orchestration.AC18` — Given any event this spec emits,
    then it carries the full envelope — `eventId`, `eventType` including its `.v1`
    suffix, `eventVersion`, `occurredAt`, `correlationId`, `requestId` and `payload` —
    with `eventVersion` matching the suffix in `eventType`, and its payload restricted to
    that event's allow-list.

19. `internal-transfer-downstream-orchestration.AC19` — Given `ORG_DATA_UPDATE` is still
    `IN_PROGRESS`, when a report arrives for a later fulfilment stage that has not been
    signalled, then HTTP 409 `invalid-state-transition` with `currentStageStatus` is
    returned, no stage changes and no event is emitted — an out-of-order report is
    refused, never queued or applied early.

20. `internal-transfer-downstream-orchestration.AC20` — Given two API01 reports that both
    read the same aggregate `version`, when they commit, then exactly one increments
    `version` by 1 and the other is refused with 409 `version-conflict`; a byte-identical
    `eventId` replay still returns 200 without incrementing `version` (OWN-11).

## Unit Test Cases (spec-derived)

| Test ID                                           | Maps to AC | Scenario                                           | Expected                                                                                     |
| ------------------------------------------------- | ---------- | -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `internal-transfer-downstream-orchestration.UT01` | AC1        | Handle `approved.v1`                               | `ORG_DATA_UPDATE` `IN_PROGRESS`; one fulfilment-stage outbox row; later stages `NOT_STARTED` |
| `internal-transfer-downstream-orchestration.UT02` | AC1        | Outbox write fails on AC1                          | Stage not left `IN_PROGRESS` without an outbox row                                           |
| `internal-transfer-downstream-orchestration.UT03` | AC2        | Org SUCCESS; payroll applicable                    | Payroll `IN_PROGRESS` and signalled; IT/Facilities still `NOT_STARTED` if later in sequence  |
| `internal-transfer-downstream-orchestration.UT04` | AC2        | Org SUCCESS; payroll not applicable, IT applicable | IT signalled next; payroll never signalled                                                   |
| `internal-transfer-downstream-orchestration.UT05` | AC3        | Only org applicable, org SUCCESS                   | Status `COMPLETED`; `EMPLOYEE_CONFIRMATION` `COMPLETED`; `completed.v1` present              |
| `internal-transfer-downstream-orchestration.UT06` | AC4        | Org SUCCESS then payroll FAILED                    | Payroll `FAILED`; compensate for org; status `FULFILMENT`; no `completed.v1`                 |
| `internal-transfer-downstream-orchestration.UT07` | AC4        | Two completed stages then third FAILED             | Two compensate events, reverse sequence                                                      |
| `internal-transfer-downstream-orchestration.UT08` | AC5        | Duplicate `eventId`                                | Second 200; one audit row for the completion                                                 |
| `internal-transfer-downstream-orchestration.UT09` | AC6        | Trace of submit/approve HTTP handlers              | Zero outbound HTTP to Payroll/ITSM/Facilities/HRIS-write                                     |
| `internal-transfer-downstream-orchestration.UT10` | AC7        | Fulfilment-stage payload                           | Allow-list fields only; no reason key                                                        |
| `internal-transfer-downstream-orchestration.UT11` | AC8        | Bad HMAC                                           | 401; stages unchanged                                                                        |
| `internal-transfer-downstream-orchestration.UT12` | AC9        | Completion while `HR_VALIDATION`                   | 409                                                                                          |
| `internal-transfer-downstream-orchestration.UT13` | AC10       | Org SUCCESS                                        | Audit row from/to stage statuses; update of that row rejected by the database                |
| `internal-transfer-downstream-orchestration.UT14` | AC2        | Report SUCCESS on `applicable: false` stage        | 422; no signal                                                                               |
| `internal-transfer-downstream-orchestration.UT15` | AC11       | API01 with employee Bearer token, no HMAC          | 401; stages unchanged                                                                        |
| `internal-transfer-downstream-orchestration.UT16` | AC12       | Payroll FAILED while IT and Facilities are applicable and `NOT_STARTED` | Both become `CANCELLED` and are never signalled; `EMPLOYEE_CONFIRMATION` `NOT_STARTED`; request `FULFILMENT` |
| `internal-transfer-downstream-orchestration.UT17` | AC4        | `ORG_DATA_UPDATE` is the failing stage             | One `fulfilment-failed.v1`; **zero** compensate events                                       |
| `internal-transfer-downstream-orchestration.UT18` | AC13       | Compensation `SUCCESS` on a `COMPENSATION_REQUESTED` stage | `COMPENSATED`; audit row; no stage re-signalled                                       |
| `internal-transfer-downstream-orchestration.UT19` | AC14       | Compensation `FAILED`                              | `COMPENSATION_FAILED`; no retry event; request still `FULFILMENT`                            |
| `internal-transfer-downstream-orchestration.UT20` | AC13       | `reportType: COMPENSATION` on a `COMPLETED` stage never asked to compensate | 409 `invalid-state-transition`; no change                                    |
| `internal-transfer-downstream-orchestration.UT21` | AC5        | Same `eventId`, different body                     | 409 `idempotency-key-conflict`; no stage change, no audit row, no outbox row                 |
| `internal-transfer-downstream-orchestration.UT22` | AC15       | `failureCode` carrying a free-text sentence        | 422; the value appears in no log line and no audit row                                       |
| `internal-transfer-downstream-orchestration.UT23` | AC16       | Signature timestamp ten minutes old                | 401; stages unchanged; nothing logged from the body                                          |
| `internal-transfer-downstream-orchestration.UT24` | AC16       | Retired key id, then each of two key ids valid mid-rotation | 401 for the retired id; 200 for either valid id                                     |
| `internal-transfer-downstream-orchestration.UT25` | AC17       | `FULFILMENT` report against a `FAILED` stage, then against a `CANCELLED` stage | 409 both times; request still `FULFILMENT`; no scheduled retry exists     |
| `internal-transfer-downstream-orchestration.UT26` | AC18       | Every emitted event read back off the outbox       | Envelope complete; `eventVersion` matches the `eventType` suffix; no field outside the allow-list |
| `internal-transfer-downstream-orchestration.UT27` | AC19       | Payroll report while org update is still `IN_PROGRESS` | 409 with `currentStageStatus`; no stage change; no event                                  |
| `internal-transfer-downstream-orchestration.UT28` | AC1–AC3    | **Integration**, contract double: `approved.v1` → org → payroll → completion | One stage `IN_PROGRESS` at a time, in sequence order; `completed.v1` emitted last |
| `internal-transfer-downstream-orchestration.UT29` | AC4, AC12, AC13 | **Integration**, contract double: failure then compensation acknowledgement | Ends in the "failed, reversal acknowledged" resting shape, request `FULFILMENT` |
| `internal-transfer-downstream-orchestration.UT30` | AC5, AC19  | **Integration**, contract double redelivers reports out of order and duplicated | Final portal state identical to the in-order, non-duplicated run            |
| `internal-transfer-downstream-orchestration.UT31` | AC20       | Two reports computed from the same aggregate `version` | One 200 and `version` + 1; the other 409 `version-conflict`; no merge       |

Integration rows use a contract double for the downstream consumer, never a hand-rolled
stub (constitution — Testing Discipline). This module handles downstream orchestration, so
its coverage floor is 85%.

## Traceability — BRD → rule → AC → test

Read in both directions: every rule reaches at least one AC and one test, and every AC and
test traces back to a BRD-001 item, an ADR, the constitution, or a named Gate 1 finding.
There are no orphans in either direction.

| Source of record | Spec rule | Acceptance criteria | Tests |
| --- | --- | --- | --- |
| BRD-001 OQ-08 | BR1 | AC2, AC3 | UT03, UT04, UT05, UT14 |
| BRD-001 journey stages 4–7 | BR2 | AC1, AC2, AC19 | UT01, UT03, UT04, UT27, UT28 |
| BRD-001 OQ-09; ADR-0002 | BR3 | AC6 | UT09 |
| BRD-001 OQ-10; ADR-0001; constitution (outbox) | BR4 | AC1, AC6 | UT02, UT09 |
| ADR-0001 (at-least-once delivery) | BR5, BR11 | AC5, AC18 | UT08, UT21, UT26, UT30 |
| BRD-001 spec map — compensation on failure | BR6 | AC4 | UT06, UT07, UT17 |
| BRD-001 journey stage 8 | BR7 | AC3 | UT05 |
| Gate 1 G1-F04 (2026-09-09) | BR8 | AC12 | UT16 |
| Gate 1 G1-F03 (2026-09-09) | BR9 | AC13, AC14 | UT18, UT19, UT20, UT29 |
| BRD-001 OQ-20 Resolved 2026-09-11, OQ-06; Gate 1 G1-F02, G1-F05 | BR10; OWN-08 | AC17 | UT25 |
| BRD-001 BR14, KD-07; OWN-06; architecture AuthN/AuthZ | _Authentication and Authorisation_, _Webhook signature contract_ | AC8, AC11, AC16 | UT11, UT15, UT23, UT24 |
| BRD-001 OQ-12; constitution Security Posture | Payload allow-lists; `failureCode` pattern | AC7, AC15 | UT10, UT22 |
| Constitution Non-Functional Baselines — audit | AC10 as written | AC10 | UT13 |
| BRD-001 KD-05, OQ-05 — fulfilment starts only after HR approval | BR6 precondition; API01 state guard | AC9 | UT12 |

## Surfaces

No new employee-facing screen. Stage statuses appear on the request spec's status view —
including the three compensation statuses v1.2 adds, whose display labels that spec owns.
This spec's only HTTP surface is API01 (machine-to-machine).

## Explicitly Out of Scope

- Approval decisions — `internal-transfer-approval-chain`.
- Employee submit/withdraw/status — `internal-transfer-request`.
- Notifications, including "your transfer is complete" copy — `internal-transfer-notifications`.
- Implementing Payroll, ITSM or Facilities consumers (their backlogs; architecture debt).
- ITSM ticket-adapter internals beyond emitting/receiving the contract (architecture: adapter needed).
- Writing the HRIS as system of record (ADR-0002).
- Retry or "mark complete" UI for HR after `FAILED`.
- Automatic or portal-driven **resume** of fulfilment after `FAILED` or
  `COMPENSATION_FAILED` (BR10; BRD-001 OQ-20). Deferred, not undecided — adding it is a
  later increment that re-enters at Gate 1.
- **Parallel** fan-out of `PAYROLL_UPDATE`, `IT_ACCESS` and `FACILITIES` (BR2). Sequential
  is the v1 decision; parallelising later is additive and changes neither the stage
  contract nor API01.
- Portal-side retry orchestration of a compensate signal beyond the outbox relay's own
  delivery attempts (BR9).
- Verifying, beyond the acknowledgement API01 records, that a reversal truly happened
  inside Payroll, IT or Facilities. The portal records what it was told (OWN-08).
- HR cancellation / compensation after `COMPLETED`.
- SLA on fulfilment stages (OQ-15).
- Starting fulfilment from `employee.transfer.requested.v1` (would skip managers and HR).

## Open Questions

| #   | Question                                                                                                                              | Owner                             | Needed by                               | Resolution                                                                                                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | After compensate events are emitted, who records that reversal actually happened in Payroll/IT/Facilities, and can fulfilment resume? | Product (v1 lock) | Closed | **Resolved 2026-09-11 — BRD-001 OQ-20.** Consumer acknowledges reversal through API01; request rests in `FULFILMENT`; HR Operations closes out off-portal (OWN-08). No portal resume, retry or "mark complete" in v1. BR10, AC17. |

No part of this spec requires a plan to guess. Portal resume is deferred, not undecided.

## Assumptions

- A1 — Each of HRIS-org, Payroll, ITSM and Facilities will expose (or have an adapter
  that exposes) the webhook this spec emits, and will call API01. If false: stages remain
  `IN_PROGRESS` (already recorded as architecture debt).
- A2 — `approved.v1` is the start signal. If approval-chain ships a different event name,
  this spec's consume list is updated together with that spec.
- A3 — HMAC secrets live in Secrets Manager, not in the spec or in `.env`. If false:
  constitution is violated.
- A4 — Sequential order (BR2) is acceptable to Payroll, IT and Facilities. Recorded as a
  v1 **decision**, not an open question: none of the three consumers exists yet, so none is
  constrained by it today, and parallelising later is additive — neither the stage contract
  nor API01 changes. If false: BR2 and AC2 change in a later increment and nothing else
  does.
- A5 — **HR Operations** is the operational owner of a failed fulfilment (OWN-08, BR10).
  Confirmed Product 2026-09-11 (OQ-20). If a later increment names a different function,
  only BR10, AC17 and OWN-08 change; the mechanism is unaffected.
- A6 — `internal-transfer-request`'s status view can render the three compensation stage
  statuses v1.2 introduces. If false: that spec needs a display-label change in the same
  increment as this one — a cross-spec item, not a redesign here.

## Non-Functional Constraints (from constitution.md)

- API01 is a state-changing machine endpoint: p95 < 700 ms at the gateway.
- An unavailable downstream consumer must not fail employee or approver HTTP (outbox
  retries). Unavailability degrades fulfilment visibility, not other portal journeys.
- No PII in logs or event payloads (AC7).
- Explicit rate limit on API01.
- Events only via transactional outbox (AC1–AC4).
- Portal does not write the HRIS (BR3).
- Audit immutable, 7 years (AC10).
- Additive-only event schema evolution, envelope included (_Envelope_ → Evolution).
- API01's replay window assumes portal and consumer clocks within ±300 s. Outside that, a
  valid report is refused rather than applied late (AC16).
- **No portal-side retry loop anywhere in this spec.** The only retries are the outbox
  relay's delivery attempts. A failed stage or a failed reversal waits for a person
  (BR10, OWN-08), never for a scheduler.

## Revision History

| Version | Date       | Change        | Driver  |
| ------- | ---------- | ------------- | ------- |
| v1.0    | 2026-09-03 | Initial draft | BRD-001 |
| v1.1    | 2026-09-08 | Authentication and authorisation section; AC11 — employee OIDC must not authorise webhooks (BRD-001 BR14) | BRD-001 KD-07, BR14 |
| v1.2    | 2026-09-11 | Gate 1 response. New _Fulfilment Lifecycle and State Transitions_ section (stage status vocabulary, four paths, stage and request transition matrices, resting shapes); BR8–BR11; _Webhook signature contract_; API01 `reportType`, `failureCode`, replay/rotation and `idempotency-key-conflict` exceptions; event envelope and the named `employee.transfer.fulfilment-failed.v1`; AC12–AC19; UT16–UT30 including three integration rows; traceability matrix; A5, A6; BRD-001 OQ-20 raised for the business half of resume-after-failure | Gate 1 G1-F01–G1-F12 (Abhijit Adhikari, 2026-09-09) |
| v1.3    | 2026-09-11 | Product v1 lock: OQ-20 confirmed — off-portal closeout; portal resume deferred. Behaviour unchanged from v1.2 | Product, 2026-09-11 |
| v1.4    | 2026-09-15 | OWN-11 participation: API01 reads aggregate `version` in-transaction and compare-and-swaps; 409 `version-conflict` on a lost race; byte-identical `eventId` replay still does not increment version | `internal-transfer-request` G1-F18 |

## Gate 1 Review

> Reviewed by: Abhijit Adhikari, 2026-09-11, **Approved** (against v1.3) — "Approved." All
> five Blocker and seven Should-fix findings from the 2026-09-09 review are addressed in
> v1.2 (see Author response below), and BRD-001 OQ-20 (resume-after-failure business
> question) is Resolved by Product's 2026-09-11 lock: off-portal closeout by HR Operations,
> no portal-driven or automatic resume in v1. Findings worksheet:
> `.ai-context/reviews/internal-transfer-downstream-orchestration.gate1.md`.
> **Superseded-by:** v1.4 (2026-09-15) — additive OWN-11 compare-and-swap on API01; new
> Gate 1 pass required before v1.4 is treated as Approved.

> Reviewed by: Abhijit Adhikari, 2026-09-09, **Changes Requested** (against v1.0) — five
> Blocker and seven Should-fix findings. Recorded verdict: the spec "is not yet buildable
> without engineers guessing at materially different failure-handling behaviour." Findings
> worksheet: `.ai-context/reviews/internal-transfer-downstream-orchestration.gate1.md`.

### Author response — v1.2, 2026-09-11 (Alamgir Sarkar)

| Finding | Severity | Addressed in v1.2 by |
| --- | --- | --- |
| G1-F01 — complete failure / compensation / recovery lifecycle | Blocker | _Fulfilment Lifecycle and State Transitions_ — status vocabulary, the four paths, both transition matrices, resting shapes; BR8, BR9, BR10 |
| G1-F02 — can fulfilment resume after `FAILED`? | Blocker | BR10 and AC17 — no automatic and no portal-driven resume in v1. **OQ-20 Resolved 2026-09-11 (Product):** off-portal closeout confirmed; portal resume deferred |
| G1-F03 — compensation acknowledgement / failure semantics | Blocker | BR9; API01 `reportType: COMPENSATION`; stage statuses `COMPENSATION_REQUESTED` / `COMPENSATED` / `COMPENSATION_FAILED`; AC13, AC14; UT18–UT20 |
| G1-F04 — fate of later `NOT_STARTED` stages after a failure | Blocker | BR8 and AC12 — they become `CANCELLED` and are never signalled; `EMPLOYEE_CONFIRMATION` stays `NOT_STARTED`; UT16 |
| G1-F05 — operational owner of a failed fulfilment | Blocker | **HR Operations**, recorded as shared fact OWN-08 and cited by BR10, AC14, A5 |
| G1-F06 — sequential vs parallel Payroll/IT/Facilities | Should-fix | BR2 states sequential as a v1 decision with at most one stage `IN_PROGRESS`; A4 restated as a decision; parallel fan-out listed Out of Scope |
| G1-F07 — formal outbound event envelope / schema | Should-fix | _Envelope_ with typed field table and the additive-only evolution rule; AC18; UT26 |
| G1-F08 — same `eventId`, different payload | Should-fix | BR11; API01 409 `idempotency-key-conflict`, matching the request spec's convention; AC5; UT21 |
| G1-F09 — HMAC header / canonicalisation / replay / rotation | Should-fix | _Webhook signature contract_ — three headers, the five-line canonical string, ±300 s replay window, overlapping key ids; AC16; UT23, UT24 |
| G1-F10 — state-transition matrix | Should-fix | Stage and request-level matrices, with every unlisted pair explicitly a 409; request-level names still owned by `internal-transfer-request` |
| G1-F11 — BRD → BR → AC → Test traceability | Should-fix | _Traceability_ section, readable in both directions, no orphans |
| G1-F12 — negative / out-of-order integration tests | Should-fix | UT16–UT30, including AC19's out-of-order refusal and three contract-double integration rows |

**OQ-20 is now closed.** Product confirmed on 2026-09-11 that off-portal closeout by HR
Operations is the v1 path (OWN-08). Portal resume remains deferred, not undecided. BR10 and
AC17 do not change.
