# Deliverable Index — Employee Internal Transfer Digital Journey

Maps the assessment deliverables in `source/Requirement for SDD.docx` to the artefacts in this
repository, and shows where each link in the SDD chain is picked up by the next.

**Feature slug:** `internal-transfer-request` · **BRD:** BRD-001 · **Current state:** In Peer Review (Gate 1)

## The chain

```
BRD-001  ──▶  spec v1.1 (draft)  ──▶  Gate 1 (spec)  ──▶  plan  ──▶  Gate 1 (plan)
                    │                      │ pending              │ pending
                    │                      ▼                      ▼
                    │               Abhijit Adhikary         Abhijit Adhikary
                    │
                    ▼
          tasks T01–T10 (prepared)  ──▶  test-first (RED) — blocked until Gate 1 complete
                    │
                    ▼
         implementation  ──▶  Gate 2 (Tapas Dutta)  ──▶  release
              (not started)
```

## Deliverables

| # | Deliverable | Artefact | State |
|---|---|---|---|
| 1 | Requirement / Discovery Analysis | [`.ai-context/BRD.md`](../.ai-context/BRD.md) — objective, users, journey stages, business rules BR1–BR9, known decisions KD-01…KD-06, 19 open questions with owners, assumptions, dependencies, out-of-scope, spec map | Complete |
| 1a | Business decision vs technical decision | [`.ai-context/BRD.md`](../.ai-context/BRD.md) → *Business decisions vs technical decisions* | Complete |
| 2 | Feature specification and acceptance criteria | [`.ai-context/specs/internal-transfer-request.spec.md`](../.ai-context/specs/internal-transfer-request.spec.md) — 19 individually identified AC (`internal-transfer-request.AC1`…`AC19`) | In Peer Review — Draft v1.1 |
| 2a | API contracts | Same file → *API Contract*, `API01`…`API07` with payloads, success shapes and full exception tables | In Peer Review — Draft v1.1 |
| 3 | Spec-derived test cases | Spec → *Unit Test Cases* (`UT01`…`UT55`), expanded by QA in [`.ai-context/test_cases/internal-transfer-request.test_cases.md`](../.ai-context/test_cases/internal-transfer-request.test_cases.md) | Complete |
| 3a | System and cross-feature test cases | [`.ai-context/test_cases/_integration.md`](../.ai-context/test_cases/_integration.md) | Complete |
| 4 | Technical plan | [`.ai-context/plans/internal-transfer-request.plan.md`](../.ai-context/plans/internal-transfer-request.plan.md) — approach, data model, integrations, failure handling, constitution check, deferrals, sequencing | Plan Drafted |
| 4a | Architecture decisions | [`ADR-0001`](../.ai-context/decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md), [`ADR-0002`](../.ai-context/decisions/ADR-0002-transfer-request-system-of-record.md) | Accepted |
| 5 | Task decomposition | [`.ai-context/tasks/internal-transfer-request.tasks.md`](../.ai-context/tasks/internal-transfer-request.tasks.md) — T01–T10 with an AC↔task↔test matrix checked in both directions | Complete |
| 7 | AI prompts | [`.ai-context/prompts/internal-transfer-request.prompts.md`](../.ai-context/prompts/internal-transfer-request.prompts.md) — RED and GREEN prompt per task, all ID-referenced | Complete |
| 8 | Security assessment | [`.ai-context/security/internal-transfer-request.security.md`](../.ai-context/security/internal-transfer-request.security.md) — data classification, 16 threats, constitution compliance, conditions C1–C3 | Draft — pending Gate 1 |
| 9 | Gate 1 review | [`.ai-context/reviews/internal-transfer-request.gate1.md`](../.ai-context/reviews/internal-transfer-request.gate1.md) (spec) and [`.gate1-plan.md`](../.ai-context/reviews/internal-transfer-request.gate1-plan.md) (plan) | **Pending** — templates for Abhijit Adhikary |
| 10 | Gate 2 evidence | [`.ai-context/reviews/internal-transfer-request.gate2.md`](../.ai-context/reviews/internal-transfer-request.gate2.md) — AC-by-AC verification method fixed in advance | Prepared; **not yet evidenced** |

*The brief numbers deliverables 1–5 then 7–10; there is no deliverable 6.*

## Supporting artefacts

| Artefact | Purpose |
|---|---|
| [`.ai-context/constitution.md`](../.ai-context/constitution.md) | Project non-negotiables. Two amendments proposed 2026-08-28 — pending Gate 1 ratification |
| [`.ai-context/project_context.md`](../.ai-context/project_context.md) | One-page orientation |
| [`.ai-context/architecture.md`](../.ai-context/architecture.md) | Living system design, updated at plan drafting |
| [`.ai-context/status.md`](../.ai-context/status.md) | Delivery board and daily execution log |
| [`.ai-context/prompt_history.md`](../.ai-context/prompt_history.md) | Agent session audit trail — empty until T01 runs |
| [`.agent/rules/`](../.agent/rules/) | Always-on agent rules: `int-standards.node.md`, `int-standards.react.md`, `.agentignore`, `auto-log.md` |
| [`.agent/workflows/`](../.agent/workflows/) | Reusable prompts: spec review, plan generation, test generation, code review |
| [`docs/sdd-checklists.md`](sdd-checklists.md) | Gate, security, release, hotfix and triage checklists |

## Traceability — one thread, end to end

Taking a single business concern all the way through, which is what the chain is for:

| Link | Artefact | Identifier |
|---|---|---|
| Business need | Employees on probation should not be able to request a transfer | BRD-001 |
| Open question | "What exactly are the eligibility rules?" — asked, not assumed | BRD-001 OQ-03 |
| Business rule | Employment status must be Active and confirmed | BRD-001 BR1 |
| Spec design note | v1.0-style AC collapsed four rules into "not eligible" — v1.1 cites each rule individually | AC7 revision in spec v1.1 |
| Acceptance criterion | Each rule evaluated and reported individually, with the BR9 advisory always present | `internal-transfer-request.AC7` |
| API behaviour | 422 `eligibility-failed`, one `violations` entry per failed rule | `internal-transfer-request.API03` |
| Test cases | Probation, 11 months, exactly 12 months, active exit, two failures at once | `UT15`–`UT20` |
| QA expansion | Service measured at the effective date, prior spells, leave of absence | `UT16a`–`UT16c` |
| Open query | Which HRIS date governs after a leave of absence — raised, **not guessed** | `status.md` → Blocked |
| Plan decision | One function per rule ID; no rules engine, with the reasoning recorded | plan → Architecture Approach |
| Task | Business rule set | `internal-transfer-request.T04` |
| Prompt | RED and GREEN prompts naming BR1–BR9, both boundaries and the no-short-circuit rule | prompts → T04 |
| Gate 2 check | AC7 verified by ID against the diff | gate2 → AC7 |

The same thread exists for every AC. The AC↔task↔test matrix in `tasks.md` is checked in both
directions, so an AC with no task and a task with no AC are both caught before any code is
generated rather than at review.

## What has not been done

Stated plainly, because an index that implies completeness it does not have is worse than no
index:

- **Gate 1 not yet completed.** Review templates are ready for Abhijit Adhikary. Implementation is blocked until spec and plan are approved.
- **No implementation.** T01–T10 are all Not Started. No source code exists in `src/`.
- **No test execution.** Every test case is specified; none has run. Every result in the QA
  file reads *Not Run*, and it says so rather than being left blank.
- **Gate 2 is prepared, not passed.** The evidence file fixes what will be checked, in advance
  of the diff existing.
- **One spec ambiguity is open** and is blocking T04 by design: BR2's measurement date after a
  leave of absence. QA found it, raised it, and did not encode an interpretation.
- **Three of the four specs in the journey are Not started**, deliberately — the decomposition
  is in BRD-001's spec map, and `internal-transfer-request` was built to depend on none of them.
