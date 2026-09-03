# Spec: Employee Internal Transfer Request

## Spec ID

`internal-transfer-request`

## Status

**In Peer Review (Gate 1)** — Draft v1.1 submitted for review by Abhijit Adhikary.
Revision history at the end of this file. Full state machine in `.ai-context/status.md`.
Implementation must not start until this spec is **Approved**.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role | Name | Date |
|---|---|---|
| Author / owner | Alamgir Sarkar | 2026-08-27 |
| Gate 1 reviewer (never the author) | Abhijit Adhikary | _Pending review_ |
| Gate 2 reviewer | Tapas Dutta | — |

Gate 1 record: `.ai-context/reviews/internal-transfer-request.gate1.md`

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

- Builds on: `.ai-context/architecture.md` — *Components*, *Integration Points*,
  *Cross-Cutting Concerns*
- Constitution: `.ai-context/constitution.md` — Security Posture, Architectural
  Constraints, Non-Functional Baselines all apply and are not restated here
- Related specs (nothing in this spec depends on them being built):
  - `internal-transfer-approval-chain` — **Draft v1.0** — consumes the stage plan this spec creates
  - `internal-transfer-downstream-orchestration` — **Draft v1.0** — starts after HR approval, not from submit
  - `internal-transfer-notifications` — **Draft v1.0** — consumes state transitions this spec records
- API contract consumed: HRIS read API — `docs/contracts/hris-read-api.md`
- Design: portal design system; internal transfer wizard screens, Figma `OPP/ITR/v1`

**Note on the state machine (for Gate 1 reviewers):** this spec *defines* the
full request state machine because it owns the aggregate, but it only *drives* the
transitions `DRAFT → SUBMITTED`, `DRAFT → DISCARDED` and `SUBMITTED → WITHDRAWN`. States
from `MANAGER_REVIEW` onward are defined here and transitioned by
`internal-transfer-approval-chain`. Acceptance criteria that reference those states
(AC14) specify *the rule*, and are verified against states set directly in test fixtures.
This is a definition dependency, not a build dependency, so the Gate 1 dependency check
passes.

## Business Rules Applied

| Rule ID | Rule | Source | Type | Enforced by this spec? |
|---|---|---|---|---|
| `internal-transfer-request.BR1` | Employment status must be Active and confirmed; employees on probation may not request a transfer | BRD-001 BR1 | Business | Yes — AC7 |
| `internal-transfer-request.BR2` | Minimum 12 months continuous service in the current position, measured at the requested effective date | BRD-001 BR2 | Business | Yes — AC7 |
| `internal-transfer-request.BR3` | Only one transfer request in a non-terminal state per employee | BRD-001 BR3 | Business | Yes — AC8 |
| `internal-transfer-request.BR4` | No active resignation or exit process | BRD-001 BR4 | Business | Yes — AC7 |
| `internal-transfer-request.BR5` | Target must differ from current in at least one of department, location, position | BRD-001 BR5 | Business | Yes — AC5 |
| `internal-transfer-request.BR6` | Target position must be open and internally fillable | BRD-001 BR6 | Business | Yes — AC6 |
| `internal-transfer-request.BR7` | Requested effective date ≥ today + 14 days and ≤ today + 180 days | BRD-001 BR7 | Business | Yes — AC4 |
| `internal-transfer-request.BR8` | Non-payroll-aligned effective dates are permitted but flagged as likely to move | BRD-001 BR8 | Business | Yes — AC4 (advisory, non-blocking) |
| `internal-transfer-request.BR9` | Open disciplinary or performance cases block a transfer | BRD-001 BR9 | Business | **No — validated manually by HR.** The portal must not imply it has checked (AC7) |

## Request State Machine

```
DRAFT ──submit──▶ SUBMITTED ──▶ MANAGER_REVIEW ──▶ HR_VALIDATION ──▶ FULFILMENT ──▶ COMPLETED
  │                    │              │                  │                │
  │discard             └──withdraw────┴──────────────────┘                │
  ▼                                   │                          (HR cancellation only,
DISCARDED                             ▼                           out of scope for v1)
                                  WITHDRAWN         REJECTED ◀────────────┘
```

Terminal states: `COMPLETED`, `REJECTED`, `WITHDRAWN`, `CANCELLED`, `DISCARDED`.
Non-terminal for the purposes of BR3: `DRAFT`, `SUBMITTED`, `MANAGER_REVIEW`,
`HR_VALIDATION`, `FULFILMENT`.

## Stage Plan

Fixed at submission and never recalculated afterwards, so the employee's view cannot change
underneath them when reference data changes.

| Stage code | Sequence | Assigned role | Applicability rule |
|---|---|---|---|
| `MANAGER_RELEASE` | 1 | Current line manager | Always |
| `MANAGER_ACCEPT` | 2 | Receiving manager | Always |
| `HR_VALIDATION` | 3 | HR Business Partner | Always |
| `ORG_DATA_UPDATE` | 4 | HR Operations | Always |
| `PAYROLL_UPDATE` | 5 | Payroll | Only if target cost centre or grade differs from current |
| `IT_ACCESS` | 6 | IT service desk | Only if target department differs from current |
| `FACILITIES` | 7 | Facilities | Only if target location differs from current |
| `EMPLOYEE_CONFIRMATION` | 8 | Employee | Always |

Non-applicable stages are persisted with `applicable: false` and rendered as *Not required*
— they are shown, not hidden, so the employee can see the journey was considered rather
than wonder whether a step was skipped by mistake.

## API Contract

All endpoints are under `/api/v1/internal-transfers`, behind the gateway's OIDC validation.
The acting employee is derived from the token subject; **no endpoint accepts an employee
identifier from the caller** (AC13).

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
    "departmentId": "string", "departmentName": "string",
    "locationId": "string", "locationName": "string",
    "positionId": "string", "positionTitle": "string",
    "serviceInPositionMonths": 18
  },
  "target": { "departmentId": null, "locationId": null, "positionId": null },
  "requestedEffectiveDate": null,
  "reason": null,
  "advisories": [],
  "createdAt": "2026-09-01T09:14:02Z"
}
```

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 409 | Employee already has a non-terminal request (BR3) | Problem, `type: active-request-exists`, `violations[0].ruleId = ...BR3`, plus `existingRequestId` and `existingReferenceNo` |
| 422 | Payload present but malformed field types or `reason` over 2000 characters | Problem, `type: validation-failed`, `violations[].field` populated |
| 429 | Rate limit exceeded | Problem, `type: rate-limited`, `Retry-After` header |
| 503 | HRIS unavailable and no cached employee assignment — the current-assignment snapshot cannot be resolved | Problem, `type: reference-data-unavailable`, `Retry-After` header |

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
where the date is close to the threshold).

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 400 | `If-Match` header absent | Problem, `type: precondition-required` |
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Request does not exist, **or exists and is not owned by the caller** (deliberate — see AC13) | Problem, `type: request-not-found` |
| 409 | `If-Match` version does not match current version | Problem, `type: version-conflict`, with `currentVersion` |
| 409 | Request is not in `DRAFT` | Problem, `type: invalid-state-transition`, with `currentStatus` |
| 422 | Malformed fields, unknown reference IDs, or `reason` over 2000 characters | Problem, `type: validation-failed`, `violations[].field` populated |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

---

### `internal-transfer-request.API03` — POST `/api/v1/internal-transfers/{requestId}/submit`

**Purpose:** validate and submit the draft. This is the transactional heart of the feature.
**Auth:** owner only.
**Rate limit:** 5 per hour per employee.
**Idempotency:** `Idempotency-Key` header **required**. A replay within 24 hours returns the
original 200 response and creates nothing.

**Request payload:** empty body. All content comes from the persisted draft, so a submit can
never introduce values that were never validated.

**Success response (200):**

```json
{
  "requestId": "uuid",
  "referenceNo": "ITR-2026-000123",
  "status": "SUBMITTED",
  "version": 4,
  "submittedAt": "2026-09-01T09:31:44Z",
  "requestedEffectiveDate": "2026-10-01",
  "effectiveDateStatus": "REQUESTED",
  "stages": [
    { "stageCode": "MANAGER_RELEASE", "sequence": 1, "status": "PENDING",
      "assignedRole": "LINE_MANAGER", "assignedPartyName": "<line manager display name>", "applicable": true },
    { "stageCode": "MANAGER_ACCEPT", "sequence": 2, "status": "NOT_STARTED",
      "assignedRole": "RECEIVING_MANAGER", "assignedPartyName": null, "applicable": true },
    { "stageCode": "PAYROLL_UPDATE", "sequence": 5, "status": "NOT_STARTED",
      "assignedRole": "PAYROLL", "assignedPartyName": null, "applicable": false }
  ],
  "advisories": [
    { "code": "PAYROLL_CYCLE_MISALIGNED", "ruleId": "internal-transfer-request.BR8",
      "message": "Your requested date is mid-cycle and HR may move it to the 1st of the month." },
    { "code": "MANUAL_HR_CHECKS_PENDING", "ruleId": "internal-transfer-request.BR9",
      "message": "HR will carry out further eligibility checks that the portal does not perform." }
  ]
}
```

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 400 | `Idempotency-Key` header absent | Problem, `type: idempotency-key-required` |
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Not found, or not owned by the caller | Problem, `type: request-not-found` |
| 409 | Request is not in `DRAFT` | Problem, `type: invalid-state-transition`, with `currentStatus` |
| 409 | Employee acquired another non-terminal request since the draft was created (BR3) | Problem, `type: active-request-exists` |
| 409 | `Idempotency-Key` reused with a different request body or a different request ID | Problem, `type: idempotency-key-conflict` |
| 422 | Mandatory fields missing (AC3) | Problem, `type: validation-failed`, one `violations` entry per missing field |
| 422 | Effective date outside the permitted window (BR7) | Problem, `type: validation-failed`, `ruleId = ...BR7` |
| 422 | Target identical to current assignment (BR5) | Problem, `type: validation-failed`, `ruleId = ...BR5` |
| 422 | Target position no longer open or internally fillable (BR6) | Problem, `type: validation-failed`, `ruleId = ...BR6` |
| 422 | Eligibility rules failed (BR1, BR2, BR4) | Problem, `type: eligibility-failed`, one `violations` entry per failed rule |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |
| 503 | HRIS unavailable, so eligibility cannot be evaluated | Problem, `type: reference-data-unavailable`, `Retry-After`. **The request stays `DRAFT`, unchanged.** |

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
  "currentAssignment": { "departmentName": "string", "locationName": "string", "positionTitle": "string" },
  "target": { "departmentName": "string", "locationName": "string", "positionTitle": "string" },
  "requestedEffectiveDate": "2026-10-01",
  "confirmedEffectiveDate": null,
  "effectiveDateStatus": "REQUESTED",
  "reason": "string | null",
  "submittedAt": "2026-09-01T09:31:44Z",
  "pendingWith": { "stageCode": "MANAGER_RELEASE", "role": "LINE_MANAGER", "partyName": "<line manager display name>" },
  "stages": [
    { "stageCode": "MANAGER_RELEASE", "sequence": 1, "status": "IN_PROGRESS", "applicable": true,
      "assignedRole": "LINE_MANAGER", "assignedPartyName": "<line manager display name>",
      "startedAt": "2026-09-01T09:31:45Z", "completedAt": null }
  ],
  "history": [
    { "event": "SUBMITTED", "occurredAt": "2026-09-01T09:31:44Z", "actorRole": "EMPLOYEE" }
  ],
  "availableActions": ["WITHDRAW"]
}
```

`assignedPartyName` is populated **only** where the assigned party is the employee's own
line manager (BRD-001 OQ-11). For every other stage it is `null` and the front end shows the
role. `reason` is returned to the owning employee; it is never returned to any other
principal by any endpoint in this spec.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Not found, or not owned by the caller | Problem, `type: request-not-found` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

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
    { "requestId": "uuid", "referenceNo": "ITR-2026-000123", "status": "MANAGER_REVIEW",
      "statusDisplay": "With your manager", "targetPositionTitle": "string",
      "requestedEffectiveDate": "2026-10-01", "createdAt": "2026-09-01T09:14:02Z",
      "pendingWithRole": "LINE_MANAGER" }
  ],
  "page": 1, "size": 10, "totalItems": 3, "totalPages": 1
}
```

`reason` is **not** included in list responses at all.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 400 | `size` outside the permitted set, or unknown `status` value | Problem, `type: validation-failed` |
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

---

### `internal-transfer-request.API06` — POST `/api/v1/internal-transfers/{requestId}/withdraw`

**Purpose:** the employee withdraws their own request before fulfilment begins.
**Auth:** owner only.
**Rate limit:** 10 per hour per employee.
**Idempotency:** repeating a withdraw on an already-`WITHDRAWN` request returns 200 with the
unchanged resource — withdrawing twice is not an error from the employee's point of view.

**Request payload:**

```json
{ "withdrawalReason": "string | null" }
```

`withdrawalReason` is treated as employee narrative and carries the same handling as
`reason` (AC16).

**Success response (200):** the resource as per API04, with `status: "WITHDRAWN"`, all
incomplete stages set to `CANCELLED`, and `availableActions: []`.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Not found, or not owned by the caller | Problem, `type: request-not-found` |
| 409 | Status is `FULFILMENT`, `COMPLETED`, `REJECTED` or `CANCELLED` | Problem, `type: withdrawal-window-closed`, `detail` telling the employee to contact HR, plus `currentStatus` |
| 409 | Status is `DRAFT` | Problem, `type: invalid-state-transition` — a draft is discarded, not withdrawn |
| 422 | `withdrawalReason` over 2000 characters | Problem, `type: validation-failed` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

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
  "departments": [ { "id": "string", "name": "string" } ],
  "locations": [ { "id": "string", "name": "string", "city": "string", "country": "string" } ],
  "positions": [
    { "id": "string", "title": "string", "departmentId": "string", "locationId": "string",
      "grade": "string", "openFrom": "2026-08-01" }
  ],
  "dateWindow": { "earliest": "2026-09-15", "latest": "2027-02-28" },
  "asOf": "2026-09-01T09:10:00Z",
  "stale": false
}
```

`positions` contains only positions that are open and internally fillable (BR6).
`stale: true` means the cache TTL has expired and the HRIS is unreachable, so the data is
being served past its freshness window — the UI must say so rather than present it as current.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |
| 503 | HRIS unavailable **and** the cache is empty | Problem, `type: reference-data-unavailable`, `Retry-After` |

---

## Acceptance Criteria

1. `internal-transfer-request.AC1` — Given an authenticated employee with no transfer
   request in a non-terminal state, when they create a transfer request, then a request is
   persisted with status `DRAFT`, `version` 1, a unique human-readable reference number in
   the form `ITR-<year>-<6-digit sequence>`, and a snapshot of their current department,
   location, position and months of service in that position, and the request is returned
   with HTTP 201.

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
   in position as at the requested effective date) and `BR4` (no active exit process) using
   employment data read at submission time; if any fail, the request remains in `DRAFT` and
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
   and the other receives the same 409.

9. `internal-transfer-request.AC9` — Given a request in `DRAFT` that passes every rule in
   AC3–AC8, when the employee submits it, then in a single database transaction: status
   becomes `SUBMITTED`, `submittedAt` is set, the current-assignment snapshot is frozen, the
   full ordered stage plan is created with each stage's `applicable` flag resolved by the
   applicability rules, an immutable audit record is written, and one
   `employee.transfer.requested` event is written to the outbox — and if any part of that
   fails, none of it is persisted and the request remains in `DRAFT`.

10. `internal-transfer-request.AC10` — Given a submit request carrying an
    `Idempotency-Key` that has already been used successfully by the same employee within
    24 hours for the same request, when it is replayed, then the original response is
    returned unchanged, no second event is written and no second audit record is created;
    and given the same key replayed against a *different* request, then HTTP 409
    `idempotency-key-conflict` is returned; and given a submit with no `Idempotency-Key`
    header, then HTTP 400 is returned and nothing is persisted.

11. `internal-transfer-request.AC11` — Given a submitted request owned by the caller, when
    they retrieve it, then the response contains the current status with a
    plain-language display label, the requested effective date marked `REQUESTED` until a
    confirmed date exists, every stage in sequence with its status and `applicable` flag
    including non-applicable stages, the single `pendingWith` stage where one exists, and
    the transition history — and `assignedPartyName` is populated only for a stage assigned
    to the caller's own line manager, and is `null` for every other stage.

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

14. `internal-transfer-request.AC14` — Given a request whose status is `SUBMITTED`,
    `MANAGER_REVIEW` or `HR_VALIDATION`, when the owning employee withdraws it, then status
    becomes `WITHDRAWN`, every incomplete stage becomes `CANCELLED`, an audit record is
    written and a `employee.transfer.withdrawn` event is queued; and given a request whose
    status is `FULFILMENT`, `COMPLETED`, `REJECTED` or `CANCELLED`, then the withdrawal is
    refused with HTTP 409 `withdrawal-window-closed` whose `detail` directs the employee to
    contact HR; and given a request already `WITHDRAWN`, then HTTP 200 is returned with the
    unchanged resource.

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
    record is written carrying the acting principal's employee ID, their role, the event
    type, the from- and to-status, the UTC timestamp and the correlation ID of the
    originating call, containing no PII, and no code path exists that can update or delete
    an audit record.

19. `internal-transfer-request.AC19` — Given an employee using the transfer wizard and the
    status view with a keyboard only or with a screen reader, when they complete the
    journey, then every control is reachable and operable, every field has a programmatic
    label, every validation error is announced and is associated with its field, and the
    stage timeline exposes each stage's status as text rather than by colour alone,
    meeting WCAG 2.1 AA.

## Unit Test Cases (spec-derived)

| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| `internal-transfer-request.UT01` | AC1 | Employee with no active request creates one | 201; status `DRAFT`, version 1, reference matches `ITR-\d{4}-\d{6}` |
| `internal-transfer-request.UT02` | AC1 | Draft creation snapshots current assignment | Response `currentAssignment` matches HRIS values, `serviceInPositionMonths` computed |
| `internal-transfer-request.UT03` | AC2 | Update draft with matching `If-Match` | 200; fields persisted, version incremented |
| `internal-transfer-request.UT04` | AC2 | Update draft with stale `If-Match` | 409 `version-conflict`; stored record unchanged |
| `internal-transfer-request.UT05` | AC2 | Update draft with no `If-Match` header | 400 `precondition-required` |
| `internal-transfer-request.UT06` | AC3 | Submit with target position missing | 422; one violation naming `targetPositionId`; status still `DRAFT` |
| `internal-transfer-request.UT07` | AC3 | Submit with all four mandatory fields missing | 422; exactly four violations |
| `internal-transfer-request.UT08` | AC4 | Submit with effective date today + 13 days | 422 citing `BR7` |
| `internal-transfer-request.UT09` | AC4 | Submit with effective date today + 14 days | 200 — boundary is inclusive |
| `internal-transfer-request.UT10` | AC4 | Submit with effective date today + 181 days | 422 citing `BR7` |
| `internal-transfer-request.UT11` | AC4 | Submit with in-window, mid-payroll-cycle date | 200 with advisory `PAYROLL_CYCLE_MISALIGNED` citing `BR8` |
| `internal-transfer-request.UT12` | AC5 | Submit where target equals current on all three attributes | 422 citing `BR5` |
| `internal-transfer-request.UT13` | AC5 | Submit where only location differs | 200 — one differing attribute is sufficient |
| `internal-transfer-request.UT14` | AC6 | Position open when drafted, closed at submit | 422 citing `BR6` |
| `internal-transfer-request.UT15` | AC7 | Employee on probation submits | 422 `eligibility-failed` citing `BR1` |
| `internal-transfer-request.UT16` | AC7 | Employee with 11 months in position at effective date | 422 citing `BR2` |
| `internal-transfer-request.UT17` | AC7 | Employee at exactly 12 months at effective date | 200 — boundary is inclusive |
| `internal-transfer-request.UT18` | AC7 | Employee with an active resignation | 422 citing `BR4` |
| `internal-transfer-request.UT19` | AC7 | Employee failing BR1 and BR2 together | 422 with two violations, not one |
| `internal-transfer-request.UT20` | AC7 | Successful submission | Response advisories include `MANUAL_HR_CHECKS_PENDING` citing `BR9` |
| `internal-transfer-request.UT21` | AC8 | Create while a `SUBMITTED` request exists | 409 citing `BR3`, identifying the existing request |
| `internal-transfer-request.UT22` | AC8 | Create while a `WITHDRAWN` request exists | 201 — terminal states do not block |
| `internal-transfer-request.UT23` | AC8 | Two concurrent creates for one employee | Exactly one 201, one 409; one row in the database |
| `internal-transfer-request.UT24` | AC9 | Successful submit | Status `SUBMITTED`, 8 stage rows, audit row, 1 outbox row |
| `internal-transfer-request.UT25` | AC9 | Stage applicability, target in same department and location | `PAYROLL_UPDATE`, `IT_ACCESS`, `FACILITIES` persisted with `applicable: false` |
| `internal-transfer-request.UT26` | AC9 | Outbox write fails during submit | Transaction rolls back; status still `DRAFT`; no stage or audit rows |
| `internal-transfer-request.UT27` | AC10 | Submit replayed with the same `Idempotency-Key` | Identical response; still one outbox row and one audit row |
| `internal-transfer-request.UT28` | AC10 | Same key reused on a different request | 409 `idempotency-key-conflict` |
| `internal-transfer-request.UT29` | AC10 | Submit with no `Idempotency-Key` | 400; nothing persisted |
| `internal-transfer-request.UT30` | AC11 | Retrieve a submitted request | All stages returned in sequence including non-applicable ones; single `pendingWith` |
| `internal-transfer-request.UT31` | AC11 | Stage assigned to the caller's own line manager | `assignedPartyName` populated |
| `internal-transfer-request.UT32` | AC11 | Stage assigned to HR or the receiving manager | `assignedPartyName` is null; role present |
| `internal-transfer-request.UT33` | AC11 | Request with no confirmed date | `effectiveDateStatus` is `REQUESTED`, `confirmedEffectiveDate` null |
| `internal-transfer-request.UT34` | AC12 | List with requests belonging to two employees in the database | Only the caller's are returned |
| `internal-transfer-request.UT35` | AC12 | List response body | No `reason` key present on any item |
| `internal-transfer-request.UT36` | AC13 | GET another employee's request by ID | 404 `request-not-found`; no field of that request in body or logs |
| `internal-transfer-request.UT37` | AC13 | Submit with a spoofed `employeeId` in the body | Identifier ignored; authorisation from token subject |
| `internal-transfer-request.UT38` | AC14 | Withdraw a `SUBMITTED` request | 200 `WITHDRAWN`; incomplete stages `CANCELLED`; audit and outbox rows written |
| `internal-transfer-request.UT39` | AC14 | Withdraw a `FULFILMENT` request | 409 `withdrawal-window-closed` naming HR as the route |
| `internal-transfer-request.UT40` | AC14 | Withdraw an already-`WITHDRAWN` request | 200, resource unchanged, no second audit row |
| `internal-transfer-request.UT41` | AC14 | Withdraw a `DRAFT` request | 409 `invalid-state-transition` |
| `internal-transfer-request.UT42` | AC15 | Reference data with HRIS down, cache warm within TTL | 200, `stale: false` |
| `internal-transfer-request.UT43` | AC15 | Reference data with HRIS down, cache past TTL | 200, `stale: true` |
| `internal-transfer-request.UT44` | AC15 | Reference data with HRIS down, cache empty | 503 with `Retry-After` |
| `internal-transfer-request.UT45` | AC15 | Submit with HRIS down | 503; status still `DRAFT`; no stage, audit or outbox rows |
| `internal-transfer-request.UT46` | AC16 | Submit a request carrying reason text | Emitted event payload contains no reason field |
| `internal-transfer-request.UT47` | AC16 | Log capture across the full submit path | No log line at any level contains the reason text |
| `internal-transfer-request.UT48` | AC16 | Retrieve list and detail as the owner | Reason present in detail, absent from list |
| `internal-transfer-request.UT49` | AC17 | Sixth submit inside one hour | 429 with `Retry-After`; no state change |
| `internal-transfer-request.UT50` | AC17 | Inspect the rate-limit key | Key contains a salted hash, not a raw employee identifier |
| `internal-transfer-request.UT51` | AC18 | Create, update, submit, withdraw in sequence | Four audit rows with correct from/to statuses and the same correlation ID per call |
| `internal-transfer-request.UT52` | AC18 | Attempt to update an audit row | Rejected at the database layer |
| `internal-transfer-request.UT53` | AC19 | Wizard traversed by keyboard only | Every control reachable and operable; focus order matches visual order |
| `internal-transfer-request.UT54` | AC19 | Submit with a validation error, screen reader | Error announced and programmatically associated with its field |
| `internal-transfer-request.UT55` | AC19 | Stage timeline rendered in greyscale | Each stage status remains distinguishable as text |

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
- **Editing a request after submission.** A submitted request is immutable to the employee;
  the only employee action is withdrawal.

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
- Migrations forward-only and compatible with the previously deployed version.

## Revision History

| Version | Date | Change | Driver |
|---|---|---|---|
| v1.0 | 2026-08-27 | Initial draft | BRD-001 |
| v1.1 | 2026-08-28 | AC7 split so each eligibility rule is cited individually and the BR9 advisory is mandatory; AC11 rewritten to resolve who may be named in `pendingWith`; AC13 changed from 403 to 404 with the enumeration rationale stated; AC14 given explicit behaviour for an already-withdrawn request and for a draft; AC16 added covering reason-text handling end to end; API03 exception table extended with `active-request-exists`, `idempotency-key-conflict` and the 503 case; state-machine note added to Context explaining the definition-vs-build dependency | Author revision before Gate 1 submission — findings to be recorded in `.ai-context/reviews/internal-transfer-request.gate1.md` when Abhijit Adhikary completes review |
