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
| Version submitted | v1.1; last reviewed v1.4; **author revision v1.5 submitted 2026-09-15** |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikari |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_ |
| Submitted | 2026-09-07 (reconfirmed with full BRD-001 programme submission) |
| Outcome | **Changes Requested** (2026-09-11, v1.4) — 5 Blocker, 5 Nit findings G1-F15–G1-F24. Author disposition for those findings is in v1.5 (below); **re-review outstanding** — this is not a Gate 1 sign-off. Prior round: **Changes Requested** (2026-09-09, v1.1) — 8 Blocker, 6 Should-fix findings, accepted as resolved on 2026-09-11 |

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

### Re-review findings — v1.4, 2026-09-11

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F15 | Blocker | Stage status vocabulary (line 135: "Exactly one stage per request is `IN_PROGRESS` at a time"); Request transitions row for a reported `FAILED` (line 194) | The stage vocabulary asserts an "exactly one" invariant, but the failure/compensation transition row shows the failed stage becoming `FAILED`, earlier stages `COMPENSATION_REQUESTED`, and later stages `CANCELLED` — leaving **zero** stages `IN_PROGRESS`, which the stated invariant forbids | Change the invariant to "at most one" `IN_PROGRESS` stage, and explicitly define the zero-`IN_PROGRESS` state that exists while a request is `FULFILMENT` with a failed/compensating stage |
| G1-F16 | Blocker | Request status vocabulary, `COMPLETED` row (line 113: "confirmed by the employee"); Stage Plan `EMPLOYEE_CONFIRMATION` row (line 230); `internal-transfer-downstream-orchestration` BR7 ("It is not an employee click") | This spec's own status vocabulary describes `COMPLETED` as "confirmed by the employee," and the Stage Plan lists `EMPLOYEE_CONFIRMATION` with assigned role "Employee," but `internal-transfer-downstream-orchestration` BR7 defines that stage as portal-set and explicitly not an employee action — two specs describing the same terminal state with contradictory semantics | Either introduce an actual employee confirmation action (if Product requires one), or correct this spec's terminology (`COMPLETED` row wording, `EMPLOYEE_CONFIRMATION`'s "Employee" role label) to reflect automatic completion/notification, consistent with downstream's BR7 |
| G1-F17 | Blocker | `employee.transfer.requested.v1` payload, `lineManagerRef` (lines 774, 788); `internal-transfer-approval-chain` API03 exceptions (line 243) and AC10 (lines 312–313) | `lineManagerRef` may be `null` at submission (unresolved line manager). Approval-chain's API03 then has no actionable assignee for `MANAGER_RELEASE` and returns 409 `assignee-unresolved` — and AC10 says the stage "stays `IN_PROGRESS`" with no further mechanism defined, so the request is permanently stuck | Define a recovery mechanism for an unresolved line manager (e.g., an HR override, a re-resolution trigger), or prevent submission from entering `MANAGER_REVIEW` until the current line manager is resolved |
| G1-F18 | Blocker | BR13 / OWN-11 (line 93); `internal-transfer-approval-chain` API02/API03 (no `version`/`If-Match`/optimistic-concurrency mechanics anywhere in that spec); `internal-transfer-downstream-orchestration` API01 (same absence) | BR13 declares one monotonic aggregate `version` with optimistic concurrency enforced by "every mutation from any spec," but only this spec's own APIs (API02, API06) actually specify `If-Match`/`version-conflict` mechanics. Neither `internal-transfer-approval-chain`'s decision endpoint (API03) nor `internal-transfer-downstream-orchestration`'s webhook (API01) states how it reads, checks or increments that shared version | Explicitly define the compare-and-swap/optimistic-concurrency enforcement mechanics for every sibling mutation against the shared aggregate version, not only this spec's own APIs |
| G1-F19 | Blocker | Request status vocabulary `FULFILMENT` row (line 112, "Being actioned"); UT76 (line 1138, `pendingWith` null on a `FAILED` stage); `internal-transfer-notifications` OQ-21 (silent on fulfilment failure) | A failed fulfilment stage leaves the request `FULFILMENT` / "Being actioned" with `pendingWith: null`, and the employee is deliberately not notified (OQ-21) — so the status page shows an unchanging, generic "in progress" label with no pending party and no notification, for a state that could persist indefinitely | Define the exact employee-visible behaviour for a failed/compensating fulfilment state (e.g., a distinct status display, an explicit "delayed" indicator, or a defined SLA before escalation) so the status page does not become misleading |
| G1-F20 | Nit | API02 (lines 346–370) | PUT semantics are not stated precisely — whether omitted fields in the payload clear the corresponding draft field or leave it unchanged is not specified | Clarify API02's PUT semantics: full replace vs. partial merge for omitted fields |
| G1-F21 | Nit | BR12 (line 92) | BR12 defines service length as "whole completed calendar months ... inclusive," which is reasonably precise but leaves the day-of-month edge case (e.g., position start on the 31st, effective date in a shorter month) to interpretation | Make the BR2/BR12 month-calculation algorithm fully explicit, including day-of-month edge cases |
| G1-F22 | Nit | API01 (lines 327–330, "it is not the snapshot, it is not frozen"); API01 503 exception (line 342, "the current-assignment snapshot cannot be resolved") | The same API01 section both denies that `currentAssignment` is a snapshot and then calls it "the current-assignment snapshot" two paragraphs later in the exception table | Replace remaining "snapshot" terminology for API01's draft-time read with "informational current-assignment read," consistently, including in the 503 exception condition |
| G1-F23 | Nit | API03 exceptions (line 475, "503 HRIS unavailable") | The only HRIS-failure exception is "unavailable"; a slow HRIS response (timeout) is not distinguished from an outage, and no timeout threshold is stated | Clarify API03's HRIS timeout behaviour: whether a timeout is treated identically to "unavailable," and what threshold applies |
| G1-F24 | Nit | States with no owner — `DISCARDED` (line 213) vs. `CANCELLED` (line 214) | `CANCELLED`'s disposition explicitly says "Confirmed unreachable in v1"; `DISCARDED`'s disposition says "Deferred out of v1 ... Status stays defined" without the same explicit "reserved/unreachable" label, despite being in the same no-producer category | Mark `DISCARDED` explicitly as a reserved/unreachable v1 state, using the same explicit language as `CANCELLED` |

### Author disposition — v1.5, 2026-09-15 (Alamgir Sarkar)

Not a Gate 1 verdict. The dated sign-off stays on the spec after Abhijit Adhikari re-reviews
v1.5. Each G1-F15–G1-F24 required change is answered in
`.ai-context/specs/internal-transfer-request.spec.md` as follows:

| ID | Severity | Addressed in v1.5 by |
|---|---|---|
| G1-F15 | Blocker | Stage invariant is **at most one** `IN_PROGRESS`. Zero-pending rest shape is defined for `FULFILMENT` after `FAILED` / compensation. UT76 |
| G1-F16 | Blocker | `COMPLETED` / `EMPLOYEE_CONFIRMATION` match downstream BR7 (portal-set, not an employee click). Stage Plan role is "Portal (automatic)" |
| G1-F17 | Blocker | **Prevented at submit** (the option that does not invent an HR override). BR15 / AC29: unresolved current line manager or receiving manager → 422 `assignee-unresolved`, stays `DRAFT`. Successful `requested.v1` never emits a null `lineManagerRef` |
| G1-F18 | Blocker | OWN-11 CAS: storage compare-and-swap on every mutation; `If-Match` on this spec's API02/API06 and approval-chain API03; in-transaction expected version on downstream API01. AC30, UT78 |
| G1-F19 | Blocker | BR16: failed/compensating `FULFILMENT` shows "HR is completing this"; `pendingWith.role` `HR_OPERATIONS`, `partyName` null. OQ-21 silence unchanged. UT76 |
| G1-F20 | Nit | API02 is a **full replace** of the five draft content fields; omitted key ≡ `null` (clears). AC2, UT03a |
| G1-F21 | Nit | BR12 last-day-clamp algorithm with start-on-31st examples. AC22, UT62a, UT62b |
| G1-F22 | Nit | API01 draft-time read is "informational current-assignment read", including the 503 row |
| G1-F23 | Nit | HRIS timeout (2 seconds) ≡ unavailable: 503 `reference-data-unavailable`, draft unchanged. AC15, UT77 |
| G1-F24 | Nit | `DISCARDED` labelled **reserved and unreachable in v1**, same explicit language as `CANCELLED` |

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
| **Outcome** | **Approved** (v1.5, 2026-09-15) |
| **Spec version after review** | v1.1 — Changes Requested (2026-09-09); v1.4 — Changes Requested (2026-09-11, findings G1-F15–G1-F24); v1.5 — **Approved** (2026-09-15) |
| **Date** | 2026-09-09 (round 1); 2026-09-11 (round 2); 2026-09-15 (round 3, v1.5 — Approved) |
| **Next step if Approved** | Plan may proceed to Gate 1 (plan) review — **applies now** |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits — not applicable to this outcome |

_When complete: update `.ai-context/specs/internal-transfer-request.spec.md` status,
`.ai-context/status.md`, and any BRD open questions the review resolves._

---

## Re-review — v1.4, 2026-09-11: Changes Requested

Author revision v1.3 (2026-09-11) responded to G1-F01–G1-F14; v1.4 layered Product's
2026-09-11 lock of OQ-11 and OQ-22 on top, with no behaviour change. All fourteen
2026-09-09 findings are accepted as resolved — the disposition table in the spec's own
`## Gate 1 Review` section is confirmed against v1.4, including the synchronous-submission
decision (G1-F03) and OQ-11 now being Resolved rather than open (G1-F06).

This pass went deeper into the contract v1.3 introduced (the _Authoritative State and
Transition Contract_, the shared-fact events, and the cross-spec handoffs it formalized)
and surfaced ten new findings, G1-F15–G1-F24, none of which existed as open items before
v1.3 made the contract explicit enough to check:

1. **G1-F15 is the same category of gap as the original G1-F01/G1-F02** — a vocabulary
   statement ("exactly one" `IN_PROGRESS`) that the spec's own transition table
   contradicts. Building the full transition table is what surfaced it.
2. **G1-F16 is a cross-spec terminology contradiction**, same shape as the original
   `PENDING`/`IN_PROGRESS` finding: this spec and `internal-transfer-downstream-orchestration`
   describe `EMPLOYEE_CONFIRMATION`/`COMPLETED` differently. Downstream's BR7 is correct;
   this spec's own wording is not.
3. **G1-F17 is new since v1.3 formalized OWN-09/notifications AC8's null-handling.**
   Notifications already skips the manager notification gracefully on a null
   `lineManagerRef` (per AC8, cited in this spec's own event field notes); approval-chain
   does not have an equivalent graceful path — it 409s and stops. The inconsistency is
   between the two consuming specs' handling of the same null case.
4. **G1-F18 is scoped to enforcement, not the shared fact itself.** BR13/OWN-11 is correct
   conceptually and this reviewer is not asking for it to be re-litigated — only for the
   two sibling specs' own API contracts to state how they participate in it.
5. **G1-F19 is adjacent to, but distinct from, the original G1-F02/OQ-20 work.** OQ-20
   settled the *business* question (no resume, HR closes out off-portal); this finding is
   about what the *employee* sees on the status page while that is happening.
6. **G1-F20–G1-F24 are Nit-level cleanup**, not blocking on their own, bundled here because
   the same re-review pass found them.

**Verdict: Changes Requested.** Five Blocker findings (G1-F15–G1-F19) must be addressed
before Gate 1 approval. Five Nit findings (G1-F20–G1-F24) are minor cleanup, recommended in
the same revision but not blocking by themselves.

**Product 2026-09-11:** OQ-11 and OQ-22 are now Resolved in `BRD.md`; draft-discard is
deferred. Spec version for re-review is **v1.4**. Point 2 above is closed from the
business side.

### Author revision submitted — v1.5, 2026-09-15

G1-F15–G1-F24 are answered in the spec (see _Author disposition_ above). This does **not**
change the 2026-09-11 verdict. Re-review of v1.5 is outstanding (Abhijit Adhikari).

## Re-review — v1.5, 2026-09-15: Approved

Abhijit Adhikari reviewed manually (chat, not the Artifact dashboard) and confirmed
G1-F15–G1-F24 are resolved as disposed in the spec's _Author response — v1.5_ table.
**Verdict: Approved.** No new findings raised. Sign-off recorded on the spec's own
`## Gate 1 Review` section per governance.
