# Gate 1 — Spec Peer Review: `internal-transfer-approval-chain`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here.

## Review Record

| Field | Value |
|---|---|
| Spec under review | `.ai-context/specs/internal-transfer-approval-chain.spec.md` |
| Version submitted | v1.0 |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikary |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_ |
| Submitted | 2026-09-07 |
| Outcome | **Approved** (2026-09-09) — see Findings for Blockers cleared and Should-fix items carried forward as non-blocking follow-ups |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. **Review `internal-transfer-request`
  first** — this spec consumes its aggregate, stage plan and state machine.
- Dependency check: related request spec is **In Peer Review**, not yet Approved. Treat
  that as a programme-level co-review, or withhold Approval of this file until the request
  spec is Approved.

## Findings

| ID | Severity | Where | Finding | Required change | Status |
|---|---|---|---|---|---|
| G1-F01 | Blocker | BR5 (line 72), BR6 (line 73), Open Questions (lines 364–373) | BR5 and BR6 are written as final rules while resting on BRD-001 OQ-12 (marked "proposed" in the request spec) and OQ-11 (role-vs-named-person, only closed here via Assumption A3) | Resolve OQ-11 and OQ-12 in the BRD before BR5/BR6 are treated as final; do not close a BRD open question via a spec-local assumption | **Resolved 2026-09-09** — OQ-11/OQ-12 reviewed in `BRD.md`: Approved with comment, action item recorded to formally confirm or defer the proposed answers |
| G1-F02 | Should-fix | API02 auth (lines 136–138) | "Caller must satisfy BR6 for at least one approval stage on the request (current or already completed by them)" does not say whether an approver whose own stage is already `COMPLETED` keeps GET access once a later stage is in progress or after the request reaches a terminal state | Spell out historical-approver access to API02 explicitly: which callers keep read access, and until when | **Open — non-blocking.** Carried forward as a follow-up for the next spec revision |
| G1-F03 | Should-fix | BR3 (line 70), Assumption A4 (lines 385–386), API03 payload (lines 202–204) | No business constraint is stated for `confirmedEffectiveDate` — A4 says there is no portal-enforced window, but this is recorded as an assumption, not a ratified business decision, and no relationship to `requestedEffectiveDate` is defined | Confirm as a business decision (not just an assumption) whether any constraint applies to the confirmed effective date; add a validation AC/test if one does | **Open — non-blocking.** Carried forward as a follow-up for the next spec revision |
| G1-F04 | Blocker | Context (lines 46–49), Assumption A1 (lines 377–380) | The stage-plan / `assigned_party_ref` handoff from `internal-transfer-request` is described only as a prose assumption, not a formal contract (required fields, shape, behaviour if the producing spec's data doesn't match) | Formalize the request-spec → approval-chain stage-plan handoff as an explicit contract rather than an assumption | **Resolved 2026-09-09** — reviewer accepts the current description as sufficient for Gate 1 approval |
| G1-F05 | Should-fix | AC1 (line 231), AC2 (lines 238–239), AC3 (line 247), AC4 (line 255) | Outbox event names (`stage-pending.v1`, `approved.v1`, `rejected.v1`) are used throughout the ACs but no event schema is defined anywhere in the spec | Add a formal payload schema (fields, types, required/optional) for each of the three event versions | **Open — non-blocking.** Carried forward as a follow-up for the next spec revision |
| G1-F06 | Should-fix | Unit Test Cases (lines 303–333) | Test cases cover state-transition ACs well but do not exercise API-level behaviour: pagination on API01, or 401/404/429 systematically across all three endpoints, beyond a single 422 case (UT05) | Add test cases for API01 pagination and for 401/404/429/422 per endpoint per the exception tables | **Open — non-blocking.** Carried forward as a follow-up for the next spec revision |
| G1-F07 | Should-fix | Open Questions (lines 364–373); BR/AC/Test citations throughout | Traceability from BRD-001 open questions through business rules to ACs to tests is inconsistent — not every AC/test row cites the BR or OQ it derives from | Strengthen BRD → Spec → AC → Test traceability, e.g. a traceability table or consistent BR/OQ citation on each AC and test row | **Open — non-blocking.** Carried forward as a follow-up for the next spec revision |

---

## Checks Performed

| Check | Result |
|---|---|
| **Reviewer ≠ author** | Pass — Abhijit Adhikary ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph** | Pass |
| **Every AC given/when/then and individually IDed** | Pass |
| **API Contract complete — payload, success shape, exception table** | Should-fix — see G1-F02, G1-F05 (non-blocking, carried forward) |
| **Out-of-scope items explicit** | Pass |
| **Ambiguity — could two engineers build materially different things?** | Pass — G1-F01 and G1-F04 resolved; G1-F03 remains open as a non-blocking follow-up |
| **Constitution compliance** | Pass |
| **Overlap with an existing spec** | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state** | Fail — `internal-transfer-request` still In Peer Review (Changes Requested), not Approved. Reviewer approved this spec ahead of that dependency; see Status note in the spec file |
| **Security / Architecture sign-off obtained where required** | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous** | Pass — set to Approved below |

---

## Reviewer's Closing Note

Final verdict: **Approved.** Both Blockers are cleared: OQ-11/OQ-12 were reviewed and
approved with comment in `BRD.md` (action item recorded to formally confirm or defer them),
and the request-spec → approval-chain stage-plan handoff is accepted as sufficient for Gate
1 despite remaining a prose assumption. The five Should-fix items (API02 historical-approver
access, confirmed effective-date business constraint, event payload schemas, API-level test
coverage, and BRD → Spec → AC → Test traceability) are not required before approval and are
carried forward as non-blocking follow-ups for the author to address in a later revision.

Outstanding risk: `internal-transfer-request` is still In Peer Review (Changes Requested),
not Approved, so this spec's stated dependency-approval preference is not met. This is
approved ahead of that dependency resolving — track it as a programme-level risk before plan
drafting begins.

---

## Outcome

| Field | Value |
|---|---|
| **Outcome** | **Approved** |
| **Spec version after review** | v1.0 — Approved |
| **Date** | 2026-09-09 |
| **Next step if Approved** | Plan drafting may start after request spec is also Approved |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits |

_When complete: update the spec status and `.ai-context/status.md` the same day._
