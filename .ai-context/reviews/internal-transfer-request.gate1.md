# Gate 1 — Spec Peer Review: `internal-transfer-request`

> The most consequential review in the lifecycle. An approved spec deterministically
> generates code, tests and documentation simultaneously, so a miss here does not cost one
> bad diff — it costs a bad diff, bad tests that pass because they were derived from the
> same bad premise, and documentation that faithfully records the wrong intent.
>
> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here. The dated verdict is written
> as `## Gate 1 Review` on the spec per `.agent/rules/governance.md` — this worksheet is
> findings, not the sign-off.

## Review Record

| Field | Value |
|---|---|
| Spec under review | `.ai-context/specs/internal-transfer-request.spec.md` |
| Version submitted | v1.1 |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikari |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_ |
| Submitted | 2026-09-07 (reconfirmed with full BRD-001 programme submission) |
| Outcome | **Changes Requested** (2026-09-09) — 8 Blocker, 6 Should-fix findings |

Plan review (Gate 1 continued) is recorded separately in
`.ai-context/reviews/internal-transfer-request.gate1-plan.md` after the spec is **Approved**.

---

## Findings

_Categorise each finding as **Blocker** / **Should-fix** / **Nit**. Cite the spec line or
section. Do not rewrite the spec in this file — record what must change._

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F01 | Blocker | API03 success response (line 253), API04 success response (line 313) | The `MANAGER_RELEASE` stage is shown as `PENDING` immediately after submission in API03's response, but the same stage on the same request is shown as `IN_PROGRESS` in API04's response — and `internal-transfer-approval-chain` also uses these stage-status values | Resolve `PENDING` vs `IN_PROGRESS` stage status consistently across this spec and `internal-transfer-approval-chain` — pick one status name for "stage is current and awaiting action" and use it everywhere |
| G1-F02 | Blocker | Request State Machine (lines 77–90), Context state-machine note (lines 54–58) | The state machine diagram and the "definition vs. build" note describe which spec *transitions* which states, but there is no single authoritative contract listing every valid request/stage state, every valid transition, and which spec's API performs it | Define the authoritative request/stage state-transition contract — a single source of truth both this spec and `internal-transfer-approval-chain`/`internal-transfer-downstream-orchestration` can be checked against |
| G1-F03 | Blocker | AC9 (lines 502–508), Request State Machine (lines 77–90) | AC9 says submission moves status to `SUBMITTED` and creates the stage plan in one database transaction, but it is not stated whether the `MANAGER_REVIEW` status (and the `MANAGER_RELEASE` stage becoming actionable) happens synchronously within that same submission call, or asynchronously afterward via the `employee.transfer.requested` event | Clarify whether `SUBMITTED → MANAGER_REVIEW` happens synchronously within submission or as a separate, later transition |
| G1-F04 | Blocker | AC9 (line 507), AC14 (line 542) | Event names are written without a version suffix (`employee.transfer.requested`, `employee.transfer.withdrawn`) here, while `internal-transfer-notifications`' matrix uses inconsistent forms (`employee.transfer.requested` / `requested.v1`) for what appears to be the same event | Standardize the domain event names used across all four specs, especially `employee.transfer.requested.v1`, to one consistent name and version |
| G1-F05 | Blocker | AC9 (line 507) | `employee.transfer.requested` is written to the outbox at submission, but no payload schema (fields, types, required/optional) is defined anywhere in this spec for that event, even though downstream specs consume it | Define the `employee.transfer.requested.v1` event schema |
| G1-F06 | Blocker | AC11 (lines 518–524), API04 note (lines 324–327), BRD-001 OQ-11 | `assignedPartyName`/`pendingWith` naming behaviour is built into AC11 and API04 as if OQ-11 were closed, but OQ-11 itself is only "Approved with comment" in `BRD.md` pending a formal confirm-or-defer, and `internal-transfer-approval-chain` also depends on it | Resolve/formally confirm OQ-11 in `BRD.md` and cite that confirmation consistently from every spec that relies on it, rather than each spec treating it as settled independently |
| G1-F07 | Blocker | AC18 (lines 569–574) | AC18 requires the audit record to carry "the acting principal's employee ID" while also requiring the record to contain "no PII" — it is not stated whether an employee ID is itself classified as PII (requiring pseudonymisation, as AC17 already does via a salted hash for rate-limit keys) or as a permitted identifier | Clarify the employee-ID/pseudonymous-ID classification for audit records — state explicitly whether the raw employee ID is permitted in an audit row or must be pseudonymised, consistent with AC17's treatment of the identifier elsewhere |
| G1-F08 | Blocker | API02 concurrency control (line 197), API06 (lines 373–401) | API02 (update) requires `If-Match`/version and defines a 409 `version-conflict`, but API06 (withdraw) defines no concurrency control at all — the contract does not say what happens when an employee calls withdraw at the same moment `internal-transfer-approval-chain` transitions a stage (e.g., HR approves and the request moves toward `FULFILMENT` just as the employee withdraws) | Define concurrent withdrawal vs. approval behaviour in this aggregate's contract — whether API06 requires `If-Match`, and what happens when a withdrawal and a stage transition race |
| G1-F09 | Should-fix | AC8 (lines 495–500), UT23 (line 609) | BR3 (one non-terminal request per employee) is enforced only at the application layer — AC8 says "exactly one succeeds" for concurrent creates, but no database-level uniqueness constraint (e.g., a partial unique index) is specified to guarantee that under real concurrency | Add a database-level invariant (e.g., partial unique index) for one non-terminal request per employee, not just an application-level check |
| G1-F10 | Should-fix | BR2 (line 68), AC7 (lines 485–492) | BR2/AC7 require "12 months in position as at the requested effective date," but the spec does not define how service length is calculated — calendar months, continuous service only, or whether gaps such as leave of absence count | Define the service-length calculation precisely, including how breaks in service (e.g., leave of absence) are treated |
| G1-F11 | Should-fix | API01 success response `currentAssignment` (lines 158–177), AC9 frozen snapshot (lines 502–508) | The `currentAssignment` shown while a request is `DRAFT` is not explicitly marked as informational/subject to change — AC9 later "freezes" a current-assignment snapshot at submission, implying the draft-time value shown earlier could differ from what gets frozen | Clarify that draft-time assignment data is informational only, and that the authoritative snapshot is the one frozen at submission |
| G1-F12 | Should-fix | API07 reference-data caching (lines 406–441), AC6/AC7 submission-time checks (lines 474–492) | AC6/AC7 evaluate BR5/BR6/BR1/BR2/BR4 using data "read at submission time," which is good, but the spec never explicitly states that API07's cached (up to stale) reference-data listing is never itself the source of truth for those checks | Clarify explicitly that cached reference data (API07) is for browsing/selection only, and submission validation always reads authoritative, non-cached data |
| G1-F13 | Should-fix | Unit Test Cases (lines 583–638) | All test cases are scoped to this spec in isolation; none exercise the handoff to `internal-transfer-approval-chain` (e.g., stage plan consumed correctly) or to `internal-transfer-notifications` (event consumed correctly) | Add cross-spec integration tests covering the request → approval-chain and request → notifications handoffs |
| G1-F14 | Should-fix | Whole spec | BR/AC/Test rows do not consistently cite the BRD-001 open question or business rule they derive from in one place | Add a formal BRD → BR → AC → Test traceability matrix |

_Add rows as needed. Use stable IDs (G1-F01, G1-F02, …) so the spec revision history can
reference them._

---

## Checks Performed

_Complete when the review is done. Each row is Pass / Fail with a note._

| Check | Result |
|---|---|
| **Reviewer ≠ author** | Pass — Abhijit Adhikary ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph** | Pass |
| **Every AC given/when/then and individually IDed** | Pass |
| **API Contract complete — payload, success shape, exception table** | Fail — see G1-F01, G1-F08 |
| **Out-of-scope items explicit** | Pass |
| **Ambiguity — could two engineers build materially different things?** | Fail — see G1-F01–G1-F08 |
| **Constitution compliance** | Should-fix — see G1-F07 (PII classification of employee ID in audit records) |
| **Overlap with an existing spec** | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state** | Pass — this spec has no upstream spec dependency of its own |
| **Security / Architecture sign-off obtained where required** | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous** | Pass — set to Changes Requested below |

---

## Reviewer's Closing Note

Final verdict: Changes Requested. This is the aggregate-owning spec three other specs
depend on, so ambiguity here propagates. Eight items must be fixed before Gate 1 approval:
resolve `PENDING` vs `IN_PROGRESS` stage status across this spec and
`internal-transfer-approval-chain`; define the authoritative request/stage
state-transition contract; clarify whether `SUBMITTED → MANAGER_REVIEW` happens
synchronously within submission or separately; standardize domain event names, especially
`employee.transfer.requested.v1`; define that event's schema; resolve/formally confirm
OQ-11 across all dependent specs; clarify employee-ID/pseudonymous-ID classification for
audit; and define concurrent withdrawal vs. approval behaviour in this aggregate's
contract. Six items are should-fix and recommended before approval but not, on their own,
blocking: a database-level invariant for one non-terminal request per employee; a precise
service-length calculation; clarifying draft assignment data as informational until
submission; clarifying cached reference data vs. authoritative submission validation;
cross-spec integration tests; and a formal BRD → BR → AC → Test traceability matrix.

---

## Outcome

| Field | Value |
|---|---|
| **Outcome** | **Changes Requested** |
| **Spec version after review** | v1.1 — Changes Requested. Author revision **v1.3** resubmitted 2026-09-11 |
| **Date** | 2026-09-09 |
| **Next step if Approved** | Plan may proceed to Gate 1 (plan) review |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits |

_When complete: update `.ai-context/specs/internal-transfer-request.spec.md` status,
`.ai-context/status.md`, and any BRD open questions the review resolves._

---

## Re-review queue — v1.3 (not yet reviewed)

Author revision v1.3 (2026-09-11) responds to G1-F01–G1-F14; the disposition table is in
the spec's own `## Gate 1 Review` section. **No Gate 1 outcome is recorded for v1.3** — it
awaits this reviewer. Four things to weigh when it is picked up:

1. **G1-F03 was decided, not merely clarified, and it removes a published status.**
   Submission is synchronous; `SUBMITTED` is now a history/audit event type, not a request
   status. The asynchronous alternative is written out on the spec so the choice can be
   reversed without rediscovery. Agreeing with this is agreeing to take `SUBMITTED` out of
   the state machine.
2. **G1-F06 is not closed and cannot be closed here.** OQ-11 remains a business decision
   owned by HR Ops and Data Privacy. v1.3 stops treating it as settled and declares the
   spec not Approvable until `BRD.md` confirms or explicitly defers it. Approval-chain has
   the same dependency.
3. **Two states have no producer.** Building the G1-F02 contract showed `DISCARDED` is
   audited but has no endpoint, and `CANCELLED` is defined but no spec transitions a
   request into it. Both are flagged for a scope call rather than filled in with invented
   behaviour.
4. **_Checks Performed_ above is the original v1.1 review** and is left as the reviewer
   wrote it, including the Fail rows that v1.3 claims to address. Those rows are not
   re-ticked here.

**Product 2026-09-11:** OQ-11 and OQ-22 are now Resolved in `BRD.md`; draft-discard is
deferred. Spec version for re-review is **v1.4**. Point 2 above is closed from the
business side.
