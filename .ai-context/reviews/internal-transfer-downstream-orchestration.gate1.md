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
| Submitted                                    | 2026-09-07; **v1.4 (OWN-11 CAS on API01) submitted 2026-09-15**       |
| Outcome                                      | **Approved** (2026-09-11, v1.3) — was **Changes Requested** (2026-09-09, v1.0). **v1.4 re-reviewed 2026-09-23 — Changes Requested** |

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

### Re-review findings — v1.4, 2026-09-23

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F13 | Blocker | BR6 (line 94, "in reverse sequence"); Fulfilment Lifecycle path 3 — Compensation (lines 148–156); event catalogue row `employee.transfer.compensate.v1` (line 381, "reverse sequence order"); AC4 | "Reverse sequence order" is stated for compensate events, but the outbox/relay is at-least-once delivery (ADR-0001, BR5) with no ordering guarantee across separate consumer deliveries — the spec never says whether "reverse sequence" binds only the order events are *created*/written to the outbox, or is a *processing*-order requirement the consumers themselves must honour | Explicitly define whether reverse ordering is creation order only (each compensate event targets a different consumer and is independently applied) or a cross-consumer processing-order requirement — and if the latter, define the mechanism (e.g., a sequence field in the payload) |
| G1-F14 | Blocker | "Where a request can come to rest" table (lines 197–198, `FULFILMENT` / "HR Operations, off-portal"); Context (lines 58–64, request spec owns stage display labels); Surfaces (lines 577–579, "no new employee-facing screen") | The request stays `FULFILMENT` while HR Operations recovers off-portal, but this spec does not say — or cite — how `internal-transfer-request` API04 is expected to present that resting state, so nothing here guards against the employee-facing status page reading as ordinary in-progress fulfilment | Cross-reference `internal-transfer-request` BR16 / _Failed and compensating fulfilment — employee view_ directly (its "HR is completing this" / `pendingWith.role: HR_OPERATIONS` contract) and confirm this spec's failure/compensation stage statuses are exactly BR16's trigger condition |
| G1-F15 | Blocker | API01 request payload, `outcome` field (lines 289, 301); BR5 (line 93); state transition matrix (line 178) | `outcome: SUCCESS` drives a stage to `COMPLETED` and advances the workflow (eventually `EMPLOYEE_CONFIRMATION` and the employee-visible "Completed" status), but the spec never defines what a consumer is certifying when it reports `SUCCESS` — actual completion of the downstream business operation, versus mere acceptance, ticket creation or job queuing | State explicitly, alongside BR5, that `outcome: SUCCESS` means the downstream business operation itself has completed — an asynchronous consumer (e.g. ITSM ticketing) must not report `SUCCESS` until its own ticket/work is resolved, not on intake |
| G1-F16 | Blocker | Context (lines 79–83, "Architecture already records that Payroll, ITSM and Facilities consumers are not built... that is visible, not silent"); "Where a request can come to rest," "Consumer not built" row (line 199) | The spec already flags unbuilt consumers as accepted architecture debt, but does not clearly separate "this SDD contract is complete and ready to build against" from "the transfer journey works end-to-end" — a real risk given plans/tasks were already drafted (2026-09-22) treating this spec as ready without that distinction | Add an explicit statement (Context, or a new callout) that Gate 1 approval certifies the contract only; end-to-end fulfilment remains blocked on Payroll/ITSM/Facilities implementing their consumers, and that is a separate readiness question from this spec's own Definition of Done |

---

## Checks Performed

| Check                                                                                       | Result |
| ------------------------------------------------------------------------------------------- | ------ |
| **Reviewer ≠ author**                                                                       | Pass — Abhijit Adhikari ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph**                                                     | Pass |
| **Every AC given/when/then and individually IDed**                                          | Pass — AC1–AC19 |
| **API Contract complete — payload, success shape, exception table**                         | Pass — G1-F07/F08/F09 addressed with envelope, idempotency-key-conflict and signature contract |
| **Out-of-scope items explicit**                                                             | Pass |
| **Ambiguity — could two engineers build materially different things?**                      | Pass — G1-F01–F05 closed by the Fulfilment Lifecycle section and transition matrices |
| **Constitution compliance**                                                                 | Pass |
| **Overlap with an existing spec**                                                           | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state**                | Fail — `internal-transfer-approval-chain` and `internal-transfer-request` not yet both Approved; noted as an outstanding programme-level risk, not a reason to withhold this spec's own approval |
| **Open questions that a plan would have to guess — none remaining, or deferred with owner** | Pass — OQ-20 Resolved by Product, 2026-09-11 |
| **Security / Architecture sign-off obtained where required**                                | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous**                  | Pass — set to Approved below |

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
| **Outcome**                        | **Approved**                                                                       |
| **Spec version after review**      | v1.0 — Changes Requested (2026-09-09); v1.3 — **Approved** (2026-09-11)             |
| **Date**                           | 2026-09-09 (Changes Requested); 2026-09-11 (Approved)                              |
| **Next step if Approved**          | Plan drafting may proceed. Outstanding risk: `internal-transfer-approval-chain` and `internal-transfer-request` still not both Approved — track at programme level |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits                                               |

_When complete: update the spec status and `.ai-context/status.md` the same day._

---

## Re-review — v1.3, 2026-09-11: Approved

Author revision v1.2 (2026-09-11) responded to G1-F01–G1-F12; disposition table is in the
spec's own `## Gate 1 Review` section. v1.3 layered Product's 2026-09-11 lock of BRD-001
OQ-20 on top with no behaviour change.

1. **G1-F02 / OQ-20 — now fully closed.** Product confirmed on 2026-09-11 that off-portal
   closeout by HR Operations is the accepted v1 business behaviour; portal resume stays
   deferred, not undecided. Nothing further blocks approval on this point.
2. **_Checks Performed_ above is now filled in** — see the Dependency check row for the one
   remaining Fail, carried as a non-blocking programme-level risk rather than a spec defect.

**Verdict: Approved.**

## Re-review — v1.4, 2026-09-23: Changes Requested

Abhijit Adhikari reviewed manually (chat, not the Artifact dashboard). The 2026-09-11
Approved verdict covered v1.3; v1.4's only change (OWN-11 compare-and-swap on API01) had
not yet been reviewed. This pass covers v1.4 and raises four new Blocker findings,
G1-F13–G1-F16 — none a re-litigation of G1-F01–G1-F12, all closing gaps the earlier
lifecycle/matrix work did not reach: whether "reverse sequence" compensation ordering binds
consumer processing or only event creation; how a failed/compensating `FULFILMENT` request
is presented to the employee (this spec is silent; `internal-transfer-request` BR16 already
answers it but is not cited here); what a consumer's `SUCCESS` report actually certifies;
and distinguishing this spec's contract-readiness from the programme's end-to-end
readiness, which matters now that plans/tasks have already been drafted against this spec.

**Verdict: Changes Requested.** All four Blocker findings must be resolved before Gate 1
re-approval.

---

## Outcome (v1.4 re-review)

| Field | Value |
|---|---|
| **Outcome** | **Changes Requested** (2026-09-23, v1.4) |
| **Spec version after review** | v1.0 — Changes Requested (2026-09-09); v1.3 — Approved (2026-09-11); v1.4 — **Changes Requested** (2026-09-23, findings G1-F13–G1-F16) |
| **Date** | 2026-09-09; 2026-09-11; 2026-09-23 |
| **Next step if Approved** | N/A for this round |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits — **applies now** |
