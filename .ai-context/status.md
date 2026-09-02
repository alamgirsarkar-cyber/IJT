# Project Status Board — One-Point Employee Portal

_Last updated: 2026-09-02_

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
| `internal-transfer-request` | Employee Internal Transfer Request | **In Peer Review (Gate 1)** | Alamgir Sarkar | 2026-09-02 | Spec v1.1 submitted for Gate 1 review by Abhijit Adhikary. Plan drafted; tasks and prompts prepared but **implementation blocked** until spec Approved and plan reviewed. One open QA query — see Blocked below |
| `internal-transfer-approval-chain` | Manager release, manager accept, HR validation | Not started | — | — | Depends on `internal-transfer-request` reaching Released. Stage plan and state machine already defined by it |
| `internal-transfer-downstream-orchestration` | HRIS, Payroll, IT, Facilities fan-out | Not started | — | — | Consumes `employee.transfer.requested.v1`. Blocked on downstream consumer readiness, not on us |
| `internal-transfer-notifications` | Employee and approver notifications | Not started | — | — | Deliberately excluded from v1 so submission ships without it |

## Released Specs

| Spec ID | Title | Released | Release |
|---|---|---|---|
| — | *None yet* | — | — |

## Blocked / Awaiting Decision

| Spec ID | Blocked on | Owner of the decision | Raised | Expected |
|---|---|---|---|---|
| `internal-transfer-request` | BR2 says "12 months continuous service in current position." The HRIS exposes both `positionStartDate` and `continuousServiceDate`, which differ after a leave of absence. The spec does not say which governs. QA found it expanding AC7 (case UT16c) | HR Policy | 2026-09-01 | 2026-09-02 |

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
