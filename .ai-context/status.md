# Project Status Board — One-Point Employee Portal

_Last updated: 2026-09-01_

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
| `internal-transfer-request` | Employee Internal Transfer Request | **Tasks Generated** | Alamgir Sarkar | 2026-09-01 | Spec v1.1 approved at Gate 1 on 2026-08-28 after 5 Blockers; plan approved 2026-08-31 after 3 Blockers; T01–T10 generated and reviewed. Ready to start T01. One open QA query — see Blocked below |
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

### 2026-09-01

- **`internal-transfer-request`**: Tasks T01–T10 generated from the plan's Sequencing section
  and reviewed. Traceability matrix checked in both directions — every AC has a task, every
  task has an AC, no orphans. QA test-case expansion completed and raised one genuine spec
  ambiguity (BR2 measurement date after a leave of absence) rather than guessing at it;
  question is with HR Policy. Security assessment approved with three conditions carried to
  Gate 2. Task prompts drafted. `architecture.md` updated with the new tables, integrations
  and both ADRs. **Nothing has been implemented.**

### 2026-08-31

- **`internal-transfer-request`**: Plan submitted at 10:15, **Changes Requested** at midday —
  3 Blockers. Two were guarantees stated in code rather than in the database: BR3 enforced by
  a read-then-write check instead of a partial unique index, and audit immutability enforced by
  a repository convention instead of revoked privileges. Both would have passed their generated
  tests. Third was an event payload built by serialising the aggregate and deleting the reason
  field, which is one added column away from a leak. Plan revised and approved at 16:50.
  ADR-0001 and ADR-0002 filed.

### 2026-08-28

- **`internal-transfer-request`**: Gate 1 review — **Changes Requested** at 09:40 with 5
  Blockers, 4 Should-fix, 1 Nit. All five Blockers were acceptance criteria that read as
  reasonable prose but constrained nothing: "not eligible," "a valid future date," "pending
  with." Two turned out not to be spec defects at all but unanswered business questions the
  author had absorbed into the spec — reason-text visibility and pending-with naming. Both went
  back to their owners and were answered the same day. Spec revised to v1.1, resubmitted 14:05,
  **Approved** 17:20.
- **`constitution.md`**: amended — free-text employee narrative added to the protected
  categories, and the "employee ID is not PII" carve-out made explicit. Driven by Gate 1
  finding G1-F04. Every future spec now inherits this instead of rediscovering it.

### 2026-08-27

- **BRD-001**: business rules BR1–BR9 confirmed with HR Policy. OQ-06, OQ-07, OQ-08 and OQ-14
  resolved. Spec v1.0 drafted and submitted to Gate 1 at 16:10.
- Noted for the retro: drafting started with OQ-11 and OQ-12 still open. Both surfaced at Gate 1
  as Blockers. Cheap to fix there; the discipline point is that discovery should have closed them.

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
