# Spec: Internal Transfer Downstream Orchestration

## Spec ID

`internal-transfer-downstream-orchestration`

## Status

**Draft v1.0** — not submitted to Gate 1. Full state machine in `.ai-context/status.md`.
Do not generate a plan or code from this file until it is **Approved**.

Gate 1 cannot pass the dependency check until
`internal-transfer-approval-chain` is **Approved** (and that spec in turn waits on
`internal-transfer-request`). This spec starts work only after status is `FULFILMENT`.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role | Name | Date |
|---|---|---|
| Author / owner | Alamgir Sarkar | 2026-09-03 |
| Gate 1 reviewer (never the author) | | |
| Gate 2 reviewer | | |

## Intent

After HR has approved an internal transfer request, the portal records fulfilment of the
conditional back-office stages that were fixed at submission — organisational data update
always; payroll assignment update only when cost centre or grade differs; IT access change
only when department differs; facilities arrangement only when location differs — without
calling those systems on an employee or approver request path. Each applicable stage is
signalled through the transactional outbox as an HTTPS webhook payload. Each downstream
system reports completion or failure back to the portal. When every applicable fulfilment
stage has completed, the request becomes `COMPLETED`. When a stage reports failure, already
completed fulfilment stages are signalled to compensate, the request stays `FULFILMENT`,
and the portal does not invent a retry UI. This spec does not write employment data into
the HRIS, does not approve transfers, and does not send employee notifications.

## Context

- Builds on: `.ai-context/architecture.md` — *Integration Points*, *Known Constraints and
  Debt*; [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md);
  [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)
- Constitution: `.ai-context/constitution.md` — no synchronous Payroll/ITSM/Facilities call
  on a portal request path; portal never writes HRIS as system of record; outbox is
  mandatory
- Related: `.ai-context/specs/internal-transfer-request.spec.md` — stage codes and
  applicability flags created at submit (OQ-08 recorded there)
- Related: `.ai-context/specs/internal-transfer-approval-chain.spec.md` — **Draft v1.0**.
  Emits `employee.transfer.approved.v1` and sets `FULFILMENT`. This spec consumes that
  transition, not `employee.transfer.requested.v1` (managers and HR must finish first —
  BRD-001 OQ-02).
- Related: `internal-transfer-notifications` — consumes `employee.transfer.completed.v1`
  and stage-failure events; notification loss must not change request status
- API contract consumed: downstream webhook URLs configured per function; inbound
  completion webhook defined below. HRIS write is performed by the HRIS integration
  layer, not by this service

Architecture already records that Payroll, ITSM and Facilities consumers are **not built**.
v1 of this spec still defines the contract so those teams can implement against it. Until
a consumer exists, outbox rows retry and remain unpublished; the employee-facing request
stays `FULFILMENT` with those stages `IN_PROGRESS` (architecture: known debt). That is
visible, not silent.

## Business Rules

| Rule ID | Rule | Source | Business or technical decision |
|---|---|---|---|
| `internal-transfer-downstream-orchestration.BR1` | `ORG_DATA_UPDATE` always applies. `PAYROLL_UPDATE` applies only if target cost centre or grade differs from the snapshot. `IT_ACCESS` applies only if target department differs. `FACILITIES` applies only if target location differs. Flags are **not** recomputed here. | BRD-001 OQ-08 | Business (already applied at submit) |
| `internal-transfer-downstream-orchestration.BR2` | Fulfilment stage order: `ORG_DATA_UPDATE` must complete before `PAYROLL_UPDATE`, `IT_ACCESS` or `FACILITIES` are signalled. Those three, when applicable, are signalled in sequence-number order after org update, skipping `applicable: false` rows. | BRD-001 journey stages 4–7 | Business (as-is order; not parallelised in v1) |
| `internal-transfer-downstream-orchestration.BR3` | The portal does not write employment or org data to the HRIS. It emits an event; the HRIS (or its adapter) is system of record for that update. | BRD-001 OQ-09; ADR-0002 | Technical |
| `internal-transfer-downstream-orchestration.BR4` | No Payroll, ITSM or Facilities HTTP call is made inside an employee or approver request. Delivery is outbox relay → HTTPS webhook. | BRD-001 OQ-10; ADR-0001; constitution | Technical |
| `internal-transfer-downstream-orchestration.BR5` | Downstream systems report success or failure back. Consumers must treat delivery as at-least-once and dedupe on `requestId` + `stageCode` + `eventType`. | ADR-0001 | Technical |
| `internal-transfer-downstream-orchestration.BR6` | On a reported stage failure, the portal records that stage as `FAILED` and emits a compensate signal for every fulfilment stage already `COMPLETED` on that request, in reverse sequence. It does not mark the request `COMPLETED`. | BRD-001 spec map (compensation on failure) | Business intent; mechanism technical |
| `internal-transfer-downstream-orchestration.BR7` | `EMPLOYEE_CONFIRMATION` is completed by the portal when every applicable stage among `ORG_DATA_UPDATE`, `PAYROLL_UPDATE`, `IT_ACCESS` and `FACILITIES` is `COMPLETED`. It is not an employee click. Telling the employee is notifications spec. | BRD-001 journey stage 8 | Business |

## API Contract

Employee OIDC APIs are **not** added. Operators see fulfilment through the existing
employee status view (`internal-transfer-request.API04`) once stage rows change.

---

### `internal-transfer-downstream-orchestration.API01` — POST `/api/v1/internal-transfers/webhooks/stage-completion`

**Purpose:** a downstream adapter reports that one fulfilment stage succeeded or failed.
**Auth:** webhook signing secret (HMAC). Not an employee token. A missing or invalid
signature is 401. The body must not be trusted for identity of an employee.
**Rate limit:** 600 per hour per configured source (HRIS adapter, Payroll, ITSM,
Facilities).
**Idempotency:** `eventId` in the body is the idempotency key. A replay of the same
`eventId` returns 200 with the current resource and writes no second audit row.

**Request payload:**

```json
{
  "eventId": "uuid",
  "requestId": "uuid",
  "stageCode": "ORG_DATA_UPDATE | PAYROLL_UPDATE | IT_ACCESS | FACILITIES",
  "outcome": "SUCCESS | FAILED",
  "occurredAt": "RFC3339"
}
```

No employee name, reason text or narrative.

**Success response (200):**

```json
{
  "requestId": "uuid",
  "stageCode": "ORG_DATA_UPDATE",
  "stageStatus": "COMPLETED",
  "requestStatus": "FULFILMENT"
}
```

When the report completes the last applicable fulfilment stage, `requestStatus` is
`COMPLETED`.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | Missing or invalid signature | Problem, `type: unauthenticated` |
| 404 | `requestId` does not exist | Problem, `type: request-not-found` |
| 409 | Request status is not `FULFILMENT` | Problem, `type: invalid-state-transition`, `currentStatus` |
| 409 | `stageCode` is not `IN_PROGRESS` (already `COMPLETED`/`FAILED`/`CANCELLED`/`NOT_STARTED`, or not yet signalled) | Problem, `type: invalid-state-transition`, `currentStageStatus` |
| 422 | Unknown `stageCode`, `outcome` not `SUCCESS`/`FAILED`, `applicable: false` stage, malformed `eventId`/`occurredAt` | Problem, `type: validation-failed` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

---

### Events this spec **emits** (outbox → webhook relay)

Payloads are allow-list mappers. **Never** reason text, legal names or contact details.

| Event type | When | Payload allow-list |
|---|---|---|
| `employee.transfer.fulfilment-stage.v1` | An applicable fulfilment stage becomes `IN_PROGRESS` and is signalled to its consumer | `requestId`, `referenceNo`, `employeeId`, `stageCode`, `confirmedEffectiveDate`, current and target department/location/position/grade/cost-centre **IDs**, `correlationId` |
| `employee.transfer.compensate.v1` | BR6 after a `FAILED` completion report | `requestId`, `referenceNo`, `employeeId`, `stageCode` (the stage to reverse), `failedStageCode`, `correlationId` |
| `employee.transfer.completed.v1` | Request reaches `COMPLETED` | `requestId`, `referenceNo`, `employeeId`, `confirmedEffectiveDate`, `correlationId` |

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
   `IN_PROGRESS`, when API01 reports `FAILED`, then that stage becomes `FAILED`, request
   status remains `FULFILMENT`, `employee.transfer.compensate.v1` is written once per
   already-`COMPLETED` fulfilment stage in reverse sequence, `EMPLOYEE_CONFIRMATION` is
   not completed, and `completed.v1` is not written.

5. `internal-transfer-downstream-orchestration.AC5` — Given the same `eventId` is POSTed
   twice to API01, when the second call arrives, then HTTP 200 is returned, stage status
   is unchanged from the first success, and no second audit or compensate/completed
   outbox row is written.

6. `internal-transfer-downstream-orchestration.AC6` — Given a portal HTTP request from an
   employee or approver, when fulfilment is in progress, then that request path performs
   no HTTP call to Payroll, ITSM, Facilities or an HRIS write API.

7. `internal-transfer-downstream-orchestration.AC7` — Given any fulfilment-stage,
   compensate or completed payload, then it contains no reason field, no legal name and no
   contact details; logs of API01 and the approved.v1 handler contain no constitution PII.

8. `internal-transfer-downstream-orchestration.AC8` — Given API01 is called with a valid
   body but an invalid HMAC, then HTTP 401 is returned, no stage changes, and the body is
   not logged.

9. `internal-transfer-downstream-orchestration.AC9` — Given a completion report for a
   request in `MANAGER_REVIEW`, `HR_VALIDATION`, `WITHDRAWN` or `REJECTED`, then HTTP 409
   `invalid-state-transition` is returned and no stage changes.

10. `internal-transfer-downstream-orchestration.AC10` — Given a successful stage
    transition (start, complete, fail, request complete), when it commits, then an
    append-only audit row is written (actor role `SYSTEM` or the configured webhook
    source id, not a person's name) and cannot be updated or deleted.

## Unit Test Cases (spec-derived)

| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| `internal-transfer-downstream-orchestration.UT01` | AC1 | Handle `approved.v1` | `ORG_DATA_UPDATE` `IN_PROGRESS`; one fulfilment-stage outbox row; later stages `NOT_STARTED` |
| `internal-transfer-downstream-orchestration.UT02` | AC1 | Outbox write fails on AC1 | Stage not left `IN_PROGRESS` without an outbox row |
| `internal-transfer-downstream-orchestration.UT03` | AC2 | Org SUCCESS; payroll applicable | Payroll `IN_PROGRESS` and signalled; IT/Facilities still `NOT_STARTED` if later in sequence |
| `internal-transfer-downstream-orchestration.UT04` | AC2 | Org SUCCESS; payroll not applicable, IT applicable | IT signalled next; payroll never signalled |
| `internal-transfer-downstream-orchestration.UT05` | AC3 | Only org applicable, org SUCCESS | Status `COMPLETED`; `EMPLOYEE_CONFIRMATION` `COMPLETED`; `completed.v1` present |
| `internal-transfer-downstream-orchestration.UT06` | AC4 | Org SUCCESS then payroll FAILED | Payroll `FAILED`; compensate for org; status `FULFILMENT`; no `completed.v1` |
| `internal-transfer-downstream-orchestration.UT07` | AC4 | Two completed stages then third FAILED | Two compensate events, reverse sequence |
| `internal-transfer-downstream-orchestration.UT08` | AC5 | Duplicate `eventId` | Second 200; one audit row for the completion |
| `internal-transfer-downstream-orchestration.UT09` | AC6 | Trace of submit/approve HTTP handlers | Zero outbound HTTP to Payroll/ITSM/Facilities/HRIS-write |
| `internal-transfer-downstream-orchestration.UT10` | AC7 | Fulfilment-stage payload | Allow-list fields only; no reason key |
| `internal-transfer-downstream-orchestration.UT11` | AC8 | Bad HMAC | 401; stages unchanged |
| `internal-transfer-downstream-orchestration.UT12` | AC9 | Completion while `HR_VALIDATION` | 409 |
| `internal-transfer-downstream-orchestration.UT13` | AC10 | Org SUCCESS | Audit row from/to stage statuses; update of that row rejected by the database |
| `internal-transfer-downstream-orchestration.UT14` | AC2 | Report SUCCESS on `applicable: false` stage | 422; no signal |

## Surfaces

No new employee-facing screen. Stage statuses appear on the request spec's status view.
This spec's only HTTP surface is API01 (machine-to-machine).

## Explicitly Out of Scope

- Approval decisions — `internal-transfer-approval-chain`.
- Employee submit/withdraw/status — `internal-transfer-request`.
- Notifications, including "your transfer is complete" copy — `internal-transfer-notifications`.
- Implementing Payroll, ITSM or Facilities consumers (their backlogs; architecture debt).
- ITSM ticket-adapter internals beyond emitting/receiving the contract (architecture: adapter needed).
- Writing the HRIS as system of record (ADR-0002).
- Retry or "mark complete" UI for HR after `FAILED`.
- HR cancellation / compensation after `COMPLETED`.
- SLA on fulfilment stages (OQ-15).
- Starting fulfilment from `employee.transfer.requested.v1` (would skip managers and HR).

## Open Questions

| # | Question | Owner | Needed by | Resolution |
|---|---|---|---|---|
| 1 | After compensate events are emitted, who records that reversal actually happened in Payroll/IT/Facilities, and can fulfilment resume? | HR Ops + downstream system owners | Before Approved, if v1 must auto-resume | **Open.** This spec emits compensate signals and leaves the request in `FULFILMENT` with a `FAILED` stage. It does not define a resume API. |

A plan would have to guess at resume-after-failure. **Do not submit this spec to Gate 1
until OQ-1 is resolved or explicitly deferred** (for example: "HR completes remaining work
offline; portal stays `FULFILMENT` until a later spec").

## Assumptions

- A1 — Each of HRIS-org, Payroll, ITSM and Facilities will expose (or have an adapter
  that exposes) the webhook this spec emits, and will call API01. If false: stages remain
  `IN_PROGRESS` (already recorded as architecture debt).
- A2 — `approved.v1` is the start signal. If approval-chain ships a different event name,
  this spec's consume list is updated together with that spec.
- A3 — HMAC secrets live in Secrets Manager, not in the spec or in `.env`. If false:
  constitution is violated.
- A4 — Sequence order in BR2 is acceptable to Payroll/IT/Facilities. If they require
  parallel start after org update, BR2 changes before Approved.

## Non-Functional Constraints (from constitution.md)

- API01 is a state-changing machine endpoint: p95 < 700 ms at the gateway.
- An unavailable downstream consumer must not fail employee or approver HTTP (outbox
  retries). Unavailability degrades fulfilment visibility, not other portal journeys.
- No PII in logs or event payloads (AC7).
- Explicit rate limit on API01.
- Events only via transactional outbox (AC1–AC4).
- Portal does not write the HRIS (BR3).
- Audit immutable, 7 years (AC10).
- Additive-only event schema evolution.

## Revision History

| Version | Date | Change | Driver |
|---|---|---|---|
| v1.0 | 2026-09-03 | Initial draft | BRD-001 |
