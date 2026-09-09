# Project Status Board — One-Point Employee Portal

_Last updated: 2026-09-07_

> Updated by whoever last touched a spec, same day. Answers "what is in flight" without a
> stand-up. Where a delivery tool exists, this file mirrors **spec-level** state and does not
> compete with it for sprint-level task tracking — the value is that the state lives in the
> repo, next to the artefacts it describes.

## Spec Lifecycle States

`Draft → In Peer Review (Gate 1) → Changes Requested ⟲ → Approved → Plan Drafted →
Plan Reviewed → Tasks Generated → In Development → In QA → Ready for Release →
Released (vX.Y.Z) → [Deprecated / Superseded]`

Hotfix-only states: `Emergency-Merged → Retro-Documented`. Nothing skips a state.

Task states are the checkbox state in the feature's `tasks.md`:
`Not Started / In Progress / In Review / Merged`.

## Active Specs

| Spec ID | Title | Status | Owner | Last Updated | Notes |
|---|---|---|---|---|---|
| `internal-transfer-request` | Employee Internal Transfer Request | **In Peer Review (Gate 1)** | Alamgir Sarkar | 2026-09-09 | Draft v1.1. Review complete by Abhijit Adhikary: **Changes Requested** — 8 Blocker items: PENDING/IN_PROGRESS stage-status contradiction, state-transition contract, submit-timing clarification, event name standardization, requested.v1 schema, OQ-11 cross-spec confirmation, employee-ID/PII classification, concurrent withdraw-vs-approval behaviour. 6 Should-fix items also recorded. Record: `reviews/internal-transfer-request.gate1.md` |
| `internal-transfer-approval-chain` | Manager release, manager accept, HR validation | **Approved** | Alamgir Sarkar | 2026-09-09 | Draft v1.0. Review complete by Abhijit Adhikary: **Approved**. Blockers (OQ-11/OQ-12 dependency, stage-plan contract) resolved; 5 should-fix items carried forward as non-blocking follow-ups. Outstanding risk: approved ahead of `internal-transfer-request` (still Changes Requested). Record: `reviews/internal-transfer-approval-chain.gate1.md` |
| `internal-transfer-downstream-orchestration` | HRIS, Payroll, IT, Facilities fan-out | **In Peer Review (Gate 1)** | Alamgir Sarkar | 2026-09-09 | Draft v1.0. Review complete by Abhijit Adhikary: **Changes Requested** — 5 Blocker (P0) items: failure/compensation/recovery lifecycle, resume-after-FAILED decision, compensation ack/failure semantics, NOT_STARTED-stage handling after failure, operational owner of failed fulfilment. 7 Should-fix (P1) items also recorded. Record: `reviews/internal-transfer-downstream-orchestration.gate1.md` |
| `internal-transfer-notifications` | Employee and approver notifications | **In Peer Review (Gate 1)** | Alamgir Sarkar | 2026-09-09 | Draft v1.0. Review complete by Abhijit Adhikary: **Changes Requested** — 5 Blocker (P0) items: "every state transition" vs. matrix contradiction, event name/versioning standardization, outbox/dedupe boundary, recipient-level idempotency/retry, payload contract. 5 Should-fix (P1) items also recorded. Record: `reviews/internal-transfer-notifications.gate1.md` |

## Released Specs

| Spec ID | Title | Released | Release |
|---|---|---|---|
| — | *None yet* | — | — |

## Blocked / Awaiting Decision

| Spec ID | Blocked on | Owner of the decision | Raised | Expected |
|---|---|---|---|---|
| `internal-transfer-request` | BR2 says "12 months continuous service in current position." The HRIS exposes both `positionStartDate` and `continuousServiceDate`, which differ after a leave of absence. The spec does not say which governs. QA found it expanding AC7 (case UT16c) | HR Policy | 2026-09-01 | 2026-09-02 |
| `internal-transfer-downstream-orchestration` | After a fulfilment stage fails and compensate events are emitted, who records that reversal happened and whether fulfilment can resume? Spec leaves the request in `FULFILMENT` with a `FAILED` stage and does not define a resume API | HR Ops + downstream owners | 2026-09-03 | Before that spec's Gate 1 |

Not a blocker for T01 or T02, so work starts while it is resolved. It **is** a blocker for
T04, and T04 will not start until AC7 says which date governs. QA has not encoded a guess.

## Deferred, Tracked

Items deliberately not built, recorded here so they are not quietly forgotten:

| Item | Source | Owner | Revisit |
|---|---|---|---|
| Approval SLA and escalation | BRD-001 OQ-15 | HR Policy | After v1 usage data |
| Approver delegation | BRD-001 OQ-16 | HR Policy | After v1 usage data |
| Automated disciplinary gating | BRD-001 OQ-04 | HR Policy + Security | If HR exposes an eligibility API |
| Reason-text purge at 24 months | BRD-001 OQ-17 | Data Privacy | **Before the first records reach 24 months** |
| Return-for-edit after rejection | BRD-001 OQ-07 | Product | Post-v1 |
| Localisation beyond English | BRD-001 OQ-18 | Product | Post-v1 |

## Daily Execution Log

### 2026-09-09

- **BRD-001 OQ-11 / OQ-12**: Gate 1 reviewed by Abhijit Adhikary. **Approved with comment**
  — the proposed spec v1.1 answers (AC11, AC16) stand, but must be formally confirmed as
  final or explicitly marked deferred before `internal-transfer-approval-chain` BR5/BR6 are
  treated as closed. See `.ai-context/BRD.md`.
- **`internal-transfer-approval-chain`**: Gate 1 review completed by Abhijit Adhikary.
  Outcome: **Approved**. Both Blockers cleared (OQ-11/OQ-12 dependency, resolved via the
  BRD comment above; stage-plan handoff contract, accepted as-is for Gate 1). Five
  Should-fix items (API02 historical-approver access, confirmed effective-date constraint,
  event payload schemas, API-level test coverage, BRD→Spec→AC→Test traceability) carried
  forward as non-blocking follow-ups for a later revision. Outstanding risk: approved ahead
  of `internal-transfer-request`, which is still In Peer Review (Changes Requested) — track
  at programme level before plan drafting begins. Record:
  `.ai-context/reviews/internal-transfer-approval-chain.gate1.md`.
- **`internal-transfer-downstream-orchestration`**: Gate 1 review completed by Abhijit
  Adhikary. Outcome: **Changes Requested**. Five P0 blockers: the failure / compensation /
  recovery lifecycle is incomplete, resume-after-`FAILED` is undecided, compensation
  acknowledgement/failure semantics are undefined, handling of later `NOT_STARTED` stages
  after a failure is undefined, and no operational owner is named for a failed fulfilment.
  Seven P1 items (sequential-vs-parallel execution, event envelope/schema, duplicate-eventId
  conflict handling, HMAC contract, state-transition matrix, BRD→BR→AC→Test traceability,
  negative/out-of-order tests) strongly recommended but non-blocking. Record:
  `.ai-context/reviews/internal-transfer-downstream-orchestration.gate1.md`.
- **`internal-transfer-notifications`**: Gate 1 review completed by Abhijit Adhikary.
  Outcome: **Changes Requested**. Five P0 blockers: BR1 contradicts the notification
  matrix on "every state transition," domain event names/versioning are inconsistent, the
  transactional/outbox/dedupe boundary is left as a plan-time choice, recipient-level
  idempotency/retry behavior is underspecified, and the portal → notification-service
  payload contract has no formal schema. Five P1 items (OQ-11 read-across confirmation,
  out-of-order event handling, documenting why fulfilment failures don't notify employees,
  negative/failure test cases, BRD→BR→AC→Test traceability) strongly recommended but
  non-blocking. Record: `.ai-context/reviews/internal-transfer-notifications.gate1.md`.
- **`internal-transfer-request`**: Gate 1 review completed by Abhijit Adhikary (supersedes
  the 2026-09-08 entry below — the gate1 review record had not actually been filled in on
  2026-09-08). Outcome: **Changes Requested**. Eight Blocker items: `PENDING` vs.
  `IN_PROGRESS` stage-status contradiction between this spec and `internal-transfer-approval-chain`,
  no authoritative request/stage state-transition contract, unclear whether
  `SUBMITTED → MANAGER_REVIEW` is synchronous with submission, inconsistent domain event
  naming/versioning, no `employee.transfer.requested.v1` schema, OQ-11 not formally
  confirmed across dependent specs, unclear employee-ID/PII classification in audit
  records, and undefined concurrent withdrawal-vs-approval behaviour. Six Should-fix items
  (database-level BR3 invariant, precise service-length calculation — this subsumes the
  2026-09-08 leave-of-absence concern below, draft-vs-frozen assignment data, cached vs.
  authoritative reference data, cross-spec integration tests, BRD→BR→AC→Test traceability)
  carried forward as non-blocking follow-ups. Record:
  `.ai-context/reviews/internal-transfer-request.gate1.md`.

### 2026-09-08

- **`internal-transfer-request`**: _Superseded by the 2026-09-09 entry above — this entry
  predates the reviewer actually completing and recording Gate 1 findings._ Original note:
  Gate 1 review completed by Abhijit Adhikary. Outcome: **Changes Requested**. The blocker
  is the BR2 eligibility rule: the spec does not yet state which HRIS service date governs
  after a leave of absence, so the implementation outcome remains materially ambiguous. The
  reviewer record is in `.ai-context/reviews/internal-transfer-request.gate1.md`.

### 2026-09-07

- **BRD-001 — all four specs submitted to Gate 1** for Abhijit Adhikary:
  `internal-transfer-request` (v1.1), `internal-transfer-approval-chain` (v1.0),
  `internal-transfer-downstream-orchestration` (v1.0), `internal-transfer-notifications`
  (v1.0). Empty review records created under `.ai-context/reviews/`. Suggested review
  order: request → approval-chain → notifications / downstream. Downstream still carries
  an open resume-after-failure question — must be resolved or deferred before Approval.
  No plans or implementation until each spec is Approved.

### 2026-09-03

- **BRD-001 remaining specs drafted** (workflow `/generate-spec`): `internal-transfer-approval-chain`,
  `internal-transfer-downstream-orchestration`, `internal-transfer-notifications` as
  **Draft v1.0**. No plans or code. Gate 1 for the new specs waits on
  `internal-transfer-request` (and, for downstream, on approval-chain plus the resume-after-failure
  question). Downstream fulfilment still starts only after HR approval, not from
  `employee.transfer.requested.v1`.

### 2026-09-02

- **`internal-transfer-request`**: Gate 1 review records reset to empty templates — prior
  content was assessment scaffolding, not a completed review by Abhijit Adhikary. Spec status
  set to **In Peer Review (Gate 1)**; plan to **Plan Drafted**. Implementation remains
  blocked until the concerned reviewer signs off.

### 2026-09-01

- **`internal-transfer-request`**: Tasks T01–T10 generated from the plan's Sequencing section
  and reviewed. Traceability matrix checked in both directions — every AC has a task, every
  task has an AC, no orphans. QA test-case expansion completed and raised one genuine spec
  ambiguity (BR2 measurement date after a leave of absence) rather than guessing at it;
  question is with HR Policy. Security assessment drafted (conditions C1–C3 for Gate 2).
  Task prompts drafted. `architecture.md` updated with the new tables, integrations
  and both ADRs. **Nothing has been implemented. Gate 1 review pending Abhijit Adhikary.**

### 2026-08-31

- **`internal-transfer-request`**: Plan drafted. ADR-0001 and ADR-0002 filed. Plan review
  at Gate 1 **pending** Abhijit Adhikary after spec approval.

### 2026-08-28

- **`internal-transfer-request`**: Spec revised to v1.1 and submitted for Gate 1 peer review.
  Review **pending** Abhijit Adhikary.
- **`constitution.md`**: proposed amendments drafted (free-text employee narrative rule;
  transactional outbox requirement) — **pending** Gate 1 constitution review before treated
  as ratified.

### 2026-08-27

- **BRD-001**: business rules BR1–BR9 confirmed with HR Policy. OQ-06, OQ-07, OQ-08 and OQ-14
  resolved. Spec v1.0 drafted and submitted to Gate 1 at 16:10.
- Noted for the retro: drafting started with OQ-11 and OQ-12 still open. Proposed resolutions
  are in spec v1.1; business owners should confirm at Gate 1.

### 2026-08-26

- **BRD-001**: discovery workshop with HR Ops, Payroll, IT and Facilities. OQ-01, OQ-02,
  OQ-05, OQ-13, OQ-18, OQ-19 resolved. Confirmed that "manager confirms the transfer" in the
  original brief means **two** managers, sequentially — the single largest ambiguity in the
  request, and one that would have produced a materially wrong build if it had gone unasked.

### 2026-08-25

- **BRD-001**: raised from the assessment brief. Journey mapped as-is; 19 open
  questions logged; scope decomposed into four specs so that no single spec spans the whole
  journey.

### 2026-08-24

- **`constitution.md`** ratified at project kickoff. `.agent/` and `.ai-context/` workspace
  established.
