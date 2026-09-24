# Gate 1 — Spec Peer Review: `internal-transfer-approval-chain`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here. The dated verdict is written
> as `## Gate 1 Review` on the spec per `.agent/rules/governance.md` — this worksheet is
> findings, not the sign-off.

## Review Record

| Field                                        | Value                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Spec under review                            | `.ai-context/specs/internal-transfer-approval-chain.spec.md`           |
| Version submitted                            | v1.0                                                                   |
| Author                                       | Alamgir Sarkar                                                         |
| **Reviewer (not the author)**                | Abhijit Adhikari                                                       |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_                       |
| Submitted                                    | 2026-09-07; **v1.3 (OWN-11 `If-Match` on API03) submitted 2026-09-15**; **v1.4 submitted 2026-09-24** |
| Outcome                                      | **Approved** (2026-09-09, v1.0). **v1.1–v1.3 published without a new Gate 1 pass** (spec's own Superseded-by note); v1.3 re-reviewed 2026-09-23 — **Changes Requested**; v1.4 re-reviewed 2026-09-24 — **Changes Requested** |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. **Review `internal-transfer-request`
  first** — this spec consumes its aggregate, stage plan and state machine.
- Dependency check: related request spec is **In Peer Review**, not yet Approved. Treat
  that as a programme-level co-review, or withhold Approval of this file until the request
  spec is Approved.

## Findings

| ID     | Severity | Where | Finding | Required change |
| ------ | -------- | ----- | ------- | --------------- |
| G1-F01 |          |       |         |                 |
|        |          |       |         |                 |

### Re-review findings — v1.3, 2026-09-23

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F01 | Blocker | Assumption A4 (line 444); AC3 (lines 277–284); API03 request payload note "This spec does not apply BR7 to the confirmed date" (line 238) | Whether BR7's 14–180 day window applies to the HR-confirmed effective date (as opposed to only the employee's requested date) is left as an unconfirmed Assumption (A4), not an explicit business decision | Product obtains and records an explicit decision on whether BR7 applies to `confirmedEffectiveDate`. If it does, AC3 gains a validation rule and API03 gains a 422 exception row; if not, A4 is promoted from assumption to a stated, sourced business rule |
| G1-F02 | Blocker | BR6 (line 76); Assumption A3 (lines 442–443); Open Questions note "BR6's ... remains Assumption A3" (lines 431–433) | BR6 authorises **any** principal holding role `HR_BUSINESS_PARTNER` to complete **any** request's `HR_VALIDATION`, with no per-case assignment or ownership check. This authorisation model is stated only as an unconfirmed Assumption (A3), not a deliberate product/security decision | Product/Security explicitly confirm the "any HR Business Partner may act on any case" model is intended (as opposed to a named/assigned HR BP per request). Record the decision and cite it from BR6 directly; remove the "remains Assumption A3" hedge once confirmed |

### Re-review findings — v1.4, 2026-09-24

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F03 | Major (reviewer's term) | AC3 (lines 278–285); counterpart: `internal-transfer-downstream-orchestration` § State transition matrix (line 182, `NOT_STARTED` → `IN_PROGRESS` on `approved.v1` handled) and AC1 (line 401) | Duplicate ownership of `ORG_DATA_UPDATE`. Approval-chain AC3 moves the stage to `IN_PROGRESS` in the HR-approval transaction; downstream also owns that same transition when it handles `approved.v1`. This is the main remaining issue | Exactly one spec owns the `ORG_DATA_UPDATE` start transition; the other references it rather than restating it |

G1-F01 and G1-F02 (v1.3) were not re-raised on v1.4.

---

## Checks Performed

| Check                                                                        | Result |
| ---------------------------------------------------------------------------- | ------ |
| **Reviewer ≠ author**                                                        |        |
| **Intent is one unambiguous paragraph**                                      |        |
| **Every AC given/when/then and individually IDed**                           |        |
| **API Contract complete — payload, success shape, exception table**          |        |
| **Out-of-scope items explicit**                                              |        |
| **Ambiguity — could two engineers build materially different things?**       |        |
| **Constitution compliance**                                                  |        |
| **Overlap with an existing spec**                                            |        |
| **Dependency check — Builds-on/Related specs in Approved or Released state** |        |
| **Security / Architecture sign-off obtained where required**                 |        |
| **Status updated to Approved or Changes Requested — never left ambiguous**   |        |

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

## Re-review — v1.3, 2026-09-23: Changes Requested

Abhijit Adhikari reviewed manually (chat, not the Artifact dashboard). The 2026-09-09
Approved verdict covered v1.0 only; v1.1–v1.3 were published without a new Gate 1 pass (per
the spec's own Superseded-by note), so this is the first review of v1.1's AuthN/AuthZ
section, v1.2's OQ-11/OQ-12 lock, and v1.3's OWN-11 `If-Match` addition together.

Two Blocker findings raised, both the same shape: a business/security decision that the
spec currently carries only as a prose **Assumption** (A3, A4) rather than something
confirmed and recorded as a rule. G1-F01 — whether BR7's date window binds the HR-confirmed
effective date, not just the employee-requested one. G1-F02 — whether "any
`HR_BUSINESS_PARTNER` may complete any `HR_VALIDATION`" (no per-case assignment) is the
intended authorisation model, given `internal-transfer-request` BR15 now takes the opposite
approach for managers (an unresolved assignee blocks the request rather than being
authorised broadly).

**Verdict: Changes Requested.** Both findings must be resolved — as an explicit,
sourced product/security decision, with spec and AC changes if the answer requires them —
before Gate 1 approval.

## Re-review — v1.4, 2026-09-24: Changes Requested

Abhijit Adhikari reviewed manually (chat, not the Artifact dashboard). One Major finding,
G1-F03: duplicate ownership of `ORG_DATA_UPDATE` between this spec's AC3 and
`internal-transfer-downstream-orchestration`. The reviewer called it the main remaining
issue.

**Verdict: Changes Requested.**

---

## Outcome

| Field                              | Value                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| **Outcome**                        | **Approved** (2026-09-09, v1.0); **Changes Requested** (2026-09-23, v1.3); **Changes Requested** (2026-09-24, v1.4) |
| **Spec version after review**      | v1.0 — Approved (2026-09-09); v1.3 — **Changes Requested** (2026-09-23, findings G1-F01–G1-F02); v1.4 — **Changes Requested** (2026-09-24, finding G1-F03) |
| **Date**                           | 2026-09-09 (v1.0); 2026-09-23 (v1.3); 2026-09-24 (v1.4)     |
| **Next step if Approved**          | Plan drafting may start after request spec is also Approved |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits — **applies now** |

_When complete: update the spec status and `.ai-context/status.md` the same day._
