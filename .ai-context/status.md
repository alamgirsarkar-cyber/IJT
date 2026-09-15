# Project Status Board — One-Point Employee Portal

_Last updated: 2026-09-15_

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

| Spec ID                                      | Title                                          | Status                      | Owner          | Last Updated | Notes                                                                                                                                                             |
| -------------------------------------------- | ---------------------------------------------- | --------------------------- | -------------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `internal-transfer-request`                  | Employee Internal Transfer Request             | **Approved** | Alamgir Sarkar | 2026-09-15   | Gate 1 **Approved** 2026-09-15 (v1.5) — Abhijit Adhikari confirmed G1-F15–G1-F24 resolved. Was Changes Requested 2026-09-11 (v1.4). Record: `reviews/internal-transfer-request.gate1.md` |
| `internal-transfer-approval-chain`           | Manager release, manager accept, HR validation | **In Peer Review (Gate 1)** | Alamgir Sarkar | 2026-09-15   | Draft v1.3 — Product locked OQ-11 and OQ-12; v1.3 adds OWN-11 `If-Match` on API03 (request G1-F18). Record: `reviews/internal-transfer-approval-chain.gate1.md` |
| `internal-transfer-downstream-orchestration` | HRIS, Payroll, IT, Facilities fan-out          | **Approved** (v1.3); **v1.4 pending re-review** | Alamgir Sarkar | 2026-09-15   | Gate 1 **Approved** 2026-09-11 (v1.3). v1.4 (2026-09-15) adds OWN-11 CAS on API01 — new Gate 1 pass required before v1.4 is treated as Approved. Record: `reviews/internal-transfer-downstream-orchestration.gate1.md` |
| `internal-transfer-notifications`            | Employee and approver notifications            | **Approved** | Alamgir Sarkar | 2026-09-11   | Gate 1 **Approved** 2026-09-11 (v1.3). Was Changes Requested 2026-09-09 (v1.0); all 5 P0/5 P1 findings addressed in v1.2, OQ-21 locked by Product. Outstanding risk: `internal-transfer-request` not yet Approved. Record: `reviews/internal-transfer-notifications.gate1.md` |

## Released Specs

| Spec ID | Title      | Released | Release |
| ------- | ---------- | -------- | ------- |
| —       | _None yet_ | —        | —       |

## Blocked / Awaiting Decision

| Spec ID | Blocked on | Owner of the decision | Raised | Expected |
| ------- | ---------- | --------------------- | ------ | -------- |
| —       | _None._ BRD-001 OQ-11, OQ-12, OQ-20, OQ-21 and OQ-22 were locked by Product on 2026-09-11. Gate 1 re-review of `internal-transfer-approval-chain` is still outstanding (Abhijit Adhikari) — that is a review queue, not a business blocker. `internal-transfer-request` Gate 1 Approved 2026-09-15 (v1.5) | — | — | — |

## Deferred, Tracked

Items deliberately not built, recorded here so they are not quietly forgotten:

| Item                            | Source        | Owner                | Revisit                                      |
| ------------------------------- | ------------- | -------------------- | -------------------------------------------- |
| Approval SLA and escalation     | BRD-001 OQ-15 | HR Policy            | After v1 usage data                          |
| Approver delegation             | BRD-001 OQ-16 | HR Policy            | After v1 usage data                          |
| Automated disciplinary gating   | BRD-001 OQ-04 | HR Policy + Security | If HR exposes an eligibility API             |
| Reason-text purge at 24 months  | BRD-001 OQ-17 | Data Privacy         | **Before the first records reach 24 months** |
| Return-for-edit after rejection | BRD-001 OQ-07 | Product              | Post-v1                                      |
| Portal resume / retry of a failed fulfilment stage | BRD-001 OQ-20 | Product | Post-v1 — **deferred 2026-09-11**. v1 closeout is off-portal (OWN-08) |
| Parallel fan-out of Payroll / IT / Facilities | Downstream BR2, A4 | Payroll + ITSM + Facilities | When a consumer exists and asks for it — additive, no contract change |
| Employee notification when a fulfilment stage fails | BRD-001 OQ-21 | Product | Post-v1 — **confirmed silent for v1, 2026-09-11** |
| Draft reminders / notifications on draft transitions | Notifications A3 | Product | If Product asks — a new matrix row, not a redesign |
| Draft-discard endpoint producing `DISCARDED` | Request spec _States with no owner_ | Product | **Deferred 2026-09-11.** Employee updates the existing draft |
| Request-level `CANCELLED` transition | Request spec OWN-10; BRD-001 OQ-06 | Product | **Confirmed unreachable in v1, 2026-09-11.** Post-window cancellation stays an HR action outside the portal |
| Localisation beyond English     | BRD-001 OQ-18 | Product              | Post-v1                                      |

## Daily Execution Log

### 2026-09-15

- **`internal-transfer-request`: Gate 1 re-review completed by Abhijit Adhikari against
  v1.5.** Reviewed manually (chat verdict, not the Artifact dashboard). Outcome:
  **Approved.** All ten G1-F15–G1-F24 findings from the 2026-09-11 re-review (5 Blocker,
  5 Nit) confirmed resolved as disposed in the spec's own _Author response — v1.5_ table;
  no new findings raised. Sign-off: `## Gate 1 Review` in
  `.ai-context/specs/internal-transfer-request.spec.md`; worksheet:
  `.ai-context/reviews/internal-transfer-request.gate1.md`. This spec may now proceed to
  Gate 1 plan review. Remaining outstanding in the review order (request → approval-chain
  → notifications / downstream): `internal-transfer-approval-chain`.

- **`internal-transfer-request` revised to v1.5** in response to Gate 1 **Changes
  Requested** (Abhijit Adhikari, 2026-09-11 re-review of v1.4 — 5 Blocker, 5 Nit). All ten
  findings answered in this spec: "at most one" `IN_PROGRESS` with an explicit zero-pending
  `FULFILMENT` rest shape (G1-F15); `COMPLETED` / `EMPLOYEE_CONFIRMATION` aligned to
  downstream BR7 (G1-F16); submit refuses an unresolved current line manager or receiving
  manager rather than inventing an HR override (G1-F17); OWN-11 compare-and-swap mechanics
  for every sibling mutation (G1-F18); failed/compensating `FULFILMENT` employee view
  "HR is completing this" / `pendingWith.role` `HR_OPERATIONS` without changing OQ-21
  silence (G1-F19); API02 full-replace PUT, BR12 last-day-clamp, API01 draft-time wording,
  API03 2 s HRIS timeout ≡ unavailable, `DISCARDED` reserved/unreachable (G1-F20–G1-F24).
  Sign-off still outstanding — v1.5 is resubmitted, not Approved. Disposition:
  spec `## Gate 1 Review` author response; worksheet unchanged
  (`reviews/internal-transfer-request.gate1.md`).

- **Sibling citations for G1-F18.** `internal-transfer-approval-chain` v1.3: API03 requires
  `If-Match` and compare-and-swap. `internal-transfer-downstream-orchestration` v1.4: API01
  uses in-transaction CAS (no `If-Match`); v1.3 Approved line superseded for this increment
  pending a new Gate 1 pass. OWN-10 and OWN-11 updated in `ownership_index.md`.

### 2026-09-11

- **`internal-transfer-request`**: Gate 1 re-review completed by Abhijit Adhikari against
  v1.4. Outcome: **Changes Requested**. All 14 findings from the 2026-09-09 review are
  confirmed resolved. Five new Blocker findings (G1-F15–G1-F19): the `IN_PROGRESS`
  stage-status invariant must be "at most one," not "exactly one," to account for the
  zero-pending state after a fulfilment failure/compensation; `COMPLETED`'s "confirmed by
  the employee" wording contradicts `EMPLOYEE_CONFIRMATION` being portal-set per
  `internal-transfer-downstream-orchestration` BR7; a null `lineManagerRef` leaves
  approval-chain permanently stuck on `assignee-unresolved` with no recovery mechanism;
  BR13/OWN-11's compare-and-swap enforcement is not defined for approval-chain's or
  downstream's own mutating APIs; and failed-fulfilment employee-visible behaviour needs
  its own definition given `pendingWith: null` and OQ-21 silence. Five Nit findings
  (G1-F20–G1-F24, minor cleanup: API02 PUT semantics, BR2/BR12 month-calculation
  algorithm, API01 "snapshot" terminology, API03 HRIS timeout behaviour, `DISCARDED`
  reserved/unreachable labelling) are not blocking on their own. Sign-off: `## Gate 1
  Review` in `.ai-context/specs/internal-transfer-request.spec.md`; worksheet:
  `.ai-context/reviews/internal-transfer-request.gate1.md`.

- **`internal-transfer-notifications`**: Gate 1 re-review completed by Abhijit Adhikari.
  Outcome: **Approved** (v1.3, was Changes Requested on v1.0, 2026-09-09). All five P0 and
  five P1 findings from the original review are addressed in v1.2, and BRD-001 OQ-21
  (employee notification on fulfilment failure) is Resolved by Product's lock this same
  day: silent to the employee for v1. Outstanding risk carried forward:
  `internal-transfer-request` is not yet Approved. Sign-off: `## Gate 1 Review` in
  `.ai-context/specs/internal-transfer-notifications.spec.md`; worksheet:
  `.ai-context/reviews/internal-transfer-notifications.gate1.md`.

- **`internal-transfer-downstream-orchestration`**: Gate 1 re-review completed by Abhijit
  Adhikari. Outcome: **Approved** (v1.3, was Changes Requested on v1.0, 2026-09-09). All
  five Blocker and seven Should-fix findings from the original review are addressed in
  v1.2, and BRD-001 OQ-20 (resume-after-failure) is Resolved by Product's lock this same
  day: off-portal closeout by HR Operations, no automatic or portal-driven resume in v1.
  Outstanding risk carried forward: `internal-transfer-approval-chain` and
  `internal-transfer-request` are not yet both Approved. Sign-off:
  `## Gate 1 Review` in `.ai-context/specs/internal-transfer-downstream-orchestration.spec.md`;
  worksheet: `.ai-context/reviews/internal-transfer-downstream-orchestration.gate1.md`.

- **Product v1 lock of remaining BRD-001 open questions.** Acting as Product owner,
  confirmed or deferred every question Gate 1 had left with an action-required flag:
  **OQ-11** named person only for the employee's own line manager (OWN-12);
  **OQ-12** reason text visible to employee and HR Business Partner only (OWN-05);
  **OQ-20** off-portal closeout by HR Operations, portal resume deferred (OWN-08);
  **OQ-21** no employee notification on fulfilment failure;
  **OQ-22** no leave deduction from service length;
  **OQ-03** closed as BR1–BR9 plus OQ-04 deferral.
  Two scope calls with no OQ number: **no draft-discard endpoint**; **`CANCELLED` stays
  unreachable**. Specs bumped: request v1.4, approval-chain v1.2, downstream v1.3,
  notifications v1.3. Behaviour is the proposed answers those specs already implemented —
  they are now the contract, not a proposal. A later HR Policy or Data Privacy objection
  is a new increment, not a v1 blocker. **Blocked / Awaiting Decision is empty.** Gate 1
  re-review of the four specs remains outstanding.

- **`internal-transfer-downstream-orchestration` revised to v1.2** in response to Gate 1
  **Changes Requested** (Abhijit Adhikari, 2026-09-09 — 5 Blocker, 7 Should-fix). All five
  Blockers answered: a new _Fulfilment Lifecycle and State Transitions_ section (stage
  status vocabulary, the four paths, stage and request transition matrices where every
  unlisted pair is an explicit 409, and the shapes a request can rest in); BR8 (later
  `NOT_STARTED` stages become `CANCELLED`); BR9 (compensation must be acknowledged, with
  three additive stage statuses); BR10 (no automatic and no portal-driven resume in v1);
  OWN-08 (**HR Operations** is the operational owner of a failed fulfilment). All seven
  Should-fix items answered too: BR2 settled as sequential, event envelope with types and
  an evolution rule, `idempotency-key-conflict` on `eventId` reuse, a full webhook
  signature contract (headers, canonical string, ±300 s replay window, key rotation), the
  transition matrices, a two-way traceability matrix, and UT16–UT30 with three
  contract-double integration rows. Finding-by-finding disposition is in the spec's
  `## Gate 1 Review` section; the reviewer's worksheet now carries G1-F01–G1-F12 as stable
  IDs transcribed from his closing note.

- **BRD-001 OQ-20 raised** for the one thing a spec must not decide for itself: whether an
  off-portal closeout by HR Operations is acceptable for v1, or HR needs a portal resume
  capability. Recorded with a proposed answer and an explicit action-required flag, the same
  pattern as OQ-11 and OQ-12. **Gate 1 Approval for downstream waits on HR Ops.**

- **`internal-transfer-notifications` revised to v1.2** in response to Gate 1 **Changes
  Requested** (Abhijit Adhikari, 2026-09-09 — 5 P0, 5 P1). All five P0s answered: a
  _Transition coverage_ inventory that accounts for every event the four specs emit as
  notified or deliberately silent with a reason, which is what finally squares BR1 with the
  BRD's "on every state transition"; OWN-09 event naming with the dual spellings removed;
  the dispatch boundary **decided** rather than left to the plan (handler after the domain
  commit, its own transaction, relay-only egress); three keyed idempotency layers with a
  database unique constraint and bounded retry ending in `UNDELIVERABLE` plus an alert; and
  a formal portal → notification-service payload schema with a response-handling table. All
  five P1s answered too: OQ-11 confirmed as *not* a dependency of this spec (it governs
  disclosure, while recipients come from OWN-04), out-of-order behaviour defined with a
  staleness guard on action-required mail, the fulfilment-failure silence reasoned and
  asserted by test, UT11–UT25 covering failure and negative paths plus two contract-double
  integration rows, and a two-way traceability matrix.

- **Two defects found while answering, both recorded rather than patched over.** v1.1's
  dedupe key would have **suppressed a legitimate notification** where one person is both
  the releasing and receiving manager — fixed by keying on the domain `eventId` with
  `eventType` and `stageCode` in the secondary key (AC6, UT11). And `CANCELLED` sits in the
  request state machine while **no spec transitions a request into it**, so v1 has no
  cancellation path at all; noted in _Transition coverage_ for a reviewer to rule on rather
  than given an invented matrix row.

- **BRD-001 OQ-21 raised** for whether the employee is told when fulfilment fails —
  employee-communication policy belongs to Product. Proposed answer recorded with an
  action-required flag. P1, so it need not block Approval, but it should be answered before
  the spec is built.

- **Gate 1 verdicts written back onto the specs.** `governance.md` requires the dated
  `## Gate 1 Review` block to live on the spec, not only in the findings worksheet;
  downstream, notifications and `internal-transfer-request` now have one.
  `internal-transfer-approval-chain` still does not — its recorded verdict sits in
  `reviews/*.gate1.md` only, which is the remaining governance gap.

- **`internal-transfer-request` revised to v1.3** in response to Gate 1 **Changes
  Requested** (Abhijit Adhikari, 2026-09-09 — 8 Blocker, 6 Should-fix). All eight Blockers
  answered except G1-F06, which cannot be closed here: one stage-status vocabulary
  (`IN_PROGRESS`, never `PENDING`); an authoritative state and transition contract
  registered as OWN-10, including the fulfilment-failure rows that leave the request in
  `FULFILMENT`; submission decided **synchronous**, which demotes `SUBMITTED` from a status
  to a history event type; OWN-09 event names plus typed schemas for `requested.v1` and
  `withdrawn.v1`; employee ID in audit settled from the constitution (raw ID permitted,
  not PII); withdraw given `If-Match` and a race table that distinguishes `version-conflict`
  from `withdrawal-window-closed` (OWN-11). All six Should-fix items answered too: a
  partial unique index for BR3, service-length arithmetic in BR12 with the leave-of-absence
  policy escalated as OQ-22, draft assignment marked informational, cached reference data
  barred from validation decisions, two cross-spec integration tests, and a two-way
  traceability matrix. Employee-facing labels for the four compensation stage statuses
  (downstream's A6 follow-up) now live here, including the previously missing
  `COMPENSATION_REQUESTED`. Finding-by-finding disposition is in the spec's `## Gate 1
  Review` section.

- **Two states with no owner, recorded rather than invented.** Building the G1-F02
  contract showed `DISCARDED` is audited but has no endpoint, and `CANCELLED` is defined
  but no spec transitions a request into it. Both are flagged for a scope call.

- **BRD-001 OQ-11 re-marked open and Approval-blocking** for this spec and
  approval-chain — v1.1 had treated it as settled independently, which is the failure mode
  a shared open question creates. **OQ-22 raised** for whether unpaid leave breaks BR2
  continuity. The 2026-09-01 BR2 date-field blocker is superseded by OQ-22; the OWN-09
  rename that blocked notifications is closed.

- **Cross-spec follow-ups closed from this side.** Status-view display labels for
  `FAILED` / `COMPENSATION_*` are now in this spec's vocabulary (UT76). Event names are
  OWN-09 compliant, so the notifications handler can match `requested.v1` and
  `withdrawn.v1`. Approval-chain still needs its own Gate 1 write-back and still depends
  on OQ-11.

### 2026-09-08

- **Governance artefact system added.** Canonical file
  `.agent/rules/governance.md`. Session procedure in `.agent/rules/agent-role.md`. Six
  thin tripwires (`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/gate-review.mdc`,
  `.windsurf/rules/gate-review.md`, `.github/copilot-instructions.md`). Dashboard workflow
  and HTML design under `.agent/workflows/`. Shared facts in
  `.ai-context/ownership_index.md`. Gate 2 write-back log
  `.ai-context/state/completed.md`. Gate 1 still pending Abhijit Adhikari.

- **AuthN/AuthZ written into BRD-001 first** (KD-07, KD-08, BR10–BR14, actor matrix), then
  architecture _Authentication and Authorisation_, then spec bumps: request v1.2 (AC20,
  AC21), approval-chain v1.1 (AC13, AC14), downstream v1.1 (AC11), notifications v1.1.
  Login/IdP remain out of scope — existing portal SSO is reused. Gate 1 still pending
  Abhijit Adhikari; these are author revisions on the submitted drafts.

### 2026-09-07

- **BRD-001 — all four specs submitted to Gate 1** for Abhijit Adhikari:
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
  content was assessment scaffolding, not a completed review by Abhijit Adhikari. Spec status
  set to **In Peer Review (Gate 1)**; plan to **Plan Drafted**. Implementation remains
  blocked until the concerned reviewer signs off.

### 2026-09-01

- **`internal-transfer-request`**: Tasks T01–T10 generated from the plan's Sequencing section
  and reviewed. Traceability matrix checked in both directions — every AC has a task, every
  task has an AC, no orphans. QA test-case expansion completed and raised one genuine spec
  ambiguity (BR2 measurement date after a leave of absence) rather than guessing at it;
  question is with HR Policy. Security assessment drafted (conditions C1–C3 for Gate 2).
  Task prompts drafted. `architecture.md` updated with the new tables, integrations
  and both ADRs. **Nothing has been implemented. Gate 1 review pending Abhijit Adhikari.**

### 2026-08-31

- **`internal-transfer-request`**: Plan drafted. ADR-0001 and ADR-0002 filed. Plan review
  at Gate 1 **pending** Abhijit Adhikari after spec approval.

### 2026-08-28

- **`internal-transfer-request`**: Spec revised to v1.1 and submitted for Gate 1 peer review.
  Review **pending** Abhijit Adhikari.
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
