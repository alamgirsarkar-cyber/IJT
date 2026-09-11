# Gate 1 — Spec Peer Review: `internal-transfer-downstream-orchestration`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here. The dated verdict is written
> as `## Gate 1 Review` on the spec per `.agent/rules/governance.md` — this worksheet is
> findings, not the sign-off.

## Review Record

| Field                                        | Value                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Spec under review                            | `.ai-context/specs/internal-transfer-downstream-orchestration.spec.md` |
| Version submitted                            | v1.0                                                                   |
| Author                                       | Alamgir Sarkar                                                         |
| **Reviewer (not the author)**                | Abhijit Adhikari                                                       |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_                       |
| Submitted                                    | 2026-09-07                                                             |
| Outcome                                      | **Changes Requested** (2026-09-09) — 5 Blocker, 7 Should-fix findings   |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. **Review order:** request → approval-chain
  → this file. Fulfilment starts only after HR approval (`employee.transfer.approved.v1`).
- **Open question (must resolve or defer before Approval):** resume after compensate —
  who records that reversal happened, and can fulfilment resume? Spec leaves the request
  in `FULFILMENT` with a `FAILED` stage and defines no resume API. See Open Questions in
  the spec and `status.md` Blocked.
- Dependency check: approval-chain and request are **In Peer Review**, not yet Approved.

## Findings

> The twelve rows below **transcribe** the twelve items the reviewer enumerated in the
> closing note of 2026-09-09, giving each a stable ID so spec revisions can cite it. No
> finding is added beyond that note, and none is reworded into a stronger claim than it
> makes. _Author disposition of every row is recorded in the spec's own `## Gate 1 Review`
> section, not here — this file stays the reviewer's record._

| ID     | Severity   | Where | Finding | Required change |
| ------ | ---------- | ----- | ------- | --------------- |
| G1-F01 | Blocker    | Whole spec — Intent, BR6, AC4 | The failure path is described in fragments (BR6 emits compensate signals, AC4 asserts the request stays `FULFILMENT`) with no end-to-end account of what a failed fulfilment looks like or how it ends | Define the complete failure / compensation / recovery lifecycle |
| G1-F02 | Blocker    | Open Questions #1; AC4; Explicitly Out of Scope | Whether fulfilment can ever restart after a stage is `FAILED` is left open, so two engineers would build materially different behaviour | Decide whether fulfilment can ever resume after `FAILED` |
| G1-F03 | Blocker    | BR6; `employee.transfer.compensate.v1` | A compensate signal is emitted but nothing says whether it is acknowledged, what a successful reversal looks like in the data, or what happens when the reversal itself fails | Define compensation acknowledgement and compensation-failure semantics |
| G1-F04 | Blocker    | AC4; Stage sequencing (BR2) | After a failure, the spec is silent on fulfilment stages still `NOT_STARTED` — they are neither signalled nor given a terminal status | Define what happens to later `NOT_STARTED` stages after a failure |
| G1-F05 | Blocker    | AC4; Open Questions #1 | A request left in `FULFILMENT` with a `FAILED` stage has no named owner, so nothing in the artefact says who is expected to act | Define the operational owner of a failed fulfilment |
| G1-F06 | Should-fix | BR2; Assumption A4 | Sequential execution of Payroll/IT/Facilities is asserted in BR2 but reopened by A4 ("if they require parallel start, BR2 changes before Approved") | Settle sequential-vs-parallel execution of Payroll/IT/Facilities |
| G1-F07 | Should-fix | Events this spec emits | Emitted events are listed as allow-lists of field names only — no envelope, no types, no required/optional, no evolution rule | Define a formal outbound event envelope and schema |
| G1-F08 | Should-fix | API01 idempotency | `eventId` is the idempotency key and a replay returns 200, but the spec does not say what happens when the same `eventId` arrives with a different payload | Define same-`eventId` / different-payload behaviour |
| G1-F09 | Should-fix | API01 auth; AuthN/AuthZ table | "HMAC of the request body" names no header, no canonicalisation, no replay window and no key-rotation behaviour — each an implementer guess with security consequences | Define a formal HMAC header / canonicalisation / replay / rotation contract |
| G1-F10 | Should-fix | Whole spec | Stage and request status transitions are spread across BR2, BR6, BR7, AC1–AC4 and the API01 exception table with no single matrix to check an implementation against | Add a state-transition matrix |
| G1-F11 | Should-fix | Business Rules; Acceptance Criteria; Unit Test Cases | Rules, ACs and tests do not consistently cite the BRD-001 item, ADR or constitution line they derive from | Add formal BRD → BR → AC → Test traceability |
| G1-F12 | Should-fix | Unit Test Cases (UT01–UT15) | Tests cover the happy path and single-fault cases; there is no out-of-order report, no duplicate-with-different-payload, no compensation-failure and no integration coverage against a consumer double | Add negative and out-of-order integration tests |

---

## Checks Performed

| Check                                                                                       | Result |
| ------------------------------------------------------------------------------------------- | ------ |
| **Reviewer ≠ author**                                                                       |        |
| **Intent is one unambiguous paragraph**                                                     |        |
| **Every AC given/when/then and individually IDed**                                          |        |
| **API Contract complete — payload, success shape, exception table**                         |        |
| **Out-of-scope items explicit**                                                             |        |
| **Ambiguity — could two engineers build materially different things?**                      |        |
| **Constitution compliance**                                                                 |        |
| **Overlap with an existing spec**                                                           |        |
| **Dependency check — Builds-on/Related specs in Approved or Released state**                |        |
| **Open questions that a plan would have to guess — none remaining, or deferred with owner** |        |
| **Security / Architecture sign-off obtained where required**                                |        |
| **Status updated to Approved or Changes Requested — never left ambiguous**                  |        |

---

## Reviewer's Closing Note

Final verdict: Changes Requested. This spec is not yet buildable without engineers guessing
at materially different failure-handling behaviour. Five P0 items must be resolved before
Gate 1 approval: define the complete failure/compensation/recovery lifecycle; decide whether
fulfilment can ever resume after `FAILED`; define compensation acknowledgement/failure
semantics; define what happens to later `NOT_STARTED` stages after a failure; and define the
operational owner of a failed fulfilment. Seven P1 items are strongly recommended before
approval but not, on their own, blocking: sequential-vs-parallel execution of
Payroll/IT/Facilities; a formal outbound event envelope/schema; same-`eventId`/different-payload
behaviour; a formal HMAC header/canonicalization/replay/rotation contract; a state-transition
matrix; formal BRD → BR → AC → Test traceability; and negative/out-of-order integration tests.

---

## Outcome

| Field                              | Value                                                                                       |
| ---------------------------------- | ------------------------------------------------------------------------------------------- |
| **Outcome**                        | **Changes Requested**                                                                       |
| **Spec version after review**      | v1.1 — Changes Requested. Author revision **v1.2** resubmitted 2026-09-11                   |
| **Date**                           | 2026-09-09                                                                                  |
| **Next step if Approved**          | Plan drafting only after approval-chain is Approved and the resume OQ is closed or deferred |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits                                               |

_When complete: update the spec status and `.ai-context/status.md` the same day._

---

## Re-review queue — v1.2 (not yet reviewed)

Author revision v1.2 (2026-09-11) responds to G1-F01–G1-F12; the disposition table is in
the spec's own `## Gate 1 Review` section. **No Gate 1 outcome is recorded for v1.2** — it
awaits this reviewer. Two things to weigh when it is picked up:

1. **G1-F02 is only half closed here by design.** v1.2 specifies v1 system behaviour (no
   automatic and no portal-driven resume; HR Operations closes out off-portal). The business
   question of whether that is acceptable for v1 was escalated to **BRD-001 OQ-20** rather
   than answered in the spec, because it is HR Ops' decision to make. Approval still depends
   on OQ-20 being confirmed or formally deferred.
2. **_Checks Performed_ above is still blank.** Those rows are reviewer judgements and were
   deliberately left unfilled rather than inferred from the closing note.
