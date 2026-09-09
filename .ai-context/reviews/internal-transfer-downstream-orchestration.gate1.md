# Gate 1 — Spec Peer Review: `internal-transfer-downstream-orchestration`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here.

## Review Record

| Field | Value |
|---|---|
| Spec under review | `.ai-context/specs/internal-transfer-downstream-orchestration.spec.md` |
| Version submitted | v1.0 |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikary |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_ |
| Submitted | 2026-09-07 |
| Outcome | **Changes Requested** (2026-09-09) — 5 Blocker (P0), 7 Should-fix (P1) findings |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. **Review order:** request → approval-chain
  → this file. Fulfilment starts only after HR approval (`employee.transfer.approved.v1`).
- **Open question (must resolve or defer before Approval):** resume after compensate —
  who records that reversal happened, and can fulfilment resume? Spec leaves the request
  in `FULFILMENT` with a `FAILED` stage and defines no resume API. See Open Questions in
  the spec and `status.md` Blocked.
- Dependency check: approval-chain and request are **In Peer Review**, not yet Approved.

## Findings

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F01 | Blocker (P0) | BR6 (line 80), Open Questions #1 (lines 244–250) | The failure/compensation/recovery lifecycle is only partially defined: compensate signals are emitted, but there is no full lifecycle description covering acknowledgement, terminal recovery states, and who closes the loop | Define the complete failure/compensation/recovery lifecycle end to end, not just the emission of compensate events |
| G1-F02 | Blocker (P0) | Open Questions #1 (lines 244–250) | Whether fulfilment can ever resume after a stage is `FAILED` is explicitly left open — the spec itself flags this as blocking ("Do not submit this spec to Gate 1...") | Decide whether fulfilment can ever resume after `FAILED`; if yes, define the resume API/trigger, if no, state that explicitly as a business decision |
| G1-F03 | Blocker (P0) | Events emitted (lines 141–148), API Contract (lines 83–139) | `employee.transfer.compensate.v1` is emitted but the spec defines no way for the portal to learn whether a downstream system's compensation succeeded or failed — there is no compensation-acknowledgement endpoint or event | Define compensation acknowledgement/failure semantics: how the portal learns a compensate signal succeeded or failed, and what happens on compensation failure |
| G1-F04 | Blocker (P0) | BR6 (line 80), AC4 (lines 176–177) | On a stage failure, BR6/AC4 define that already-`COMPLETED` stages are compensated, but no rule states what happens to stages still `NOT_STARTED` at that point (e.g., IT/Facilities not yet signalled when Payroll fails) | Define what happens to later `NOT_STARTED` stages after a failure — do they stay `NOT_STARTED` permanently, get marked `CANCELLED`, or something else |
| G1-F05 | Blocker (P0) | Open Questions #1 (lines 244–250), Explicitly Out of Scope (lines 239–240) | No role or system is named as accountable for a request stuck in `FULFILMENT` with a `FAILED` stage — "Retry / mark complete UI for HR after FAILED" is out of scope, but no alternative operational owner is defined | Define the operational owner of a failed fulfilment — who is notified, who acts, and through what channel if not the portal |
| G1-F06 | Should-fix (P1) | BR2 (line 76), Assumption A3/A4 area (lines 261–264) | BR2 states stages are signalled "in sequence-number order," i.e. sequential, but this is recorded partly as business rule and partly as an assumption ("if false... parallel start after org update, BR2 changes before Approved"), leaving execution order not fully ratified | Resolve sequential vs. parallel execution of Payroll/IT/Facilities as a ratified business decision, not an assumption |
| G1-F07 | Should-fix (P1) | Events emitted (lines 141–148) | Outbound events (`employee.transfer.compensate.v1` and others) list field names but no formal envelope/schema (types, required/optional, versioning rules) | Formalize the outbound event envelope/schema for every emitted event |
| G1-F08 | Should-fix (P1) | API01 Idempotency (lines 97–98), AC5 (lines 181–183) | Idempotency is defined only for a replay with an identical payload under the same `eventId`; behaviour when the same `eventId` arrives with a *different* payload is undefined | Define same-`eventId`/different-payload behaviour explicitly (reject, 409, overwrite, etc.) |
| G1-F09 | Should-fix (P1) | API01 Auth (line 93), AC8 (line 195), Assumption A3 (line 261) | HMAC is required for webhook auth, but header name, canonicalization method, replay-window handling, and secret rotation are not specified beyond "secrets live in Secrets Manager" | Formalize the HMAC header name, canonicalization, replay protection, and rotation contract |
| G1-F10 | Should-fix (P1) | Business Rules (lines 71–82), Acceptance Criteria (lines 154–205) | Stage and request states (`NOT_STARTED`/`IN_PROGRESS`/`COMPLETED`/`FAILED`/`CANCELLED`, request `FULFILMENT`) are described across BRs and ACs in prose, with no single state-transition matrix showing all valid/invalid transitions | Add a formal state-transition matrix for stage and request status |
| G1-F11 | Should-fix (P1) | Whole spec | BR/AC/Test rows do not consistently cite the BRD-001 open question or business rule they derive from | Add formal BRD → BR → AC → Test traceability, e.g. a traceability table or consistent citation on each row |
| G1-F12 | Should-fix (P1) | Unit Test Cases (lines 207–221) | Existing test cases cover the happy path and single-failure sequences, but there is no negative or out-of-order coverage (e.g., completion report for a stage not yet `IN_PROGRESS`, out-of-sequence stage completion, compensate arriving before its trigger) | Add negative and out-of-order integration test cases |

---

## Checks Performed

| Check | Result |
|---|---|
| **Reviewer ≠ author** | Pass — Abhijit Adhikary ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph** | Pass |
| **Every AC given/when/then and individually IDed** | Pass |
| **API Contract complete — payload, success shape, exception table** | Should-fix — see G1-F07, G1-F08, G1-F09 |
| **Out-of-scope items explicit** | Should-fix — see G1-F05 |
| **Ambiguity — could two engineers build materially different things?** | Fail — see G1-F01–G1-F05 |
| **Constitution compliance** | Pass |
| **Overlap with an existing spec** | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state** | Fail — `internal-transfer-approval-chain` and `internal-transfer-request` not yet both Approved |
| **Open questions that a plan would have to guess — none remaining, or deferred with owner** | Fail — resume-after-failure (G1-F02) is open and the spec itself says it must be resolved or deferred before Approval |
| **Security / Architecture sign-off obtained where required** | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous** | Pass — set to Changes Requested below |

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

| Field | Value |
|---|---|
| **Outcome** | **Changes Requested** |
| **Spec version after review** | v1.0 — Changes Requested |
| **Date** | 2026-09-09 |
| **Next step if Approved** | Plan drafting only after approval-chain is Approved and the resume OQ is closed or deferred |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits |

_When complete: update the spec status and `.ai-context/status.md` the same day._
