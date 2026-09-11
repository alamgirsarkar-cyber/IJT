# Spec: Employee Internal Transfer Request

## Spec ID

`internal-transfer-request`

## Status

**In Peer Review (Gate 1)** — Draft v1.4. Gate 1 **Changes Requested** (2026-09-11, against
v1.4) — 5 Blocker, 5 Nit findings; see _Gate 1 Review_ at the end of this file. Full state
machine in `.ai-context/status.md`. Implementation must not start until this spec is
**Approved**.

**Reviewer note.** New findings from the 2026-09-11 re-review: the stage-status invariant
must be "at most one" `IN_PROGRESS`, not "exactly one" (the zero-pending state after a
fulfilment failure/compensation is real and legitimate); `COMPLETED`'s "confirmed by the
employee" wording contradicts `EMPLOYEE_CONFIRMATION` being portal-set; a null
`lineManagerRef` leaves approval-chain permanently stuck on `assignee-unresolved` with no
recovery mechanism; BR13/OWN-11's compare-and-swap is not defined for approval-chain's or
downstream's own mutating APIs; and failed-fulfilment employee-visible behaviour needs its
own definition given `pendingWith: null` and OQ-21 silence. Five further items are minor
cleanup, not blocking.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role                               | Name             | Date                           |
| ---------------------------------- | ---------------- | ------------------------------ |
| Author / owner                     | Alamgir Sarkar   | 2026-08-27                     |
| Gate 1 reviewer (never the author) | Abhijit Adhikari | 2026-09-11 — **Changes Requested** on v1.4 (was Changes Requested on v1.1, 2026-09-09) |
| Gate 2 reviewer                    | Tapas Dutta      | —                              |

Gate 1 sign-off is a dated `## Gate 1 Review` block on this spec (`.agent/rules/governance.md`). Findings worksheet: `.ai-context/reviews/internal-transfer-request.gate1.md`.

## Intent

An authenticated employee of the One-Point Employee Portal can prepare, validate and submit
a request to transfer to a different department, location or position, and can then see —
without contacting anyone — the current state of that request and which stakeholder each
outstanding action is waiting on. The employee selects a target department/business unit,
location and position from governed reference data, provides a requested effective date and
an optional private reason, and submits. On submission the portal freezes a snapshot of the
employee's current assignment, evaluates the eligibility rules it is able to evaluate,
creates the ordered plan of stages that this transfer will pass through, records the
submission immutably, and emits one event for downstream functions to act on. This spec
owns the request itself and the employee's view of it; it does not make, and does not
simulate, any approval decision.

## Context

- Builds on: `.ai-context/architecture.md` — _Components_, _Integration Points_,
  _Authentication and Authorisation_, _Cross-Cutting Concerns_
- Constitution: `.ai-context/constitution.md` — Security Posture, Architectural
  Constraints, Non-Functional Baselines all apply and are not restated here
- Related specs (co-submitted to Gate 1 2026-09-07 — none Approved yet):
  - `internal-transfer-approval-chain` — **In Peer Review** — consumes the stage plan this spec creates and performs every transition from `MANAGER_REVIEW` to `FULFILMENT` or `REJECTED`
  - `internal-transfer-downstream-orchestration` — **In Peer Review (Draft v1.2)** — starts after HR approval, not from submit; owns stage transitions for sequences 4–7
  - `internal-transfer-notifications` — **In Peer Review (Draft v1.2)** — consumes the events this spec emits
- API contract consumed: HRIS read API — `docs/contracts/hris-read-api.md`
- Design: portal design system; internal transfer wizard screens, Figma `OPP/ITR/v1`
- Shared facts: `.ai-context/ownership_index.md` (OWN-01, OWN-02, OWN-05, OWN-07, OWN-09,
  OWN-10, OWN-11, OWN-12). This spec is the **owner** of OWN-10 (the state and transition
  contract), OWN-11 (aggregate versioning and concurrency) and OWN-12 ("pending with"
  naming), and complies with OWN-09 (event naming)

**Note on the state machine (for Gate 1 reviewers):** this spec **owns** the aggregate, so
it defines every request status, every stage status and every legal transition in
_Authoritative State and Transition Contract_ below — that table, not a diagram, is what
sibling specs are checked against (G1-F02). It _drives_ only `DRAFT → DRAFT` (update),
`DRAFT → MANAGER_REVIEW` (submit) and `MANAGER_REVIEW | HR_VALIDATION → WITHDRAWN`.
Everything from the first manager decision onward is transitioned by
`internal-transfer-approval-chain` and `internal-transfer-downstream-orchestration`, and
the contract names which spec performs each one. Acceptance criteria referencing states
this spec does not drive (AC14) specify _the rule_ and are verified against states set
directly in test fixtures. This is a definition dependency, not a build dependency, so the
Gate 1 dependency check passes.

## Business Rules Applied

| Rule ID                         | Rule                                                                                                   | Source      | Type     | Enforced by this spec?                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------ | ----------- | -------- | --------------------------------------------------------------------------------- |
| `internal-transfer-request.BR1` | Employment status must be Active and confirmed; employees on probation may not request a transfer      | BRD-001 BR1 | Business | Yes — AC7                                                                         |
| `internal-transfer-request.BR2` | Minimum 12 months continuous service in the current position, measured at the requested effective date | BRD-001 BR2 | Business | Yes — AC7                                                                         |
| `internal-transfer-request.BR3` | Only one transfer request in a non-terminal state per employee                                         | BRD-001 BR3 | Business | Yes — AC8                                                                         |
| `internal-transfer-request.BR4` | No active resignation or exit process                                                                  | BRD-001 BR4 | Business | Yes — AC7                                                                         |
| `internal-transfer-request.BR5` | Target must differ from current in at least one of department, location, position                      | BRD-001 BR5 | Business | Yes — AC5                                                                         |
| `internal-transfer-request.BR6` | Target position must be open and internally fillable                                                   | BRD-001 BR6 | Business | Yes — AC6                                                                         |
| `internal-transfer-request.BR7` | Requested effective date ≥ today + 14 days and ≤ today + 180 days                                      | BRD-001 BR7 | Business | Yes — AC4                                                                         |
| `internal-transfer-request.BR8` | Non-payroll-aligned effective dates are permitted but flagged as likely to move                        | BRD-001 BR8 | Business | Yes — AC4 (advisory, non-blocking)                                                |
| `internal-transfer-request.BR9` | Open disciplinary or performance cases block a transfer                                                | BRD-001 BR9 | Business | **No — validated manually by HR.** The portal must not imply it has checked (AC7) |
| `internal-transfer-request.BR10` | Only an authenticated employee may call employee-facing transfer APIs or open the wizard/status routes | BRD-001 BR10, KD-07 | Technical | Yes — AC20, AC21 |
| `internal-transfer-request.BR11` | The caller may create, update, submit, withdraw and view only requests whose `employee_id` equals the token subject | BRD-001 BR11 | Business | Yes — AC12, AC13 |
| `internal-transfer-request.BR12` | **Service length for BR2** is whole completed calendar months from the current position's start date in HRIS to the requested effective date inclusive, using authoritative HRIS data read at submission time. Partial months do not count; exactly 12 passes. Unpaid leave of absence does **not** break continuity in v1 — service runs from the position start date regardless of leave (BRD-001 OQ-22, Product 2026-09-11) | BRD-001 BR2, OQ-22; Gate 1 G1-F10 | Business | Yes — AC7, AC22 |
| `internal-transfer-request.BR13` | **The request aggregate has one monotonic `version`.** Every mutation from any spec — this one, approval-chain, downstream — increments it, and concurrency is optimistic on that single value. A mutation computed from a stale version is refused; it is never merged. Recorded as shared fact OWN-11 | Gate 1 G1-F08; architecture (portal owns the request aggregate, ADR-0002) | Technical | Yes — AC2, AC23 |
| `internal-transfer-request.BR14` | **Reference data served by API07 is for browsing and selection only and is never the source of truth for a validation decision.** Every rule evaluated at submission reads authoritative, uncached data; if that data cannot be read, the submission is refused rather than decided on cached values | Gate 1 G1-F12; constitution (degradation) | Technical | Yes — AC6, AC7, AC15, AC24 |

## Authoritative State and Transition Contract

This is the single source of truth G1-F02 asked for, registered as shared fact **OWN-10**.
Every sibling spec is checked against these tables; where a sibling's API description and
this contract disagree, this contract wins and the sibling is corrected. The v1.1 ASCII
diagram is gone deliberately — it could not express who performs a transition, and that
omission is what let `PENDING`/`IN_PROGRESS` (G1-F01) and the submission-routing question
(G1-F03) go unnoticed.

### Request status vocabulary

| Status | Terminal? | Meaning | Display label | Set by |
| --- | --- | --- | --- | --- |
| `DRAFT` | No | Being prepared; visible only to the owning employee | "Draft" | This spec, API01 |
| `MANAGER_REVIEW` | No | With the line manager or the receiving manager | "With your manager" | This spec, API03 (on submit) and approval-chain (stays here between stages 1 and 2) |
| `HR_VALIDATION` | No | With the HR Business Partner | "With HR" | `internal-transfer-approval-chain` |
| `FULFILMENT` | No | Approved; downstream systems are being updated | "Being actioned" | `internal-transfer-approval-chain` |
| `COMPLETED` | **Yes** | Transfer done and confirmed by the employee | "Completed" | `internal-transfer-downstream-orchestration` |
| `REJECTED` | **Yes** | Declined by a manager or by HR | "Declined" | `internal-transfer-approval-chain` |
| `WITHDRAWN` | **Yes** | Withdrawn by the owning employee | "Withdrawn" | This spec, API06 |
| `DISCARDED` | **Yes** | Draft abandoned before submission | "Discarded" | **Nobody — see _States with no owner_** |
| `CANCELLED` | **Yes** | Cancelled after the withdrawal window closed | "Cancelled" | **Nobody — see _States with no owner_** |

Non-terminal for the purposes of BR3: `DRAFT`, `MANAGER_REVIEW`, `HR_VALIDATION`,
`FULFILMENT`.

**`SUBMITTED` is not in this list, and that is the answer to G1-F03.** See _Submission is
synchronous_ below.

### Stage status vocabulary

One vocabulary for all eight stages, so `internal-transfer-approval-chain` (stages 1–3) and
`internal-transfer-downstream-orchestration` (stages 4–7) describe the same row the same
way. **`PENDING` is not a stage status and never was** — v1.1's API03 response used it for
what every other part of the programme calls `NOT_STARTED`, which is the whole of G1-F01.

| Stage status | Display label | Meaning | Set by |
| --- | --- | --- | --- |
| `NOT_STARTED` | "Not started" | Row exists from the stage plan; not yet reached | This spec at submit |
| `IN_PROGRESS` | "Waiting" | **The stage is current and awaiting action.** Exactly one stage per request is `IN_PROGRESS` at a time | This spec (stage 1 at submit); approval-chain (2–3); downstream (4–7) |
| `COMPLETED` | "Done" | Decided or fulfilled. For an approval stage the decision outcome is a separate field — a declined approval is a `COMPLETED` stage on a `REJECTED` request, not a `REJECTED` stage | approval-chain; downstream |
| `CANCELLED` | "Not needed" | Will never run, because the request ended or an earlier stage failed | This spec (AC14); approval-chain; downstream |
| `FAILED` | "Could not complete" | A downstream consumer reported failure | downstream |
| `COMPENSATION_REQUESTED` | "Being reversed" | A previously `COMPLETED` fulfilment stage has been asked to reverse and has not yet acknowledged | downstream |
| `COMPENSATED` | "Reversed" | The consumer acknowledged the reversal | downstream |
| `COMPENSATION_FAILED` | "Reversal could not complete" | The consumer reported that the reversal itself failed | downstream |

A stage with `applicable: false` stays `NOT_STARTED` for the life of the request and
renders as _Not required_ rather than "Not started" (see _Stage Plan_).

The last four statuses are additive from `internal-transfer-downstream-orchestration` v1.2.
This spec owns the employee-facing labels (that spec's A6); it does not transition into
them. API04 returns `statusDisplay` on every stage so the timeline is readable as text,
not colour (AC19, AC11).

### Submission is synchronous — G1-F03

v1.1 left it unstated whether `MANAGER_REVIEW` was reached inside the submit call or later
via the emitted event, and neither this spec nor `internal-transfer-approval-chain`
claimed the transition — so it had **no owner at all**. The decision:

**API03 commits, in one transaction, a request at `MANAGER_REVIEW` with `MANAGER_RELEASE`
already `IN_PROGRESS`.** There is no later routing step and no window in which a submitted
request has nothing pending.

Two consequences follow, and both are why this answer was chosen over the asynchronous one:

- **`SUBMITTED` is demoted from a status to a history event type.** If routing is
  synchronous, no API can ever return `SUBMITTED`, so keeping it as a status would define a
  state the system cannot be in — exactly the kind of ambiguity G1-F02 exists to remove.
  The employee still sees "Submitted on <date>": `submittedAt` is unchanged and the
  `SUBMITTED` entry in `history` (API04) and in the audit trail (AC18) is unchanged.
- **`internal-transfer-approval-chain` needs no new event handler.** Its AC1 already begins
  "Given a request in `MANAGER_REVIEW` whose `MANAGER_RELEASE` stage is `IN_PROGRESS`" —
  under the asynchronous alternative that precondition would have had to be established by
  a consumer that spec does not define, so the asynchronous answer would have added a
  finding to a second spec rather than closing one here.

The asynchronous alternative, for the reviewer's comparison: submit commits `SUBMITTED`
with every stage `NOT_STARTED`; approval-chain consumes `employee.transfer.requested.v1`
and performs `SUBMITTED → MANAGER_REVIEW`. It is defensible, but it makes the routing delay
user-visible, needs a new AC and handler in approval-chain, and leaves API04 returning a
request with `pendingWith: null` for an unbounded period.

### Request transitions

| From | Trigger | To | Performed by | Committed with |
| --- | --- | --- | --- | --- |
| — | API01 create | `DRAFT` | This spec | Current-assignment snapshot (informational, AC1), audit row |
| `DRAFT` | API02 update | `DRAFT` | This spec | `version` + 1, audit row |
| `DRAFT` | API03 submit | `MANAGER_REVIEW` | This spec | Frozen snapshot, 8-row stage plan, `MANAGER_RELEASE` → `IN_PROGRESS`, audit row (`SUBMITTED`), one `employee.transfer.requested.v1` outbox row — all atomic (AC9) |
| `MANAGER_REVIEW` | `MANAGER_RELEASE` approved | `MANAGER_REVIEW` | approval-chain | Stage 1 `COMPLETED`, stage 2 `IN_PROGRESS` |
| `MANAGER_REVIEW` | `MANAGER_ACCEPT` approved | `HR_VALIDATION` | approval-chain | Stage 2 `COMPLETED`, stage 3 `IN_PROGRESS` |
| `MANAGER_REVIEW` | Either manager declines | `REJECTED` | approval-chain | Stage `COMPLETED` with a declined outcome; later stages `CANCELLED` |
| `HR_VALIDATION` | HR approves | `FULFILMENT` | approval-chain | Confirmed effective date set; `ORG_DATA_UPDATE` `IN_PROGRESS` |
| `HR_VALIDATION` | HR declines | `REJECTED` | approval-chain | As above |
| `MANAGER_REVIEW`, `HR_VALIDATION` | API06 withdraw | `WITHDRAWN` | This spec | Incomplete stages `CANCELLED`, audit row, one `employee.transfer.withdrawn.v1` (AC14) |
| `FULFILMENT` | A fulfilment work stage reports `SUCCESS` and more remain | `FULFILMENT` (unchanged) | downstream | Next applicable work stage `IN_PROGRESS` |
| `FULFILMENT` | A fulfilment work stage reports `FAILED` | `FULFILMENT` (unchanged, by design) | downstream | Failed stage `FAILED`; earlier completed work stages `COMPENSATION_REQUESTED`; later `NOT_STARTED` work stages `CANCELLED`; request does **not** become `CANCELLED` or `COMPLETED` (OWN-08) |
| `FULFILMENT` | Compensation acknowledged `SUCCESS` / `FAILED` | `FULFILMENT` (unchanged) | downstream | Stage `COMPENSATED` or `COMPENSATION_FAILED` |
| `FULFILMENT` | Last applicable stage and `EMPLOYEE_CONFIRMATION` complete | `COMPLETED` | downstream | One `employee.transfer.completed.v1` |
| `FULFILMENT` | API06 withdraw | **Refused** | This spec | 409 `withdrawal-window-closed` (BRD-001 OQ-06) |
| Any terminal status | Any trigger | **Refused** | — | 409 `invalid-state-transition`, except an already-`WITHDRAWN` withdraw, which is 200 and idempotent (AC14) |

**Every `(from, trigger)` pair not listed above is refused with 409
`invalid-state-transition` carrying `currentStatus`.** The table is exhaustive by
construction, not by convention.

### States with no owner — found while writing this contract

Neither of these is a defect introduced by v1.3; both were latent in v1.1 and became
visible only once every transition had to name a performer. Recorded rather than resolved,
because inventing either mechanism would be a new requirement, and a spec is not where a
requirement is first written down.

| State | Gap | Disposition |
| --- | --- | --- |
| `DISCARDED` | AC18 audits a "discarded" transition and the v1.1 diagram showed `DRAFT → DISCARDED`, but **no endpoint in API01–API07 performs it**. An employee cannot currently abandon a draft other than by leaving it | **Deferred out of v1 (Product 2026-09-11).** The employee updates the existing draft. Status stays defined |
| `CANCELLED` | Defined as terminal, referenced by API06's 409 list, but **no spec transitions a request into it**. BRD-001 OQ-06 makes post-window cancellation an HR action outside the portal | **Confirmed unreachable in v1 (Product 2026-09-11).** Kept in the vocabulary so API06's refusal list stays total |

## Stage Plan

Fixed at submission and never recalculated afterwards, so the employee's view cannot change
underneath them when reference data changes.

| Stage code              | Sequence | Assigned role        | Applicability rule                                       |
| ----------------------- | -------- | -------------------- | -------------------------------------------------------- |
| `MANAGER_RELEASE`       | 1        | Current line manager | Always                                                   |
| `MANAGER_ACCEPT`        | 2        | Receiving manager    | Always                                                   |
| `HR_VALIDATION`         | 3        | HR Business Partner  | Always                                                   |
| `ORG_DATA_UPDATE`       | 4        | HR Operations        | Always                                                   |
| `PAYROLL_UPDATE`        | 5        | Payroll              | Only if target cost centre or grade differs from current |
| `IT_ACCESS`             | 6        | IT service desk      | Only if target department differs from current           |
| `FACILITIES`            | 7        | Facilities           | Only if target location differs from current             |
| `EMPLOYEE_CONFIRMATION` | 8        | Employee             | Always                                                   |

Non-applicable stages are persisted with `applicable: false` and rendered as _Not required_
— they are shown, not hidden, so the employee can see the journey was considered rather
than wonder whether a step was skipped by mistake.

All eight rows are created by the submit transaction. `MANAGER_RELEASE` is committed
`IN_PROGRESS`; the other seven are committed `NOT_STARTED` (AC9). Applicability is resolved
once, at submission, from the frozen snapshot, and is never recalculated — which is what
stops the employee's view changing underneath them when reference data moves.

## Authentication and Authorisation

Cites BRD-001 KD-07, KD-08, BR10, BR11 and `.ai-context/architecture.md` —
_Authentication and Authorisation_. This spec does not add an IdP, login page, or
session timeout.

| Concern | Rule on this spec |
| --- | --- |
| Authentication | Corporate OIDC via the existing portal session. Gateway validates the access token. Token **subject** = acting `employee_id`. |
| Authorisation | In `employee-services`: the principal may act only on requests they own (BR11). A caller-supplied `employeeId` in body, query or path is ignored (AC13). |
| Unauthenticated | HTTP 401 `unauthenticated`; no draft, submit, or withdraw is persisted (AC20). |
| Unauthorised resource | HTTP 404 `request-not-found`, never 403 (AC13). |
| Front end | Wizard and status routes require the portal OIDC session, attach the bearer token, and do not collect credentials (AC21). |
| Not used here | Role `HR_BUSINESS_PARTNER` and stage-assignee checks — `internal-transfer-approval-chain`. HMAC webhooks — `internal-transfer-downstream-orchestration`. |

## API Contract

All endpoints are under `/api/v1/internal-transfers`, behind the gateway's OIDC validation.
The acting employee is derived from the token subject; **no endpoint accepts an employee
identifier from the caller** (AC13). Missing or invalid tokens are 401 (AC20).

All error responses use RFC 7807 `application/problem+json`, per `constitution.md`:

```json
{
  "type": "https://errors.onepoint.example/internal-transfer/<error-slug>",
  "title": "<short human-readable summary>",
  "status": 422,
  "detail": "<what happened, safe to display, never containing PII>",
  "instance": "/api/v1/internal-transfers/{requestId}/submit",
  "correlationId": "01J9Z8Y7X6W5V4U3T2S1R0",
  "violations": [
    { "ruleId": "internal-transfer-request.BR2", "field": null, "message": "<display text>" }
  ]
}
```

`violations[].ruleId` carries the rule ID so the front end renders the rule's message and
never re-implements the rule itself.

---

### `internal-transfer-request.API01` — POST `/api/v1/internal-transfers`

**Purpose:** create a draft transfer request.
**Auth:** authenticated employee; acts only on self.
**Rate limit:** 20 per hour per employee (a draft is cheap but not free; a user needs one).
**Idempotency:** not required — BR3 makes a second concurrent draft a 409 anyway.

**Request payload:** empty body, or a partial draft:

```json
{
  "targetDepartmentId": "string | null",
  "targetLocationId": "string | null",
  "targetPositionId": "string | null",
  "requestedEffectiveDate": "YYYY-MM-DD | null",
  "reason": "string | null"
}
```

**Success response (201):**

```json
{
  "requestId": "uuid",
  "referenceNo": "ITR-2026-000123",
  "status": "DRAFT",
  "version": 1,
  "currentAssignment": {
    "departmentId": "string",
    "departmentName": "string",
    "locationId": "string",
    "locationName": "string",
    "positionId": "string",
    "positionTitle": "string",
    "serviceInPositionMonths": 18
  },
  "target": { "departmentId": null, "locationId": null, "positionId": null },
  "requestedEffectiveDate": null,
  "reason": null,
  "advisories": [],
  "createdAt": "2026-09-01T09:14:02Z"
}
```

`currentAssignment` here is **informational only** (G1-F11). It is a convenience read so
the wizard can show the employee what they are transferring from, and it carries no
authority: it is not the snapshot, it is not frozen, and it may be stale by the time the
employee submits. The authoritative snapshot is the one API03 freezes inside the submit
transaction, and every eligibility rule is evaluated against data read at that moment
(AC9, AC24). A front end must not cache this value and present it as the submitted record.

**Exceptions:**

| Code | Condition                                                                                               | Response body                                                                                                               |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| 401  | No or invalid token                                                                                     | Problem, `type: unauthenticated`                                                                                            |
| 409  | Employee already has a non-terminal request (BR3)                                                       | Problem, `type: active-request-exists`, `violations[0].ruleId = ...BR3`, plus `existingRequestId` and `existingReferenceNo` |
| 422  | Payload present but malformed field types or `reason` over 2000 characters                              | Problem, `type: validation-failed`, `violations[].field` populated                                                          |
| 429  | Rate limit exceeded                                                                                     | Problem, `type: rate-limited`, `Retry-After` header                                                                         |
| 503  | HRIS unavailable and no cached employee assignment — the current-assignment snapshot cannot be resolved | Problem, `type: reference-data-unavailable`, `Retry-After` header                                                           |

---

### `internal-transfer-request.API02` — PUT `/api/v1/internal-transfers/{requestId}`

**Purpose:** update a draft. The only mutating operation on request content.
**Auth:** owner only.
**Rate limit:** 120 per hour per employee (supports autosave from the wizard).
**Concurrency:** `If-Match: "<version>"` required. Mismatch is a 409 — last-write-wins is not
acceptable on a form the employee may have open in two tabs.

**Request payload:**

```json
{
  "targetDepartmentId": "string | null",
  "targetLocationId": "string | null",
  "targetPositionId": "string | null",
  "requestedEffectiveDate": "YYYY-MM-DD | null",
  "reason": "string | null"
}
```

**Success response (200):** same shape as API01, with `version` incremented and `advisories`
populated with any non-blocking findings (BR8 payroll alignment; BR2 service-length warning
where the date is close to the threshold). As in API01, `currentAssignment` and any
draft-time advisory are informational: an advisory computed now can change by submission,
and none of them is a validation decision (BR14, G1-F11).

**Exceptions:**

| Code | Condition                                                                                    | Response body                                                      |
| ---- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 400  | `If-Match` header absent                                                                     | Problem, `type: precondition-required`                             |
| 401  | No or invalid token                                                                          | Problem, `type: unauthenticated`                                   |
| 404  | Request does not exist, **or exists and is not owned by the caller** (deliberate — see AC13) | Problem, `type: request-not-found`                                 |
| 409  | `If-Match` version does not match current version                                            | Problem, `type: version-conflict`, with `currentVersion`           |
| 409  | Request is not in `DRAFT`                                                                    | Problem, `type: invalid-state-transition`, with `currentStatus`    |
| 422  | Malformed fields, unknown reference IDs, or `reason` over 2000 characters                    | Problem, `type: validation-failed`, `violations[].field` populated |
| 429  | Rate limit exceeded                                                                          | Problem, `type: rate-limited`                                      |

---

### `internal-transfer-request.API03` — POST `/api/v1/internal-transfers/{requestId}/submit`

**Purpose:** validate and submit the draft. This is the transactional heart of the feature.
**Auth:** owner only.
**Rate limit:** 5 per hour per employee.
**Idempotency:** `Idempotency-Key` header **required**. A replay within 24 hours returns the
original 200 response and creates nothing.

**Request payload:** empty body. All content comes from the persisted draft, so a submit can
never introduce values that were never validated.

**Resulting status (G1-F01, G1-F03):** a successful submit returns `MANAGER_REVIEW`, not
`SUBMITTED`, with `MANAGER_RELEASE` at `IN_PROGRESS` — the transition is synchronous and
atomic, per _Submission is synchronous_. v1.1 returned `"status": "SUBMITTED"` with that
stage at `PENDING`, a status name used nowhere else in the programme; both are corrected
here. `submittedAt` and the `SUBMITTED` history entry are unaffected.

**Success response (200):**

```json
{
  "requestId": "uuid",
  "referenceNo": "ITR-2026-000123",
  "status": "MANAGER_REVIEW",
  "statusDisplay": "With your manager",
  "version": 4,
  "submittedAt": "2026-09-01T09:31:44Z",
  "requestedEffectiveDate": "2026-10-01",
  "effectiveDateStatus": "REQUESTED",
  "stages": [
    {
      "stageCode": "MANAGER_RELEASE",
      "sequence": 1,
      "status": "IN_PROGRESS",
      "statusDisplay": "Waiting",
      "assignedRole": "LINE_MANAGER",
      "assignedPartyName": "<line manager display name>",
      "applicable": true
    },
    {
      "stageCode": "MANAGER_ACCEPT",
      "sequence": 2,
      "status": "NOT_STARTED",
      "statusDisplay": "Not started",
      "assignedRole": "RECEIVING_MANAGER",
      "assignedPartyName": null,
      "applicable": true
    },
    {
      "stageCode": "PAYROLL_UPDATE",
      "sequence": 5,
      "status": "NOT_STARTED",
      "statusDisplay": "Not required",
      "assignedRole": "PAYROLL",
      "assignedPartyName": null,
      "applicable": false
    }
  ],
  "advisories": [
    {
      "code": "PAYROLL_CYCLE_MISALIGNED",
      "ruleId": "internal-transfer-request.BR8",
      "message": "Your requested date is mid-cycle and HR may move it to the 1st of the month."
    },
    {
      "code": "MANUAL_HR_CHECKS_PENDING",
      "ruleId": "internal-transfer-request.BR9",
      "message": "HR will carry out further eligibility checks that the portal does not perform."
    }
  ]
}
```

**Exceptions:**

| Code | Condition                                                                        | Response body                                                                                         |
| ---- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| 400  | `Idempotency-Key` header absent                                                  | Problem, `type: idempotency-key-required`                                                             |
| 401  | No or invalid token                                                              | Problem, `type: unauthenticated`                                                                      |
| 404  | Not found, or not owned by the caller                                            | Problem, `type: request-not-found`                                                                    |
| 409  | Request is not in `DRAFT`                                                        | Problem, `type: invalid-state-transition`, with `currentStatus`                                       |
| 409  | Employee acquired another non-terminal request since the draft was created (BR3) | Problem, `type: active-request-exists`                                                                |
| 409  | `Idempotency-Key` reused with a different request body or a different request ID | Problem, `type: idempotency-key-conflict`                                                             |
| 422  | Mandatory fields missing (AC3)                                                   | Problem, `type: validation-failed`, one `violations` entry per missing field                          |
| 422  | Effective date outside the permitted window (BR7)                                | Problem, `type: validation-failed`, `ruleId = ...BR7`                                                 |
| 422  | Target identical to current assignment (BR5)                                     | Problem, `type: validation-failed`, `ruleId = ...BR5`                                                 |
| 422  | Target position no longer open or internally fillable (BR6)                      | Problem, `type: validation-failed`, `ruleId = ...BR6`                                                 |
| 422  | Eligibility rules failed (BR1, BR2, BR4)                                         | Problem, `type: eligibility-failed`, one `violations` entry per failed rule                           |
| 429  | Rate limit exceeded                                                              | Problem, `type: rate-limited`                                                                         |
| 503  | HRIS unavailable, so eligibility cannot be evaluated                             | Problem, `type: reference-data-unavailable`, `Retry-After`. **The request stays `DRAFT`, unchanged.** |

---

### `internal-transfer-request.API04` — GET `/api/v1/internal-transfers/{requestId}`

**Purpose:** the employee's single view of one request.
**Auth:** owner only.
**Rate limit:** 300 per hour per employee.

**Success response (200):**

```json
{
  "requestId": "uuid",
  "referenceNo": "ITR-2026-000123",
  "status": "MANAGER_REVIEW",
  "statusDisplay": "With your manager",
  "version": 4,
  "currentAssignment": {
    "departmentName": "string",
    "locationName": "string",
    "positionTitle": "string"
  },
  "target": { "departmentName": "string", "locationName": "string", "positionTitle": "string" },
  "requestedEffectiveDate": "2026-10-01",
  "confirmedEffectiveDate": null,
  "effectiveDateStatus": "REQUESTED",
  "reason": "string | null",
  "submittedAt": "2026-09-01T09:31:44Z",
  "pendingWith": {
    "stageCode": "MANAGER_RELEASE",
    "role": "LINE_MANAGER",
    "partyName": "<line manager display name>"
  },
  "stages": [
    {
      "stageCode": "MANAGER_RELEASE",
      "sequence": 1,
      "status": "IN_PROGRESS",
      "statusDisplay": "Waiting",
      "applicable": true,
      "assignedRole": "LINE_MANAGER",
      "assignedPartyName": "<line manager display name>",
      "startedAt": "2026-09-01T09:31:45Z",
      "completedAt": null
    }
  ],
  "history": [
    { "event": "SUBMITTED", "occurredAt": "2026-09-01T09:31:44Z", "actorRole": "EMPLOYEE" }
  ],
  "availableActions": ["WITHDRAW"]
}
```

`assignedPartyName` is populated **only** where the assigned party is the employee's own
line manager. For every other stage it is `null` and the front end shows the role.
`reason` is returned to the owning employee; it is never returned to any other principal by
any endpoint in this spec.

After submit, `currentAssignment` is the **frozen snapshot** taken inside API03 (AC9), not
the informational draft-time read from API01. Every stage carries `statusDisplay` from the
vocabulary table above, including `FAILED` / `COMPENSATION_REQUESTED` / `COMPENSATED` /
`COMPENSATION_FAILED` when downstream has written those statuses — this spec renders them;
it does not produce them.

> **BRD-001 OQ-11 is Resolved 2026-09-11 (Product, v1) — OWN-12.** Named person only where
> the assigned party is the employee's own line manager; every other stage shows the role.
> If Data Privacy later requires "role only" everywhere, `assignedPartyName` becomes `null`
> unconditionally, `pendingWith.partyName` is dropped, and AC11, UT31 and UT32 change with
> it. Nothing else in this spec moves.

The `history` array records event types, not statuses. `SUBMITTED` appears here and in the
audit trail even though it is no longer a request status — see _Submission is synchronous_.

**Exceptions:**

| Code | Condition                             | Response body                      |
| ---- | ------------------------------------- | ---------------------------------- |
| 401  | No or invalid token                   | Problem, `type: unauthenticated`   |
| 404  | Not found, or not owned by the caller | Problem, `type: request-not-found` |
| 429  | Rate limit exceeded                   | Problem, `type: rate-limited`      |

---

### `internal-transfer-request.API05` — GET `/api/v1/internal-transfers`

**Purpose:** the employee's own request history.
**Auth:** authenticated employee; returns only their own requests, always.
**Rate limit:** 300 per hour per employee.
**Query:** `?status=<comma-separated>&page=<n>&size=<10|25|50>` — default page 1, size 10,
sorted by `createdAt` descending.

**Success response (200):**

```json
{
  "items": [
    {
      "requestId": "uuid",
      "referenceNo": "ITR-2026-000123",
      "status": "MANAGER_REVIEW",
      "statusDisplay": "With your manager",
      "targetPositionTitle": "string",
      "requestedEffectiveDate": "2026-10-01",
      "createdAt": "2026-09-01T09:14:02Z",
      "pendingWithRole": "LINE_MANAGER"
    }
  ],
  "page": 1,
  "size": 10,
  "totalItems": 3,
  "totalPages": 1
}
```

`reason` is **not** included in list responses at all.

**Exceptions:**

| Code | Condition                                                   | Response body                      |
| ---- | ----------------------------------------------------------- | ---------------------------------- |
| 400  | `size` outside the permitted set, or unknown `status` value | Problem, `type: validation-failed` |
| 401  | No or invalid token                                         | Problem, `type: unauthenticated`   |
| 429  | Rate limit exceeded                                         | Problem, `type: rate-limited`      |

---

### `internal-transfer-request.API06` — POST `/api/v1/internal-transfers/{requestId}/withdraw`

**Purpose:** the employee withdraws their own request before fulfilment begins.
**Auth:** owner only.
**Rate limit:** 10 per hour per employee.
**Concurrency:** `If-Match: "<version>"` **required** (G1-F08). v1.1 defined no concurrency
control here at all, which left the withdraw-versus-approval race undefined on the very
endpoint most likely to lose it.
**Idempotency:** repeating a withdraw on an already-`WITHDRAWN` request returns 200 with the
unchanged resource **regardless of the `If-Match` value** — withdrawing twice is not an
error from the employee's point of view, and a replay necessarily carries a stale version.
Terminal-state idempotency is checked before the version precondition.

#### Withdraw racing an approval — G1-F08

Both operations mutate one aggregate under one `version` (BR13, OWN-11), so they serialise:
whichever transaction commits first wins, and the loser is refused rather than merged.
Which refusal the employee gets depends on what actually happened, because "your version
is stale" and "you are too late" are different facts and the second one needs a different
next step.

| Race | Outcome | Response to the withdraw |
| --- | --- | --- |
| Withdraw commits first | Request is `WITHDRAWN`; the approval attempt is refused by approval-chain with 409 `invalid-state-transition` | 200 — the withdrawal stands |
| An approval commits first but the request is **still withdrawable** (`MANAGER_REVIEW` or `HR_VALIDATION`) | The employee's `If-Match` is now stale | 409 `version-conflict` with `currentVersion` — the client re-reads and may withdraw again |
| **HR approval commits first and the request has moved to `FULFILMENT`** | The withdrawal window has closed (BRD-001 OQ-06) | 409 `withdrawal-window-closed`, **not** `version-conflict` — retrying with a fresh version would only fail again, and the employee's real next step is to contact HR |
| Request is already `WITHDRAWN` | — | 200, unchanged resource, no second audit row |

The third row is the case that matters: a bare version conflict would send the client into
a re-read-and-retry loop it can never win.

**Request payload:**

```json
{ "withdrawalReason": "string | null" }
```

`withdrawalReason` is treated as employee narrative and carries the same handling as
`reason` (AC16).

**Success response (200):** the resource as per API04, with `status: "WITHDRAWN"`, all
incomplete stages set to `CANCELLED`, and `availableActions: []`.

**Exceptions:**

| Code | Condition                                                      | Response body                                                                                                |
| ---- | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 400  | `If-Match` header absent and the request is not already `WITHDRAWN` | Problem, `type: precondition-required`                                                                  |
| 401  | No or invalid token                                            | Problem, `type: unauthenticated`                                                                             |
| 404  | Not found, or not owned by the caller                          | Problem, `type: request-not-found`                                                                           |
| 409  | Status is `FULFILMENT`, `COMPLETED`, `REJECTED` or `CANCELLED` | Problem, `type: withdrawal-window-closed`, `detail` telling the employee to contact HR, plus `currentStatus`. **Takes precedence over `version-conflict`** |
| 409  | Status is still withdrawable but `If-Match` does not match the current version | Problem, `type: version-conflict`, with `currentVersion`                                     |
| 409  | Status is `DRAFT`                                              | Problem, `type: invalid-state-transition` — a draft is discarded, not withdrawn                              |
| 422  | `withdrawalReason` over 2000 characters                        | Problem, `type: validation-failed`                                                                           |
| 429  | Rate limit exceeded                                            | Problem, `type: rate-limited`                                                                                |

---

### `internal-transfer-request.API07` — GET `/api/v1/internal-transfers/reference-data`

**Purpose:** the governed option lists the wizard renders. Reference data only — it never
reflects any individual request.
**Auth:** authenticated employee.
**Rate limit:** 300 per hour per employee.
**Query:** `?departmentId=<id>&locationId=<id>` to narrow positions.
**Caching:** `Cache-Control: private, max-age=900`; server-side cache TTL 15 minutes.

**Success response (200):**

```json
{
  "departments": [{ "id": "string", "name": "string" }],
  "locations": [{ "id": "string", "name": "string", "city": "string", "country": "string" }],
  "positions": [
    {
      "id": "string",
      "title": "string",
      "departmentId": "string",
      "locationId": "string",
      "grade": "string",
      "openFrom": "2026-08-01"
    }
  ],
  "dateWindow": { "earliest": "2026-09-15", "latest": "2027-02-28" },
  "asOf": "2026-09-01T09:10:00Z",
  "stale": false
}
```

`positions` contains only positions that are open and internally fillable (BR6).
`stale: true` means the cache TTL has expired and the HRIS is unreachable, so the data is
being served past its freshness window — the UI must say so rather than present it as current.

**This endpoint is never the source of truth for a validation decision (BR14, G1-F12).**
It exists so the wizard can render governed option lists; it is cached, it can be stale,
and it describes no individual request. Every rule checked at submission — BR1, BR2, BR4,
BR5, BR6 — is evaluated against authoritative, uncached data read inside the submit call
(AC6, AC7, AC24). A position that this listing still shows as open is refused at submit if
it has since closed (AC6, UT14), and a submit attempted while the HRIS is unreachable is
refused with 503 rather than decided from cache (AC15, UT45). The asymmetry is deliberate:
stale data is acceptable for browsing and unacceptable for deciding.

**Exceptions:**

| Code | Condition                                   | Response body                                              |
| ---- | ------------------------------------------- | ---------------------------------------------------------- |
| 401  | No or invalid token                         | Problem, `type: unauthenticated`                           |
| 429  | Rate limit exceeded                         | Problem, `type: rate-limited`                              |
| 503  | HRIS unavailable **and** the cache is empty | Problem, `type: reference-data-unavailable`, `Retry-After` |

---

## Domain Events Emitted

This spec emits exactly two events, both through the transactional outbox, both committed
with the state change that produced them (ADR-0001). v1.1 named them without a version
suffix and defined no schema for either, even though three specs consume them — G1-F04 and
G1-F05.

### Naming — OWN-09 adopted

Both events now carry the mandatory `.v1` suffix required by shared fact **OWN-09**:

| v1.1 name | v1.3 canonical name |
| --- | --- |
| `employee.transfer.requested` | `employee.transfer.requested.v1` |
| `employee.transfer.withdrawn` | `employee.transfer.withdrawn.v1` |

This was the last non-compliant pair in the programme. `internal-transfer-notifications`
recorded the divergence as a release blocker (its A2) and `internal-transfer-approval-chain`
and `internal-transfer-downstream-orchestration` were already compliant, so adopting the
suffix here closes the four-way inconsistency rather than adding a fifth spelling.

### Envelope

Identical to the envelope `internal-transfer-downstream-orchestration` defines, so a
consumer writes one parser and one dedupe rule for the whole journey:

```json
{
  "eventId": "uuid",
  "eventType": "employee.transfer.requested.v1",
  "eventVersion": 1,
  "occurredAt": "RFC3339",
  "correlationId": "uuid",
  "requestId": "uuid",
  "payload": {}
}
```

| Envelope field | Type | Required | Notes |
| --- | --- | --- | --- |
| `eventId` | UUID | Yes | Unique per emitted event; **the consumer's dedupe key** — delivery is at-least-once |
| `eventType` | String | Yes | Fully qualified, including the `.v1` suffix |
| `eventVersion` | Integer | Yes | Matches the suffix, so a consumer branches without parsing strings |
| `occurredAt` | RFC3339 | Yes | Portal commit time of the transition that produced the event |
| `correlationId` | UUID | Yes | Propagated from the originating call, and the same value written to the audit row (AC18) |
| `requestId` | UUID | Yes | Lifted out of the payload so routing never parses it |
| `payload` | Object | Yes | Allow-list below |

### `employee.transfer.requested.v1`

Emitted once, inside the submit transaction (AC9). Consumed by
`internal-transfer-notifications` (matrix rows 1–2). `internal-transfer-approval-chain`
does **not** need it to begin work — submission already leaves `MANAGER_RELEASE`
`IN_PROGRESS` — so it is an announcement, not a handoff.

```json
{
  "referenceNo": "ITR-2026-000123",
  "employeeId": "string",
  "lineManagerRef": "string | null",
  "targetDepartmentId": "string",
  "targetLocationId": "string",
  "targetPositionId": "string",
  "requestedEffectiveDate": "YYYY-MM-DD",
  "submittedAt": "RFC3339",
  "applicableStageCodes": ["MANAGER_RELEASE", "MANAGER_ACCEPT", "HR_VALIDATION", "ORG_DATA_UPDATE", "EMPLOYEE_CONFIRMATION"]
}
```

| Payload field | Type | Required | Notes |
| --- | --- | --- | --- |
| `referenceNo` | String | Yes | Human-readable reference; safe to display |
| `employeeId` | String | Yes | Permitted — pseudonymous, not PII (constitution, Security Posture) |
| `lineManagerRef` | String, nullable | Yes | `MANAGER_RELEASE.assigned_party_ref`. **Null when unresolved**, which notifications AC8 already handles by skipping the manager notification rather than guessing |
| `targetDepartmentId`, `targetLocationId`, `targetPositionId` | String | Yes | **IDs only, never names** — a position title or department name is not needed by any consumer and drifts from the frozen snapshot |
| `requestedEffectiveDate` | Date | Yes | Requested, never confirmed; HR sets the confirmed date later (approval-chain BR3) |
| `submittedAt` | RFC3339 | Yes | |
| `applicableStageCodes` | Array of stage codes | Yes | Only stages with `applicable: true`, in sequence order. Lets a consumer see the shape of the journey without reading the aggregate |

**Never in this payload:** `reason` or any part of it, legal names, contact details, grade
or salary (AC16, BR2 of the notifications spec, constitution Security Posture). The
authoritative record is the aggregate; the event carries only what a consumer needs to act.

### `employee.transfer.withdrawn.v1`

Emitted once, inside the withdraw transaction (AC14). Consumed by
`internal-transfer-notifications` (matrix row 4). The reviewer's G1-F05 named only
`requested`, but `withdrawn` had the identical gap and is defined here for the same reason.

```json
{
  "referenceNo": "ITR-2026-000123",
  "employeeId": "string",
  "withdrawnAt": "RFC3339",
  "previousStatus": "MANAGER_REVIEW",
  "cancelledStageCodes": ["MANAGER_RELEASE", "MANAGER_ACCEPT", "HR_VALIDATION"]
}
```

`withdrawalReason` is **absent by construction**, not merely omitted by convention: it is
employee narrative under AC16 and the same Security Posture rule that excludes `reason`.
`previousStatus` is included because a consumer may legitimately care whether the employee
withdrew before or after a manager had acted.

### Evolution

Additive only within `v1` (constitution — Versioning Rules). A consumer must ignore payload
fields it does not recognise. Removing a field, retyping one, or changing the meaning of
one requires a `.v2` event type and a documented consumer migration — never an in-place
edit of the shape above.

---

## Acceptance Criteria

1. `internal-transfer-request.AC1` — Given an authenticated employee with no transfer
   request in a non-terminal state, when they create a transfer request, then a request is
   persisted with status `DRAFT`, `version` 1, a unique human-readable reference number in
   the form `ITR-<year>-<6-digit sequence>`, and an **informational** read of their current
   department, location, position and months of service in that position, and the request
   is returned with HTTP 201 — and that draft-time assignment data is explicitly not the
   frozen snapshot, which AC9 takes at submission from data read at that moment.

2. `internal-transfer-request.AC2` — Given a request in `DRAFT` owned by the caller, when
   they update it supplying an `If-Match` version that equals the stored version, then the
   supplied fields are persisted, `version` is incremented by 1, and HTTP 200 is returned;
   and when they supply an `If-Match` version that does not equal the stored version, then
   no change is persisted and HTTP 409 `version-conflict` is returned carrying the current
   version.

3. `internal-transfer-request.AC3` — Given a request in `DRAFT` missing any of target
   department, target location, target position or requested effective date, when the
   employee submits it, then the request remains in `DRAFT` and HTTP 422
   `validation-failed` is returned with one `violations` entry per missing field, each
   naming the field.

4. `internal-transfer-request.AC4` — Given a request in `DRAFT`, when the employee submits
   it with a requested effective date earlier than 14 calendar days from today or later
   than 180 calendar days from today, then the request remains in `DRAFT` and HTTP 422 is
   returned citing `internal-transfer-request.BR7`; and when the date is inside that window
   but is not the first day of a payroll cycle, then the submission **succeeds** and the
   response carries a non-blocking advisory citing `internal-transfer-request.BR8`.

5. `internal-transfer-request.AC5` — Given a request in `DRAFT` whose target department,
   location and position are all identical to the employee's current assignment, when the
   employee submits it, then the request remains in `DRAFT` and HTTP 422 is returned citing
   `internal-transfer-request.BR5`.

6. `internal-transfer-request.AC6` — Given a request in `DRAFT` whose target position is no
   longer open or is not internally fillable at the moment of submission, when the employee
   submits it, then the request remains in `DRAFT` and HTTP 422 is returned citing
   `internal-transfer-request.BR6`, regardless of whether the position was selectable when
   the draft was saved.

7. `internal-transfer-request.AC7` — Given a request in `DRAFT`, when the employee submits
   it, then eligibility is evaluated against `BR1` (active and confirmed), `BR2` (12 months
   in position as at the requested effective date, calculated per BR12) and `BR4` (no
   active exit process) using **authoritative, uncached** employment data read at
   submission time (BR14); if any fail, the request remains in `DRAFT` and
   HTTP 422 `eligibility-failed` is returned with one `violations` entry per failed rule;
   and if all pass, the response carries an advisory citing
   `internal-transfer-request.BR9` stating that HR performs further checks the portal does
   not perform, so that a successful submission is never presented as full eligibility
   clearance.

8. `internal-transfer-request.AC8` — Given an employee who already has a transfer request
   in a non-terminal state, when they attempt to create a new request, then no request is
   created and HTTP 409 `active-request-exists` is returned citing
   `internal-transfer-request.BR3` and identifying the existing request; and given two
   creation attempts arriving concurrently for the same employee, then exactly one succeeds
   and the other receives the same 409 — and the guarantee is a **database partial unique
   index on `employee_id` restricted to the non-terminal statuses**, not the application
   check alone, so it holds under real concurrency and across processes (G1-F09).

9. `internal-transfer-request.AC9` — Given a request in `DRAFT` that passes every rule in
   AC3–AC8, when the employee submits it, then in a **single database transaction**: status
   becomes `MANAGER_REVIEW`, `submittedAt` is set, an audit and history entry of type
   `SUBMITTED` is written, the current-assignment snapshot is frozen from data read during
   this call, all eight stage rows are created with each `applicable` flag resolved by the
   applicability rules, `MANAGER_RELEASE` is set to `IN_PROGRESS` and the other seven to
   `NOT_STARTED`, and one `employee.transfer.requested.v1` event is written to the outbox —
   and if any part of that fails, none of it is persisted and the request remains in
   `DRAFT`; and at no point is a request observable through any API with status
   `SUBMITTED`, nor with status `MANAGER_REVIEW` and no stage `IN_PROGRESS`.

10. `internal-transfer-request.AC10` — Given a submit request carrying an
    `Idempotency-Key` that has already been used successfully by the same employee within
    24 hours for the same request, when it is replayed, then the original response is
    returned unchanged, no second event is written and no second audit record is created;
    and given the same key replayed against a _different_ request, then HTTP 409
    `idempotency-key-conflict` is returned; and given a submit with no `Idempotency-Key`
    header, then HTTP 400 is returned and nothing is persisted.

11. `internal-transfer-request.AC11` — Given a submitted request owned by the caller, when
    they retrieve it, then the response contains the current status with a
    plain-language display label, the requested effective date marked `REQUESTED` until a
    confirmed date exists, every stage in sequence with its status, its `statusDisplay`
    from the vocabulary table (including `FAILED`, `COMPENSATION_REQUESTED`, `COMPENSATED`
    and `COMPENSATION_FAILED` when those have been written by downstream), and `applicable`
    flag including non-applicable stages rendered as "Not required", the single
    `pendingWith` stage where one exists, and the transition history; `currentAssignment`
    is the snapshot frozen at submission, not the draft-time read; and `assignedPartyName`
    is populated only for a stage assigned
    to the caller's own line manager, and is `null` for every other stage (**OWN-12**;
    BRD-001 OQ-11 Resolved 2026-09-11).

12. `internal-transfer-request.AC12` — Given an employee with several requests, when they
    list their requests, then only their own requests are returned, sorted by creation date
    descending, paginated with a default page size of 10, and no `reason` field appears in
    any list item.

13. `internal-transfer-request.AC13` — Given an authenticated employee, when they request,
    update, submit or withdraw a request that exists but belongs to another employee, then
    the operation is refused with HTTP 404 `request-not-found` — deliberately not 403,
    because a 403 would confirm that the identifier exists — and no field of that request
    appears in the response or in any log line; and when any request body, query parameter
    or path supplies an employee identifier, then it is ignored for authorisation, which is
    derived from the token subject only.

14. `internal-transfer-request.AC14` — Given a request whose status is `MANAGER_REVIEW` or
    `HR_VALIDATION` and a matching `If-Match` version, when the owning employee withdraws
    it, then status becomes `WITHDRAWN`, every incomplete stage becomes `CANCELLED`, an
    audit record is written and one `employee.transfer.withdrawn.v1` event is queued; and
    given a request whose status is `FULFILMENT`, `COMPLETED`, `REJECTED` or `CANCELLED`,
    then the withdrawal is refused with HTTP 409 `withdrawal-window-closed` whose `detail`
    directs the employee to contact HR; and given a request already `WITHDRAWN`, then HTTP
    200 is returned with the unchanged resource and no second audit row, whatever
    `If-Match` carried.

15. `internal-transfer-request.AC15` — Given the HRIS is unavailable, when the employee
    requests reference data and a cache entry exists within or beyond its TTL, then the
    cached data is returned with `stale` set accordingly; when no cache entry exists, then
    HTTP 503 `reference-data-unavailable` is returned with a `Retry-After` header; and when
    the employee submits a request while the HRIS is unavailable, then the submission is
    refused with HTTP 503, the request remains in `DRAFT` with no partial state written,
    and no other portal journey is affected.

16. `internal-transfer-request.AC16` — Given a request with a `reason` or
    `withdrawalReason`, then that text is encrypted at rest, is returned only to the owning
    employee, is absent from list responses, is absent from every emitted event payload and
    every notification payload, and never appears in any log line, trace attribute, error
    message or metric label at any log level — and given a submission that fails validation,
    then the error response echoes no field of the reason text.

17. `internal-transfer-request.AC17` — Given an employee who exceeds the documented rate
    limit for an endpoint, when they call it again inside the window, then HTTP 429
    `rate-limited` is returned with a `Retry-After` header, no state is changed, and the
    rate-limit counter is keyed by a salted hash of the employee identifier rather than by
    any directly identifying value.

18. `internal-transfer-request.AC18` — Given any state transition of a request — created,
    updated, submitted, withdrawn, discarded — when it succeeds, then an append-only audit
    record is written carrying the acting principal's **raw employee ID**, their role, the
    event type, the from- and to-status, the UTC timestamp and the correlation ID of the
    originating call, and no code path exists that can update or delete an audit record.

    **Employee-ID classification (G1-F07).** The constitution's Security Posture settles
    this: "Employee ID is a pseudonymous internal identifier and is not PII on its own."
    So the raw employee ID is **permitted, unhashed, in an audit row**, and "contains no
    PII" in v1.1's wording meant — and now says — no legal name, no date of birth, no
    personal contact details and no free-text employee narrative. AC17 hashes the
    identifier for a different reason, and the contrast is not an inconsistency: a
    rate-limit key is a high-cardinality value in a cache that is replicated, exported to
    metrics and never retention-controlled, whereas an audit row is access-controlled,
    retained deliberately for 7 years (BRD-001 OQ-17) and is worthless for forensics if the
    actor cannot be identified. Hashing the audit actor would destroy the record's purpose
    without reducing exposure. _Caveat for the reviewer:_ the "not PII" carve-out is a
    2026-08-28 constitution amendment still marked pending your Gate 1 review, so this AC
    rests on it and moves with it.

19. `internal-transfer-request.AC19` — Given an employee using the transfer wizard and the
    status view with a keyboard only or with a screen reader, when they complete the
    journey, then every control is reachable and operable, every field has a programmatic
    label, every validation error is announced and is associated with its field, and the
    stage timeline exposes each stage's status as text rather than by colour alone,
    meeting WCAG 2.1 AA.

20. `internal-transfer-request.AC20` — Given a caller with no access token, or with an
    invalid or expired token, when they call any of API01–API07, then HTTP 401
    `unauthenticated` is returned, no transfer row, stage, audit row or outbox row is
    written or updated, and authorisation is not inferred from any employee identifier in
    the body, query or path.

21. `internal-transfer-request.AC21` — Given an unauthenticated browser session, when the
    employee navigates to the transfer wizard or status routes, then those screens are not
    rendered with request data and the user is handled by the portal's existing OIDC
    sign-in — this feature must not show a transfer-specific username/password form; and
    given an authenticated employee, when they use those screens, then API calls send the
    session bearer token and do not send a caller-chosen employee id for authorisation.

22. `internal-transfer-request.AC22` — Given a position start date and a requested
    effective date, when BR2 is evaluated, then service length is the count of **whole
    completed calendar months** between them, inclusive of the effective date, so that a
    start date of 2025-10-01 with an effective date of 2026-10-01 yields 12 and passes,
    while 2026-09-30 yields 11 and fails; and the value is taken from authoritative HRIS
    data at submission time, never from the draft-time `serviceInPositionMonths` shown by
    API01. Unpaid leave of absence does not break continuity in v1 (BRD-001 OQ-22 Resolved
    2026-09-11): service runs from the position start date regardless of leave.

23. `internal-transfer-request.AC23` — Given a withdrawal and an approval submitted
    concurrently against one request, when both are processed, then exactly one commits;
    if the withdrawal commits first the request is `WITHDRAWN` and the approval is refused;
    if an approval commits first and the request is still `MANAGER_REVIEW` or
    `HR_VALIDATION` the withdrawal is refused with 409 `version-conflict` carrying
    `currentVersion`; and if an approval commits first and the request has reached
    `FULFILMENT` the withdrawal is refused with 409 `withdrawal-window-closed` rather than
    `version-conflict`, so the client is not sent into a retry loop it cannot win.

24. `internal-transfer-request.AC24` — Given reference data served from cache by API07,
    including with `stale: true`, when the employee submits a request whose selections came
    from that listing, then every submission-time rule is evaluated against authoritative
    uncached data and the cached listing is never consulted for the decision — so a
    position shown as open but since closed is refused under BR6, and a submit attempted
    while the authoritative source is unreachable is refused with 503 with the request left
    in `DRAFT`, never approved from cache.

25. `internal-transfer-request.AC25` — Given two concurrent create calls for one employee
    that both pass the application-level BR3 check, when both reach the database, then the
    partial unique index on `employee_id` over non-terminal statuses rejects the second,
    exactly one row exists, and the losing caller receives 409 `active-request-exists` —
    the invariant holding even if the application check were removed.

26. `internal-transfer-request.AC26` — Given a successful submit or withdraw, when the
    emitted outbox row is inspected, then it carries the full envelope — `eventId`,
    `eventType` including its `.v1` suffix, `eventVersion`, `occurredAt`, `correlationId`
    matching the audit row, `requestId` — and a `payload` containing only the allow-listed
    fields for that event; and no payload contains `reason`, `withdrawalReason`, a legal
    name, contact details, grade or salary.

27. `internal-transfer-request.AC27` — Given any `(status, operation)` pair not listed in
    the request-transition table, when it is attempted through any endpoint of this spec,
    then it is refused with 409 `invalid-state-transition` carrying `currentStatus`, no
    state is changed, no audit row is written and no event is emitted — the contract is
    total, so an unlisted combination fails closed rather than falling through to a
    default.

28. `internal-transfer-request.AC28` — Given a submitted request, when
    `internal-transfer-approval-chain` reads the aggregate, then it finds status
    `MANAGER_REVIEW` with `MANAGER_RELEASE` at `IN_PROGRESS` and the full eight-row stage
    plan with resolved `applicable` flags — its AC1 precondition satisfied with no
    intermediate step; and when `internal-transfer-notifications` consumes the emitted
    `employee.transfer.requested.v1`, then the envelope and payload match the schema above
    and `lineManagerRef` is present or explicitly `null`.

## Unit Test Cases (spec-derived)

| Test ID                          | Maps to AC | Scenario                                                      | Expected                                                                             |
| -------------------------------- | ---------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `internal-transfer-request.UT01` | AC1        | Employee with no active request creates one                   | 201; status `DRAFT`, version 1, reference matches `ITR-\d{4}-\d{6}`                  |
| `internal-transfer-request.UT02` | AC1        | Draft creation snapshots current assignment                   | Response `currentAssignment` matches HRIS values, `serviceInPositionMonths` computed |
| `internal-transfer-request.UT03` | AC2        | Update draft with matching `If-Match`                         | 200; fields persisted, version incremented                                           |
| `internal-transfer-request.UT04` | AC2        | Update draft with stale `If-Match`                            | 409 `version-conflict`; stored record unchanged                                      |
| `internal-transfer-request.UT05` | AC2        | Update draft with no `If-Match` header                        | 400 `precondition-required`                                                          |
| `internal-transfer-request.UT06` | AC3        | Submit with target position missing                           | 422; one violation naming `targetPositionId`; status still `DRAFT`                   |
| `internal-transfer-request.UT07` | AC3        | Submit with all four mandatory fields missing                 | 422; exactly four violations                                                         |
| `internal-transfer-request.UT08` | AC4        | Submit with effective date today + 13 days                    | 422 citing `BR7`                                                                     |
| `internal-transfer-request.UT09` | AC4        | Submit with effective date today + 14 days                    | 200 — boundary is inclusive                                                          |
| `internal-transfer-request.UT10` | AC4        | Submit with effective date today + 181 days                   | 422 citing `BR7`                                                                     |
| `internal-transfer-request.UT11` | AC4        | Submit with in-window, mid-payroll-cycle date                 | 200 with advisory `PAYROLL_CYCLE_MISALIGNED` citing `BR8`                            |
| `internal-transfer-request.UT12` | AC5        | Submit where target equals current on all three attributes    | 422 citing `BR5`                                                                     |
| `internal-transfer-request.UT13` | AC5        | Submit where only location differs                            | 200 — one differing attribute is sufficient                                          |
| `internal-transfer-request.UT14` | AC6        | Position open when drafted, closed at submit                  | 422 citing `BR6`                                                                     |
| `internal-transfer-request.UT15` | AC7        | Employee on probation submits                                 | 422 `eligibility-failed` citing `BR1`                                                |
| `internal-transfer-request.UT16` | AC7        | Employee with 11 months in position at effective date         | 422 citing `BR2`                                                                     |
| `internal-transfer-request.UT17` | AC7        | Employee at exactly 12 months at effective date               | 200 — boundary is inclusive                                                          |
| `internal-transfer-request.UT18` | AC7        | Employee with an active resignation                           | 422 citing `BR4`                                                                     |
| `internal-transfer-request.UT19` | AC7        | Employee failing BR1 and BR2 together                         | 422 with two violations, not one                                                     |
| `internal-transfer-request.UT20` | AC7        | Successful submission                                         | Response advisories include `MANUAL_HR_CHECKS_PENDING` citing `BR9`                  |
| `internal-transfer-request.UT21` | AC8        | Create while a `MANAGER_REVIEW` request exists                | 409 citing `BR3`, identifying the existing request                                   |
| `internal-transfer-request.UT22` | AC8        | Create while a `WITHDRAWN` request exists                     | 201 — terminal states do not block                                                   |
| `internal-transfer-request.UT23` | AC8        | Two concurrent creates for one employee                       | Exactly one 201, one 409; one row in the database                                    |
| `internal-transfer-request.UT24` | AC9        | Successful submit                                             | Status `MANAGER_REVIEW`; 8 stage rows with `MANAGER_RELEASE` `IN_PROGRESS` and seven `NOT_STARTED`; audit row typed `SUBMITTED`; 1 outbox row |
| `internal-transfer-request.UT25` | AC9        | Stage applicability, target in same department and location   | `PAYROLL_UPDATE`, `IT_ACCESS`, `FACILITIES` persisted with `applicable: false`       |
| `internal-transfer-request.UT26` | AC9        | Outbox write fails during submit                              | Transaction rolls back; status still `DRAFT`; no stage or audit rows                 |
| `internal-transfer-request.UT27` | AC10       | Submit replayed with the same `Idempotency-Key`               | Identical response; still one outbox row and one audit row                           |
| `internal-transfer-request.UT28` | AC10       | Same key reused on a different request                        | 409 `idempotency-key-conflict`                                                       |
| `internal-transfer-request.UT29` | AC10       | Submit with no `Idempotency-Key`                              | 400; nothing persisted                                                               |
| `internal-transfer-request.UT30` | AC11       | Retrieve a submitted request                                  | All stages returned in sequence including non-applicable ones; single `pendingWith`  |
| `internal-transfer-request.UT31` | AC11       | Stage assigned to the caller's own line manager               | `assignedPartyName` populated                                                        |
| `internal-transfer-request.UT32` | AC11       | Stage assigned to HR or the receiving manager                 | `assignedPartyName` is null; role present                                            |
| `internal-transfer-request.UT33` | AC11       | Request with no confirmed date                                | `effectiveDateStatus` is `REQUESTED`, `confirmedEffectiveDate` null                  |
| `internal-transfer-request.UT34` | AC12       | List with requests belonging to two employees in the database | Only the caller's are returned                                                       |
| `internal-transfer-request.UT35` | AC12       | List response body                                            | No `reason` key present on any item                                                  |
| `internal-transfer-request.UT36` | AC13       | GET another employee's request by ID                          | 404 `request-not-found`; no field of that request in body or logs                    |
| `internal-transfer-request.UT37` | AC13       | Submit with a spoofed `employeeId` in the body                | Identifier ignored; authorisation from token subject                                 |
| `internal-transfer-request.UT38` | AC14       | Withdraw a `MANAGER_REVIEW` request with a matching `If-Match` | 200 `WITHDRAWN`; incomplete stages `CANCELLED`; audit and outbox rows written        |
| `internal-transfer-request.UT39` | AC14       | Withdraw a `FULFILMENT` request                               | 409 `withdrawal-window-closed` naming HR as the route                                |
| `internal-transfer-request.UT40` | AC14       | Withdraw an already-`WITHDRAWN` request                       | 200, resource unchanged, no second audit row                                         |
| `internal-transfer-request.UT41` | AC14       | Withdraw a `DRAFT` request                                    | 409 `invalid-state-transition`                                                       |
| `internal-transfer-request.UT42` | AC15       | Reference data with HRIS down, cache warm within TTL          | 200, `stale: false`                                                                  |
| `internal-transfer-request.UT43` | AC15       | Reference data with HRIS down, cache past TTL                 | 200, `stale: true`                                                                   |
| `internal-transfer-request.UT44` | AC15       | Reference data with HRIS down, cache empty                    | 503 with `Retry-After`                                                               |
| `internal-transfer-request.UT45` | AC15       | Submit with HRIS down                                         | 503; status still `DRAFT`; no stage, audit or outbox rows                            |
| `internal-transfer-request.UT46` | AC16       | Submit a request carrying reason text                         | Emitted event payload contains no reason field                                       |
| `internal-transfer-request.UT47` | AC16       | Log capture across the full submit path                       | No log line at any level contains the reason text                                    |
| `internal-transfer-request.UT48` | AC16       | Retrieve list and detail as the owner                         | Reason present in detail, absent from list                                           |
| `internal-transfer-request.UT49` | AC17       | Sixth submit inside one hour                                  | 429 with `Retry-After`; no state change                                              |
| `internal-transfer-request.UT50` | AC17       | Inspect the rate-limit key                                    | Key contains a salted hash, not a raw employee identifier                            |
| `internal-transfer-request.UT51` | AC18       | Create, update, submit, withdraw in sequence                  | Four audit rows with correct from/to statuses and the same correlation ID per call   |
| `internal-transfer-request.UT52` | AC18       | Attempt to update an audit row                                | Rejected at the database layer                                                       |
| `internal-transfer-request.UT53` | AC19       | Wizard traversed by keyboard only                             | Every control reachable and operable; focus order matches visual order               |
| `internal-transfer-request.UT54` | AC19       | Submit with a validation error, screen reader                 | Error announced and programmatically associated with its field                       |
| `internal-transfer-request.UT55` | AC19       | Stage timeline rendered in greyscale                          | Each stage status remains distinguishable as text                                    |
| `internal-transfer-request.UT56` | AC20       | API01 with no `Authorization` header                          | 401 `unauthenticated`; no `transfer_request` row inserted                            |
| `internal-transfer-request.UT57` | AC20       | API03 with an expired token                                   | 401; draft status unchanged                                                          |
| `internal-transfer-request.UT58` | AC21       | Unauthenticated visit to the wizard route                     | Portal existing sign-in; wizard does not load another employee's data                |
| `internal-transfer-request.UT59` | AC21       | Authenticated wizard save                                     | Request carries bearer token; no `employeeId` used for AuthZ                         |
| `internal-transfer-request.UT60` | AC9        | Submit, then immediately GET the request                      | Never observable as `SUBMITTED`; `MANAGER_REVIEW` with exactly one stage `IN_PROGRESS` |
| `internal-transfer-request.UT61` | AC22       | Position start 2025-10-01, effective date 2026-10-01          | 12 months; submit passes                                                             |
| `internal-transfer-request.UT62` | AC22       | Position start 2025-10-01, effective date 2026-09-30          | 11 whole months; 422 citing `BR2`                                                    |
| `internal-transfer-request.UT63` | AC22       | Draft-time `serviceInPositionMonths` says 12, HRIS says 11 at submit | 422 citing `BR2` — the draft value is not consulted                           |
| `internal-transfer-request.UT64` | AC23       | Withdraw and manager approval committed concurrently, withdrawal first | Request `WITHDRAWN`; approval refused; one audit row for the withdrawal     |
| `internal-transfer-request.UT65` | AC23       | Approval commits first, request still `HR_VALIDATION`         | Withdraw gets 409 `version-conflict` with `currentVersion`                           |
| `internal-transfer-request.UT66` | AC23       | HR approval commits first, request now `FULFILMENT`           | Withdraw gets 409 `withdrawal-window-closed`, not `version-conflict`                 |
| `internal-transfer-request.UT67` | AC14       | Withdraw an already-`WITHDRAWN` request with a stale `If-Match` | 200, unchanged; terminal check precedes the precondition check                     |
| `internal-transfer-request.UT68` | AC24       | Position listed open by a `stale: true` API07 response, closed authoritatively | 422 citing `BR6`                                                    |
| `internal-transfer-request.UT69` | AC25       | Two concurrent creates with the application BR3 check disabled | Database index rejects the second; exactly one row                                  |
| `internal-transfer-request.UT70` | AC26       | Inspect the `requested.v1` outbox row after submit            | Full envelope; `eventType` ends `.v1`; payload keys exactly the allow-list           |
| `internal-transfer-request.UT71` | AC26       | Submit and withdraw a request carrying reason text            | Neither payload contains `reason`, `withdrawalReason`, a name or contact detail      |
| `internal-transfer-request.UT72` | AC26       | `MANAGER_RELEASE.assigned_party_ref` unresolved at submit     | `lineManagerRef` present and explicitly `null`, not omitted                          |
| `internal-transfer-request.UT73` | AC27       | Submit a `MANAGER_REVIEW` request; withdraw a `DRAFT`; update a `WITHDRAWN` | Each 409 `invalid-state-transition`; no audit row, no outbox row          |
| `internal-transfer-request.UT74` | AC28       | **Integration**, approval-chain contract double: submit then read the aggregate as approval-chain | Its AC1 precondition holds with no intermediate step             |
| `internal-transfer-request.UT75` | AC28       | **Integration**, notification-service contract double: submit then let notifications consume `requested.v1` | Employee and line-manager notifications enqueued from the envelope alone |
| `internal-transfer-request.UT76` | AC11       | Retrieve a `FULFILMENT` request whose `PAYROLL_UPDATE` is `FAILED` and `ORG_DATA_UPDATE` is `COMPENSATED` | Each stage returns `statusDisplay` from the vocabulary ("Could not complete", "Reversed"); request `statusDisplay` remains "Being actioned"; `pendingWith` is null |

UT74 and UT75 are the cross-spec handoff tests G1-F13 asked for, and use contract doubles
rather than hand-rolled stubs (constitution — Testing Discipline). UT60, UT62–UT69 and UT73
are negative or race paths; the 85% coverage floor applies to this module as one handling
employee records, and coverage met without these paths would not satisfy it.

## Traceability — BRD → rule → AC → test

G1-F14. Readable in both directions: every rule reaches an AC and a test, and every AC
traces back to a BRD-001 item, a shared fact, the constitution or a named Gate 1 finding.
Rows whose source is an **open** question are marked, because those are the ones that can
still move.

| Source of record | Spec rule | Acceptance criteria | Tests |
| --- | --- | --- | --- |
| BRD-001 BR1 | BR1 | AC7 | UT15, UT19 |
| BRD-001 BR2; Gate 1 G1-F10; OQ-22 Resolved 2026-09-11 | BR2, BR12 | AC7, AC22 | UT16, UT17, UT61, UT62, UT63 |
| BRD-001 BR3; Gate 1 G1-F09 | BR3 | AC8, AC25 | UT21, UT22, UT23, UT69 |
| BRD-001 BR4 | BR4 | AC7 | UT18, UT19 |
| BRD-001 BR5 | BR5 | AC5 | UT12, UT13 |
| BRD-001 BR6; Gate 1 G1-F12 | BR6, BR14 | AC6, AC24 | UT14, UT68 |
| BRD-001 BR7 | BR7 | AC4 | UT08, UT09, UT10 |
| BRD-001 BR8 | BR8 | AC4 | UT11 |
| BRD-001 BR9 | BR9 | AC7 | UT20 |
| BRD-001 BR10, KD-07, KD-08 | BR10 | AC20, AC21 | UT56, UT57, UT58, UT59 |
| BRD-001 BR11; OWN-01, OWN-02 | BR11 | AC12, AC13 | UT34, UT36, UT37 |
| BRD-001 OQ-06 | — | AC14, AC23 | UT38, UT39, UT40, UT41, UT66, UT67 |
| BRD-001 OQ-11 Resolved 2026-09-11; OWN-12 | — | AC11 | UT30, UT31, UT32, UT33 |
| BRD-001 OQ-12; OWN-05; constitution Security Posture | — | AC16 | UT46, UT47, UT48, UT71 |
| BRD-001 OQ-17; constitution ("employee ID is not PII"); Gate 1 G1-F07 | — | AC18 | UT51, UT52 |
| OWN-09; Gate 1 G1-F04, G1-F05 | — | AC26 | UT70, UT71, UT72 |
| OWN-10; Gate 1 G1-F01, G1-F02, G1-F03 | — | AC9, AC27 | UT24, UT25, UT26, UT60, UT73 |
| OWN-11; Gate 1 G1-F08 | BR13 | AC2, AC23 | UT03, UT04, UT05, UT64, UT65, UT66 |
| Gate 1 G1-F11 | — | AC1, AC9 | UT01, UT02, UT63 |
| Downstream v1.2 A6 (compensation status labels owned here) | — | AC11 | UT76 |
| Gate 1 G1-F13 | — | AC28 | UT74, UT75 |
| Constitution — idempotency records | — | AC3, AC10 | UT06, UT07, UT27, UT28, UT29 |
| Constitution — degradation; architecture _Integration Points_ | BR14 | AC15 | UT42, UT43, UT44, UT45 |
| Constitution — NFC rate limits | — | AC17 | UT49, UT50 |
| Constitution — WCAG 2.1 AA | — | AC19 | UT53, UT54, UT55 |

## Open Questions

| #   | Question | Owner | Needed by | Resolution |
| --- | --- | --- | --- | --- |
| 1   | In "pending with", does the employee see a named person or only a role? | Product (v1 lock); Data Privacy may reopen post-v1 | Closed | **Resolved 2026-09-11 — BRD-001 OQ-11 / OWN-12.** Named person only for the employee's own line manager; every other stage shows the role. AC11, API04, UT31, UT32. |
| 2   | Does unpaid leave break BR2's 12-month continuous service? | Product (v1 lock); HR Policy may reopen post-v1 | Closed | **Resolved 2026-09-11 — BRD-001 OQ-22.** No deduction. BR12, AC22. |
| 3   | Should v1 expose a draft-discard endpoint that produces `DISCARDED`? | Product | Closed — deferred | **Deferred out of v1 (Product 2026-09-11).** The employee updates the existing draft (BR3). `DISCARDED` stays defined and unproduced. |

Copy for status display labels is Product's to refine; the vocabulary table is the closed set of *codes*. A plan must not invent legal-sounding HR prose in code.

## Assumptions

- A1 — The HRIS read API returns a current-position start date that BR12 can use. If false: AC22 cannot be implemented.
- A2 — The constitution's "employee ID is not PII" carve-out (2026-08-28, pending this reviewer's Gate 1 on the constitution itself) holds. If it is reversed, AC18 must hash the actor the way AC17 already hashes the rate-limit key, and forensic value of the audit trail is lost.
- A3 — Sibling specs consume the OWN-09 names this spec now emits. `internal-transfer-notifications` v1.2 recorded the unsuffixed forms as a release blocker; that blocker is closed from this side.
- A4 — `internal-transfer-approval-chain` AC1's precondition (`MANAGER_REVIEW` with `MANAGER_RELEASE` `IN_PROGRESS`) is established by this spec's submit, so that spec needs no `requested.v1` handler. If G1-F03 is reversed to asynchronous, A4 is false and approval-chain gains that handler.
- A5 — The employee-facing labels for `FAILED` / `COMPENSATION_*` in the stage-status table are acceptable copy for v1. If Product wants different wording, only `statusDisplay` strings change.

## Explicitly Out of Scope

- **Any approval decision.** Manager release, manager acceptance and HR validation are
  owned by `internal-transfer-approval-chain`. This spec creates their stage records and
  renders them; it never transitions them.
- **Downstream fulfilment.** HRIS org update, Payroll, IT and Facilities execution is owned
  by `internal-transfer-downstream-orchestration`. This spec emits one event and stops.
- **Notifications** of any kind, to anyone — owned by `internal-transfer-notifications`.
- **Manager- or HR-initiated transfers** (BRD-001 KD-02 fixes this as employee-initiated).
- **Return-for-edit after rejection** (BRD-001 OQ-07 — terminal for v1).
- **HR cancellation of a request past the withdrawal window.** AC14 names HR as the route;
  the mechanism is a later spec.
- **Approval SLA, escalation and approver delegation** (BRD-001 OQ-15, OQ-16).
- **Automated disciplinary or performance gating** (BRD-001 OQ-04). The portal must state
  that HR checks further, and must not imply it has checked.
- **Compensation or grade change approval**, promotions, international relocation, visa
  handling, contractor transfers, bulk or restructure transfers.
- **Localisation.** English only. Copy is externalised so a later spec can localise without
  reworking the components, but no second locale is delivered.
- **Native mobile applications.** Responsive web only.
- **Login, registration, password reset or MFA enrolment.** Authentication is the portal's
  existing OIDC session (BRD-001 KD-07). This spec only consumes that session.
- **Editing a request after submission.** A submitted request is immutable to the employee;
  the only employee action is withdrawal.
- **A draft-discard endpoint.** `DISCARDED` stays defined and audited, but no API produces
  it — **deferred out of v1 (Product 2026-09-11)**. The employee updates the existing draft.
- **Any mechanism that reaches `CANCELLED`.** Unreachable in v1 by design (BRD-001 OQ-06;
  Product confirmed 2026-09-11).
- **Merging a concurrent withdrawal with a concurrent approval.** One aggregate, one
  version, first commit wins, loser refused (BR13, AC23). No three-way merge, no
  last-write-wins.

## Non-Functional Constraints (from constitution.md)

- p95 < 400 ms for API04, API05 and API07; p95 < 700 ms for API01, API02, API03 and API06 —
  measured at the gateway.
- 99.9% availability for these endpoints; HRIS unavailability degrades this journey only and
  must not affect any other portal journey (AC15).
- WCAG 2.1 AA for every screen in this feature (AC19).
- No PII in logs at any level; reason text is employee narrative under the Security Posture
  amendment of 2026-08-28 (AC16).
- Every endpoint carries an explicit rate-limit decision — recorded per endpoint in the API
  Contract above (AC17).
- Audit records are immutable and retained 7 years; reason text is purged at 24 months
  (BRD-001 OQ-17).
- Unauthenticated calls return 401 and change no transfer state (AC20). Front end reuses
  the portal OIDC session and does not add a login page (AC21).
- Migrations forward-only and compatible with the previously deployed version. The BR3
  partial unique index (AC25) is part of that migration set, not an application concern.
- The submit transaction carries more work in v1.3 than in v1.1 — status, frozen snapshot,
  eight stage rows, stage-1 activation, audit row and outbox row — and still must meet
  p95 < 700 ms for API03. Synchronous routing is what buys the guarantee in AC9 that a
  submitted request is never observable without a pending stage; if that budget is ever
  at risk, the answer is to revisit G1-F03 explicitly at Gate 1, not to split the
  transaction silently at implementation time.
- Event payloads are additive-only within `.v1` (constitution — Versioning Rules). A
  consumer ignores unrecognised fields; a breaking change is a `.v2` event type.

## Revision History

| Version | Date       | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Driver                                                                                                                                                                |
| ------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| v1.0    | 2026-08-27 | Initial draft | BRD-001 |
| v1.1    | 2026-08-28 | AC7 split so each eligibility rule is cited individually and the BR9 advisory is mandatory; AC11 rewritten to resolve who may be named in `pendingWith`; AC13 changed from 403 to 404 with the enumeration rationale stated; AC14 given explicit behaviour for an already-withdrawn request and for a draft; AC16 added covering reason-text handling end to end; API03 exception table extended with `active-request-exists`, `idempotency-key-conflict` and the 503 case; state-machine note added to Context explaining the definition-vs-build dependency | Author revision before Gate 1 submission |
| v1.2    | 2026-09-08 | Authentication and authorisation section added (BR10, BR11, AC20, AC21); cites architecture AuthN/AuthZ; login remains out of scope | BRD-001 KD-07, KD-08, BR10, BR11 |
| v1.3    | 2026-09-11 | Gate 1 response to all fourteen findings against v1.1. _Authoritative State and Transition Contract_ replaces the ASCII diagram (OWN-10); `PENDING` removed in favour of `IN_PROGRESS`; submission decided synchronous and `SUBMITTED` demoted from status to history event type; `DISCARDED` and `CANCELLED` recorded as states with no owner; OWN-09 event naming adopted and both event schemas defined with a shared envelope; OQ-11 re-marked open and Approval-blocking; employee-ID-in-audit classification settled from the constitution; withdraw given `If-Match` and a defined approval race (OWN-11); BR12–BR14 added; AC22–AC28 and UT60–UT76 added including two cross-spec integration rows and compensation-status rendering; traceability matrix; BRD-001 OQ-22 raised for leave-of-absence treatment in service length; stage `statusDisplay` labels owned here including `COMPENSATION_REQUESTED` | Gate 1 G1-F01–G1-F14 (Abhijit Adhikari, 2026-09-09) |
| v1.4    | 2026-09-11 | Product v1 lock: OQ-11 confirmed as OWN-12; OQ-22 confirmed (no leave deduction); draft-discard endpoint deferred. No behaviour change from v1.3's proposed answers — they are now the contract | Product, 2026-09-11 |

## Gate 1 Review

> Reviewed by: Abhijit Adhikari, 2026-09-11, **Changes Requested** (against v1.4) — 5
> Blocker, 5 Nit (minor cleanup) findings. State invariant must become "at most one"
> `IN_PROGRESS` stage, not "exactly one," to account for the zero-pending state after a
> fulfilment failure/compensation; `COMPLETED`'s "confirmed by the employee" wording
> contradicts `EMPLOYEE_CONFIRMATION` being portal-set, not an employee action; a null
> `lineManagerRef` at submission leaves approval-chain's `MANAGER_RELEASE` permanently
> stuck on `assignee-unresolved` with no recovery path; BR13/OWN-11's compare-and-swap
> enforcement is stated conceptually but not defined for approval-chain's or downstream's
> own mutating APIs; and a failed fulfilment renders as `FULFILMENT` / "Being actioned"
> with `pendingWith: null` and no employee notification (OQ-21), which needs its own
> defined employee-visible behaviour so status isn't misleading. Findings worksheet:
> `.ai-context/reviews/internal-transfer-request.gate1.md`.

> Reviewed by: Abhijit Adhikari, 2026-09-09, **Changes Requested** (against v1.1) — 8
> Blocker, 6 Should-fix findings. "This is the aggregate-owning spec three other specs
> depend on, so ambiguity here propagates." Findings worksheet:
> `.ai-context/reviews/internal-transfer-request.gate1.md`.

### Author response — v1.3, 2026-09-11 (Alamgir Sarkar)

| Finding | Severity | Addressed in v1.3 by |
| --- | --- | --- |
| G1-F01 — `PENDING` vs `IN_PROGRESS` | Blocker | One stage-status vocabulary in the state contract. `PENDING` is removed entirely; `IN_PROGRESS` means "current and awaiting action" in all four specs. API03's response corrected |
| G1-F02 — no authoritative state/transition contract | Blocker | _Authoritative State and Transition Contract_, registered as OWN-10: status and stage vocabularies, a transition table naming the performing spec for every row, and a totality rule. The diagram is gone because it could not express ownership; AC27 and UT73 test the totality |
| G1-F03 — `SUBMITTED → MANAGER_REVIEW` sync or async | Blocker | **Decided synchronous**, with the asynchronous alternative written out for comparison. Consequence: `SUBMITTED` becomes a history event type, not a status. AC9, UT24, UT60 |
| G1-F04 — event naming | Blocker | OWN-09 adopted: `employee.transfer.requested.v1` and `.withdrawn.v1`. This was the last non-compliant pair in the programme |
| G1-F05 — no event schema | Blocker | _Domain Events Emitted_: shared envelope matching downstream's, plus typed payload allow-lists for both events. `withdrawn.v1` had the same gap and is defined too. AC26, UT70–UT72 |
| G1-F06 — OQ-11 treated as settled | Blocker | v1.3 cited it as open. **Closed 2026-09-11:** Product confirmed the proposed answer as OWN-12. AC11 and API04 are now the contract, not a proposal |
| G1-F07 — employee ID / PII in audit | Blocker | AC18 settled from the constitution's Security Posture: employee ID is pseudonymous and not PII, so the raw ID is permitted unhashed in an audit row. The apparent conflict with AC17's hashing is explained — different store, different retention, different purpose |
| G1-F08 — concurrent withdraw vs approval | Blocker | BR13 and OWN-11 give the aggregate one version; API06 now requires `If-Match`; a race table distinguishes `version-conflict` from `withdrawal-window-closed`. AC23, UT64–UT67 |
| G1-F09 — database invariant for BR3 | Should-fix | AC8 and AC25: partial unique index on `employee_id` over non-terminal statuses, tested with the application check disabled (UT69) |
| G1-F10 — service-length calculation | Should-fix | BR12 and AC22 define the mechanics. **OQ-22 Resolved 2026-09-11:** no leave deduction |
| G1-F11 — draft assignment data informational | Should-fix | Stated on API01 and API02 and in AC1; UT63 proves the draft value is not consulted at submission |
| G1-F12 — cached reference data vs authoritative validation | Should-fix | BR14, a paragraph on API07, AC24 and UT68 |
| G1-F13 — cross-spec integration tests | Should-fix | AC28, UT74 (approval-chain handoff) and UT75 (notifications handoff), both against contract doubles |
| G1-F14 — traceability matrix | Should-fix | _Traceability_ section, both directions, with open-question rows marked |

**What v1.3 left open, and what v1.4 closed.** Product locked the remaining business
questions on 2026-09-11:

- **OQ-11 (G1-F06) is Resolved** as OWN-12.
- **OQ-22 is Resolved** — no leave deduction.
- **Draft-discard is deferred**; `CANCELLED` stays unreachable (OQ-06). Both remain defined
  with no producer, on purpose.

**And one change that goes beyond clarifying, flagged so it is not approved by accident:**
demoting `SUBMITTED` from a status to a history event type removes a state from a published
state machine. It follows from the synchronous answer to G1-F03 — a status no API can
return is not a state — and it makes `internal-transfer-approval-chain`'s existing AC1
correct without a new handler. If the reviewer prefers the asynchronous handoff,
`SUBMITTED` returns as a status, this spec's AC9 and the transition table change, and
approval-chain gains a `requested.v1` consumer and an AC for it.
