# Spec: Internal Transfer Approval Chain

## Spec ID

`internal-transfer-approval-chain`

## Status

**Draft v1.0** — not submitted to Gate 1. Full state machine in `.ai-context/status.md`.
Do not generate a plan or code from this file until it is **Approved**.

Gate 1 cannot pass the dependency check until
`.ai-context/specs/internal-transfer-request.spec.md` is **Approved**. This spec consumes
the request aggregate and stage plan that spec *defines*; it does not redefine them.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role | Name | Date |
|---|---|---|
| Author / owner | Alamgir Sarkar | 2026-09-03 |
| Gate 1 reviewer (never the author) | | |
| Gate 2 reviewer | | |

## Intent

An authenticated current line manager, receiving manager or HR Business Partner can record
an approve or reject decision on the transfer-request stage that is currently waiting on
them, in that order: line-manager release, then receiving-manager accept, then HR
validation. A rejection at any of those three stages makes the request terminal
(`REJECTED`). An HR approval records the confirmed effective date and moves the request to
`FULFILMENT`. This spec transitions the stages the request spec created; it does not create
requests, evaluate portal eligibility rules BR1–BR8, start Payroll/IT/Facilities work, or
send notifications.

## Context

- Builds on: `.ai-context/architecture.md` — *Components*, *Cross-Cutting Concerns*;
  `.ai-context/constitution.md` — Security Posture, Architectural Constraints,
  Non-Functional Baselines
- Related: `.ai-context/specs/internal-transfer-request.spec.md` — **In Peer Review
  (Draft v1.1), not Approved**. State machine, stage codes, `assigned_party_ref`,
  withdrawal window (AC14) and reason-text rule (AC16 / BRD-001 OQ-12) are defined there
  and reused here. Runtime build of this feature waits on that spec being Approved and
  its aggregate existing.
- Related: `internal-transfer-downstream-orchestration` — **Draft** (this session). Starts
  when this spec sets status `FULFILMENT`. Not a build dependency for *this* spec.
- Related: `internal-transfer-notifications` — **Draft** (this session). Consumes
  transitions this spec records.
- API contract consumed: none beyond the request aggregate. HRIS is not called on a
  decision path (assignees were snapshotted at submit).
- Design: portal design system; manager inbox / decision and HR inbox / validation
  screens. No Figma ID is recorded in the BRD.

**Note on the request status `MANAGER_REVIEW`:** the request spec uses one request-level
status for both manager stages. This spec keeps that status until `MANAGER_ACCEPT` is
completed, then sets `HR_VALIDATION`. Stage codes `MANAGER_RELEASE` and `MANAGER_ACCEPT`
are the units of work.

## Business Rules

| Rule ID | Rule | Source | Business or technical decision |
|---|---|---|---|
| `internal-transfer-approval-chain.BR1` | Current line manager decides first (release); receiving manager second (accept); HR Business Partner third (validation). A later stage cannot be decided while an earlier applicable approval stage is incomplete. | BRD-001 OQ-01, OQ-02 | Business |
| `internal-transfer-approval-chain.BR2` | Rejection at `MANAGER_RELEASE`, `MANAGER_ACCEPT` or `HR_VALIDATION` is terminal. The employee raises a new request; this spec does not return the request for edit. | BRD-001 OQ-07 | Business |
| `internal-transfer-approval-chain.BR3` | HR sets the confirmed effective date when approving `HR_VALIDATION`. Until then the date remains requested. | BRD-001 OQ-05 | Business |
| `internal-transfer-approval-chain.BR4` | Open disciplinary or performance cases are validated **by HR as a person**, not by the portal. Completing `HR_VALIDATION` with `APPROVE` records that HR has finished those checks. The portal must not call a disciplinary API and must not present manager approval as eligibility clearance. | BRD-001 BR9, OQ-04 | Business |
| `internal-transfer-approval-chain.BR5` | Transfer reason text is visible to the HR Business Partner and the owning employee only. It is not returned to either manager. | BRD-001 OQ-12 (proposed in the request spec) | Business |
| `internal-transfer-approval-chain.BR6` | Line-manager and receiving-manager decisions are authorised only when the token subject equals that stage's `assigned_party_ref`. HR validation is authorised for any principal whose token has role `HR_BUSINESS_PARTNER`. | BRD-001 OQ-11 (role vs named person); assignee snapshot from the request spec | Technical (enforcement of a business assignment) |
| `internal-transfer-approval-chain.BR7` | Approver delegation is not supported. An assigned manager who is absent is handled outside the portal. | BRD-001 OQ-16 | Business — deferred; this spec must not implement a substitute |
| `internal-transfer-approval-chain.BR8` | No SLA timer, reminder or escalation is evaluated. | BRD-001 OQ-15 | Business — deferred |

## API Contract

All endpoints are under `/api/v1/internal-transfers`, behind the gateway's OIDC
validation. Identity is the token subject. **No endpoint accepts an employee identifier
from the caller for authorisation.** Error bodies are RFC 7807 `application/problem+json`
as defined in `internal-transfer-request.spec.md` (same `type` / `violations` shape).

Stage codes this spec will accept on a decision: `MANAGER_RELEASE`, `MANAGER_ACCEPT`,
`HR_VALIDATION` only.

---

### `internal-transfer-approval-chain.API01` — GET `/api/v1/internal-transfers/approvals`

**Purpose:** inbox of stages waiting on the caller.
**Auth:** authenticated principal. Returns only stages the caller is allowed to decide
(BR6).
**Rate limit:** 300 per hour per principal.
**Idempotency:** not applicable (read).

**Query:** `?page=<n>&size=<10|25|50>` — default page 1, size 10, sorted by stage
`startedAt` ascending (oldest waiting first).

**Success response (200):**

```json
{
  "items": [
    {
      "requestId": "uuid",
      "referenceNo": "ITR-2026-000123",
      "stageCode": "MANAGER_RELEASE",
      "assignedRole": "LINE_MANAGER",
      "requestStatus": "MANAGER_REVIEW",
      "targetPositionTitle": "string",
      "requestedEffectiveDate": "YYYY-MM-DD",
      "waitingSince": "2026-09-01T09:31:45Z"
    }
  ],
  "page": 1, "size": 10, "totalItems": 1, "totalPages": 1
}
```

`reason` is **not** included.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 400 | `size` outside the permitted set | Problem, `type: validation-failed` |
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

---

### `internal-transfer-approval-chain.API02` — GET `/api/v1/internal-transfers/{requestId}/approval`

**Purpose:** decision view for one request: current and target assignment snapshot, stage
plan, which stage is waiting, and — for HR only — the reason text.
**Auth:** caller must satisfy BR6 for at least one approval stage on the request (current
or already completed by them), **or** hold role `HR_BUSINESS_PARTNER`. Anyone else
receives 404, not 403 (same enumeration rule as request-spec AC13).
**Rate limit:** 300 per hour per principal.
**Idempotency:** not applicable (read).

**Success response (200):**

```json
{
  "requestId": "uuid",
  "referenceNo": "ITR-2026-000123",
  "status": "MANAGER_REVIEW",
  "currentAssignment": {
    "departmentName": "string", "locationName": "string", "positionTitle": "string"
  },
  "target": {
    "departmentName": "string", "locationName": "string", "positionTitle": "string"
  },
  "requestedEffectiveDate": "YYYY-MM-DD",
  "confirmedEffectiveDate": null,
  "effectiveDateStatus": "REQUESTED",
  "reason": "string | null",
  "pendingStage": { "stageCode": "MANAGER_RELEASE", "assignedRole": "LINE_MANAGER" },
  "stages": [
    {
      "stageCode": "MANAGER_RELEASE", "sequence": 1, "status": "IN_PROGRESS",
      "applicable": true, "assignedRole": "LINE_MANAGER"
    }
  ],
  "availableDecisions": ["APPROVE", "REJECT"]
}
```

`reason` is present **only** when the caller has role `HR_BUSINESS_PARTNER`. For a
manager it is omitted from the JSON (the key is absent). `assignedPartyName` is not
returned on this endpoint.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Request does not exist, **or** exists and the caller is not allowed to see it | Problem, `type: request-not-found` |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

---

### `internal-transfer-approval-chain.API03` — POST `/api/v1/internal-transfers/{requestId}/stages/{stageCode}/decision`

**Purpose:** record `APPROVE` or `REJECT` on one approval stage.
**Auth:** BR6 for that `stageCode`.
**Rate limit:** 30 per hour per principal.
**Idempotency:** `Idempotency-Key` header **required**. Replay within 24 hours of a
successful decision on the same request, stage and key returns the original 200 and
writes nothing.

**Request payload:**

```json
{
  "decision": "APPROVE | REJECT",
  "confirmedEffectiveDate": "YYYY-MM-DD | null"
}
```

`confirmedEffectiveDate` is **required** when `stageCode` is `HR_VALIDATION` and
`decision` is `APPROVE`. It must be **absent or null** for manager stages and for every
`REJECT`. This spec does not apply BR7 to the confirmed date.

**Success response (200):** the same shape as API02 after the transition, with
`availableDecisions` empty when the caller has no further decision on this request.

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 400 | `Idempotency-Key` absent | Problem, `type: idempotency-key-required` |
| 401 | No or invalid token | Problem, `type: unauthenticated` |
| 404 | Request does not exist, **or** caller is not the assignee / HR for this stage | Problem, `type: request-not-found` |
| 409 | Request is `WITHDRAWN`, `REJECTED`, `FULFILMENT`, `COMPLETED`, `CANCELLED` or `DRAFT` / `DISCARDED` | Problem, `type: invalid-state-transition`, with `currentStatus` |
| 409 | `stageCode` is not the current waiting approval stage (out of order, already decided, or `NOT_STARTED`) | Problem, `type: invalid-state-transition`, with `currentStageCode` |
| 409 | Stage `assigned_party_ref` is null on a manager stage (assignee never snapshotted) | Problem, `type: assignee-unresolved` |
| 409 | Employee withdrawal committed in the same moment (lost the aggregate lock) | Problem, `type: invalid-state-transition`, with `currentStatus` |
| 409 | `Idempotency-Key` reused against a different request, stage or body | Problem, `type: idempotency-key-conflict` |
| 422 | `decision` missing or not `APPROVE`/`REJECT`; `stageCode` not one of the three approval codes; HR approve without `confirmedEffectiveDate`; confirmed date supplied on a manager decision or on reject; malformed date | Problem, `type: validation-failed`, `violations[].field` populated |
| 429 | Rate limit exceeded | Problem, `type: rate-limited` |

## Acceptance Criteria

1. `internal-transfer-approval-chain.AC1` — Given a request in `MANAGER_REVIEW` whose
   `MANAGER_RELEASE` stage is `IN_PROGRESS` and whose `assigned_party_ref` equals the
   caller, when that caller submits `APPROVE` on `MANAGER_RELEASE`, then that stage becomes
   `COMPLETED`, `MANAGER_ACCEPT` becomes `IN_PROGRESS`, request status remains
   `MANAGER_REVIEW`, an audit record is written, and an outbox row
   `employee.transfer.stage-pending.v1` is written for `MANAGER_ACCEPT` in the same
   transaction — or none of that is persisted.

2. `internal-transfer-approval-chain.AC2` — Given AC1 has succeeded and
   `MANAGER_ACCEPT.assigned_party_ref` equals the caller, when that caller submits
   `APPROVE` on `MANAGER_ACCEPT`, then that stage becomes `COMPLETED`, `HR_VALIDATION`
   becomes `IN_PROGRESS`, request status becomes `HR_VALIDATION`, an audit record is
   written, and an outbox row `employee.transfer.stage-pending.v1` is written for
   `HR_VALIDATION` in the same transaction.

3. `internal-transfer-approval-chain.AC3` — Given a request in `HR_VALIDATION` whose
   `HR_VALIDATION` stage is `IN_PROGRESS` and the caller has role `HR_BUSINESS_PARTNER`,
   when they submit `APPROVE` with a `confirmedEffectiveDate`, then that stage becomes
   `COMPLETED`, `confirmedEffectiveDate` is stored, `effectiveDateStatus` is `CONFIRMED`,
   request status becomes `FULFILMENT`, `ORG_DATA_UPDATE` becomes `IN_PROGRESS` if it is
   `applicable` (it always is), an audit record is written, and an outbox row
   `employee.transfer.approved.v1` is written in the same transaction. The payload contains
   no reason text, no names and no contact details.

4. `internal-transfer-approval-chain.AC4` — Given a request waiting on `MANAGER_RELEASE`,
   `MANAGER_ACCEPT` or `HR_VALIDATION`, when the authorised caller submits `REJECT`, then
   request status becomes `REJECTED`, the decided stage becomes `COMPLETED` with outcome
   reject recorded on the audit row, every other incomplete stage becomes `CANCELLED`,
   `confirmedEffectiveDate` remains null, and an outbox row
   `employee.transfer.rejected.v1` is written in the same transaction (no reason text).

5. `internal-transfer-approval-chain.AC5` — Given `MANAGER_RELEASE` is not `COMPLETED`,
   when any caller submits a decision on `MANAGER_ACCEPT` or `HR_VALIDATION`, then HTTP 409
   `invalid-state-transition` is returned and no stage or request status changes.

6. `internal-transfer-approval-chain.AC6` — Given a caller whose token subject is not the
   stage `assigned_party_ref` (manager stages) and who does not have role
   `HR_BUSINESS_PARTNER` (HR stage), when they GET the approval view or POST a decision,
   then HTTP 404 `request-not-found` is returned, no field of the request appears in the
   body or in any log line, and a caller-supplied employee id in body, query or path is
   ignored for authorisation.

7. `internal-transfer-approval-chain.AC7` — Given a manager caller on API02, when the
   response is 200, then the JSON has no `reason` key; given an `HR_BUSINESS_PARTNER`
   caller on the same request, then `reason` is present (null if the employee left it
   empty). List (API01) never contains `reason` for any caller.

8. `internal-transfer-approval-chain.AC8` — Given a decision POST with an
   `Idempotency-Key` already used successfully by the same principal for the same request
   and stage within 24 hours, when it is replayed, then the original 200 is returned and no
   second audit or outbox row is written; given the same key on a different request, stage
   or body, then HTTP 409 `idempotency-key-conflict`; given no key, then HTTP 400 and
   nothing is persisted.

9. `internal-transfer-approval-chain.AC9` — Given a request that is `WITHDRAWN` (employee
   withdrawal per request-spec AC14) or already `REJECTED`, when a decision is posted, then
   HTTP 409 `invalid-state-transition` is returned. Given a decision and a withdrawal in
   flight together, then exactly one wins; the loser receives 409; the database contains
   one terminal status, not both.

10. `internal-transfer-approval-chain.AC10` — Given a manager stage whose
    `assigned_party_ref` is null, when a decision is posted, then HTTP 409
    `assignee-unresolved` is returned and the stage stays `IN_PROGRESS`. Delegation
    resolution is not attempted (BR7).

11. `internal-transfer-approval-chain.AC11` — Given any successful approve, reject or
    idempotent replay, when logs and event payloads are inspected, then they contain no
    reason text, no legal name, no contact details and no other constitution PII; audit
    rows carry actor employee ID, role, event type, from/to request status, UTC timestamp
    and correlation ID only, and cannot be updated or deleted.

12. `internal-transfer-approval-chain.AC12` — Given the manager inbox, decision screen, HR
    inbox and HR validation screen, when they are used with keyboard only or a screen
    reader, then every control is reachable and operable, every field has a programmatic
    label, every error is announced and associated with its field, and stage status is
    exposed as text, meeting WCAG 2.1 AA.

## Unit Test Cases (spec-derived)

| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| `internal-transfer-approval-chain.UT01` | AC1 | Line manager approves `MANAGER_RELEASE` | 200; that stage `COMPLETED`; `MANAGER_ACCEPT` `IN_PROGRESS`; status still `MANAGER_REVIEW`; one audit; one `stage-pending` outbox row |
| `internal-transfer-approval-chain.UT02` | AC1 | Outbox insert fails during AC1 | Transaction rolls back; `MANAGER_RELEASE` still `IN_PROGRESS` |
| `internal-transfer-approval-chain.UT03` | AC2 | Receiving manager approves `MANAGER_ACCEPT` | 200; status `HR_VALIDATION`; `HR_VALIDATION` `IN_PROGRESS` |
| `internal-transfer-approval-chain.UT04` | AC3 | HR approves with confirmed date | 200; status `FULFILMENT`; `confirmedEffectiveDate` stored; `effectiveDateStatus` `CONFIRMED`; `approved.v1` outbox row with no reason field |
| `internal-transfer-approval-chain.UT05` | AC3 | HR approves without `confirmedEffectiveDate` | 422; status still `HR_VALIDATION` |
| `internal-transfer-approval-chain.UT06` | AC3 | Successful HR approve payload | Event has requestId, referenceNo, employeeId, confirmedEffectiveDate, applicable stage codes — no names, no reason |
| `internal-transfer-approval-chain.UT07` | AC4 | Line manager rejects | 200; status `REJECTED`; incomplete stages `CANCELLED`; `rejected.v1` outbox row |
| `internal-transfer-approval-chain.UT08` | AC4 | Receiving manager rejects | Same terminal outcome as UT07 |
| `internal-transfer-approval-chain.UT09` | AC4 | HR rejects | Same terminal outcome as UT07; `confirmedEffectiveDate` null |
| `internal-transfer-approval-chain.UT10` | AC5 | Receiving manager decides before release | 409; no status change |
| `internal-transfer-approval-chain.UT11` | AC5 | HR decides before both managers | 409; no status change |
| `internal-transfer-approval-chain.UT12` | AC6 | Employee owner POSTs a manager decision | 404; no log field from the request |
| `internal-transfer-approval-chain.UT13` | AC6 | Wrong manager POSTs `MANAGER_RELEASE` | 404 |
| `internal-transfer-approval-chain.UT14` | AC6 | Body contains `employeeId` of the assignee | Authorisation still from token subject |
| `internal-transfer-approval-chain.UT15` | AC7 | Manager GET approval | No `reason` key |
| `internal-transfer-approval-chain.UT16` | AC7 | HR GET approval | `reason` key present |
| `internal-transfer-approval-chain.UT17` | AC7 | Inbox item for HR | No `reason` key |
| `internal-transfer-approval-chain.UT18` | AC8 | Replay same Idempotency-Key | Identical 200; still one audit and one outbox row |
| `internal-transfer-approval-chain.UT19` | AC8 | Same key, different stage | 409 `idempotency-key-conflict` |
| `internal-transfer-approval-chain.UT20` | AC8 | Decision with no Idempotency-Key | 400; nothing persisted |
| `internal-transfer-approval-chain.UT21` | AC9 | Decision on `WITHDRAWN` request | 409 `invalid-state-transition` |
| `internal-transfer-approval-chain.UT22` | AC9 | Concurrent withdraw and approve | One terminal status in the database; the other call 409 |
| `internal-transfer-approval-chain.UT23` | AC10 | `assigned_party_ref` null on `MANAGER_RELEASE` | 409 `assignee-unresolved` |
| `internal-transfer-approval-chain.UT24` | AC11 | Log capture of HR approve including reason on the request | No log line contains the reason text |
| `internal-transfer-approval-chain.UT25` | AC11 | Attempt to update an audit row | Rejected at the database layer |
| `internal-transfer-approval-chain.UT26` | AC12 | Decision screen by keyboard only | Every control reachable; focus order matches visual order |
| `internal-transfer-approval-chain.UT27` | AC12 | 422 announced to screen reader | Error associated with its field |

## Surfaces

| Layer | Name | Bound to |
|---|---|---|
| Backend | Approvals inbox | API01 |
| Backend | Approval detail | API02 |
| Backend | Stage decision | API03 |
| Frontend | Manager approvals list | API01 |
| Frontend | Manager decision | API02, API03 |
| Frontend | HR validations list | API01 |
| Frontend | HR validation | API02, API03 |

Layout and component structure are not specified here.

## Explicitly Out of Scope

- Creating, editing, submitting or withdrawing the request — `internal-transfer-request`.
- Portal evaluation of BR1–BR8 — already done at submit. This spec must not re-run them
  and must not hide BR9 behind a portal check (BR4).
- Downstream HRIS / Payroll / IT / Facilities execution — `internal-transfer-downstream-orchestration`.
  This spec only moves the request to `FULFILMENT` and emits `approved.v1`.
- Notifications — `internal-transfer-notifications`.
- Return-for-edit after rejection (BRD-001 OQ-07).
- Approver delegation (OQ-16) and SLA escalation (OQ-15).
- HR cancellation after `FULFILMENT` has begun.
- Free-text approver comments — not in BRD-001; not on the API.
- Manager- or HR-initiated transfers.
- Employee-facing wizard and status page — request spec.

## Open Questions

| # | Question | Owner | Needed by | Resolution |
|---|---|---|---|---|
| 1 | None that change approve/reject sequencing, terminal rejection, or who sets the confirmed date. | — | — | Closed in BRD-001 OQ-01, OQ-02, OQ-05, OQ-07 |

BR6's "any `HR_BUSINESS_PARTNER` may complete `HR_VALIDATION`" is recorded as Assumption
A3, not as an unanswered business question: OQ-11 already says HR is shown as a role, not
a named person. If HR Policy later assigns a named BP per request, BR6 must change before
Approved.

## Assumptions

- A1 — `internal-transfer-request` has created the eight-row stage plan and snapshotted
  manager `assigned_party_ref` values at submit. If those refs are missing, AC10 applies;
  this spec does not look up managers live. If false: assignee resolution must be added
  here and Gate 1 reopened.
- A2 — Token roles include `HR_BUSINESS_PARTNER` from the IdP. If false: HR auth cannot
  be implemented as specified.
- A3 — Any principal with that role may complete any `HR_VALIDATION` that is
  `IN_PROGRESS`. If false: BR6 and API03 auth change.
- A4 — Confirmed effective date has no portal-enforced 14/180-day window (BR7 is the
  employee's requested date only). If false: AC3 must gain a validation row.
- A5 — The employee withdrawal endpoint remains owned by the request spec; this spec only
  loses the race (AC9). If false: withdrawal must be duplicated here.

## Non-Functional Constraints (from constitution.md)

- p95 < 400 ms for API01 and API02; p95 < 700 ms for API03 — measured at the gateway.
- 99.9% availability for these endpoints. This spec makes no synchronous call to Payroll,
  ITSM, Facilities or the HRIS on the decision path.
- WCAG 2.1 AA for every screen in Surfaces (AC12).
- No PII in logs at any level; reason text is employee narrative (AC7, AC11).
- Every endpoint carries an explicit rate-limit decision (API Contract).
- Events published through the transactional outbox only (AC1–AC4).
- Audit records immutable, 7-year retention (AC11).
- Public surface under `/api/v1/`; RFC 7807 errors.

## Revision History

| Version | Date | Change | Driver |
|---|---|---|---|
| v1.0 | 2026-09-03 | Initial draft | BRD-001 |
