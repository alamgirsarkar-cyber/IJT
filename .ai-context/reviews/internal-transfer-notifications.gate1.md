# Gate 1 — Spec Peer Review: `internal-transfer-notifications`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here. The dated verdict is written
> as `## Gate 1 Review` on the spec per `.agent/rules/governance.md` — this worksheet is
> findings, not the sign-off.

## Review Record

| Field                                        | Value                                                                  |
| -------------------------------------------- | ---------------------------------------------------------------------- |
| Spec under review                            | `.ai-context/specs/internal-transfer-notifications.spec.md`            |
| Version submitted                            | v1.0                                                                   |
| Author                                       | Alamgir Sarkar                                                         |
| **Reviewer (not the author)**                | Abhijit Adhikari                                                       |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_                       |
| Submitted                                    | 2026-09-07                                                             |
| Outcome                                      | **Approved** (2026-09-11, v1.3) — was **Changes Requested** (2026-09-09, v1.0)                |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. Can be reviewed after
  `internal-transfer-request` (primary dependency). Event rows for approval-chain and
  downstream are unused until those specs emit.
- Product has excluded notifications from the first submit release; that is sequencing,
  not a reason to skip Gate 1 on this draft.
- Dependency check: request spec is **In Peer Review**, not yet Approved.

## Findings

> The ten rows below **transcribe** the ten items the reviewer enumerated in the closing
> note of 2026-09-09, giving each a stable ID so spec revisions can cite it. No finding is
> added beyond that note, and none is reworded into a stronger claim than it makes.
> _Author disposition of every row is recorded in the spec's own `## Gate 1 Review`
> section, not here — this file stays the reviewer's record._

| ID     | Severity | Where | Finding | Required change |
| ------ | -------- | ----- | ------- | --------------- |
| G1-F01 | P0       | BR1 vs Notification Matrix; Assumption A3 | BR1's source is the BRD spec map's "on every state transition", but the matrix covers a subset of transitions, and A3 resolves the gap in an assumption rather than in the rule. Nothing says which transitions are deliberately silent or why | Resolve the "every state transition" versus notification-matrix contradiction |
| G1-F02 | P0       | Notification Matrix rows 1 and 4; Context | The same event is written two ways in one table (`employee.transfer.requested` / `requested.v1`), and sibling specs are inconsistent about the `.v1` suffix, so a handler cannot be built from the matrix as written | Standardise all domain event names and versioning |
| G1-F03 | P0       | API Contract | The transactional boundary is explicitly deferred — "plan chooses" between committing the notification row with the handler's dedupe record and relaying an already-committed domain event. The two have different failure semantics, so this is a spec decision | Define the transactional / outbox / dedupe boundary as a spec decision, not a plan-time choice |
| G1-F04 | P0       | Notification Matrix note; AC6 | Idempotency is one line keyed on `requestId` + template + recipient over 24 hours, with no statement of what enforces it, and retry behaviour after repeated failure is undefined | Define recipient-level idempotency and retry behaviour |
| G1-F05 | P0       | API Contract; Notification Matrix | "Permitted payload fields" names field lists but no schema — no envelope, no types, no recipient representation, and no definition of how the notification service's response is interpreted | Define the portal → notification-service payload contract as a formal schema |
| G1-F06 | P1       | BR5 | BR5 cites BRD-001 OQ-11 as its source, but OQ-11 is only "Approved with comment" pending confirm-or-defer, leaving role-based HR notification resting on an unresolved item | Explicitly confirm HR role-based notification against OQ-11 |
| G1-F07 | P1       | AC1–AC4; API Contract | At-least-once delivery is acknowledged but out-of-order delivery is not. Nothing says what happens when a stage-pending event is handled after the request has moved on | Define behaviour for out-of-order events |
| G1-F08 | P1       | Context; Notification Matrix | The matrix has no fulfilment-failure row and the Context line asserts "no employee mail required on compensate" without reasoning, so a reader cannot tell whether the silence is a decision or an oversight | Document why fulfilment failures don't notify employees |
| G1-F09 | P1       | Unit Test Cases (UT01–UT10) | Tests are happy path plus one 503. No permanent-failure case, no retry exhaustion, no concurrency, no out-of-order case and no integration coverage against a notification-service double | Add negative / failure / integration test cases |
| G1-F10 | P1       | Business Rules; Acceptance Criteria; Unit Test Cases | Rules, ACs and tests do not consistently cite the BRD-001 item, shared fact or constitution line they derive from | Add a BRD → BR → AC → Test traceability matrix |

---

## Checks Performed

| Check                                                                                   | Result |
| --------------------------------------------------------------------------------------- | ------ |
| **Reviewer ≠ author**                                                                   | Pass — Abhijit Adhikary ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph**                                                 | Pass |
| **Every AC given/when/then and individually IDed**                                      | Pass — AC1–AC16 |
| **API Contract complete — or correctly absent (this feature has no employee HTTP API)** | Pass — G1-F03/F04/F05 addressed with the dispatch boundary, idempotency/retry section and payload schema |
| **Out-of-scope items explicit**                                                         | Pass |
| **Ambiguity — could two engineers build materially different things?**                  | Pass — G1-F01/F02 closed by the rewritten BR1, Transition coverage inventory and shared OWN-09 naming |
| **Constitution compliance (especially reason text never in notification payloads)**     | Pass |
| **Overlap with an existing spec**                                                       | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state**            | Fail — `internal-transfer-request` not yet Approved; noted as an outstanding programme-level risk, not a reason to withhold this spec's own approval |
| **Security / Architecture sign-off obtained where required**                            | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous**              | Pass — set to Approved below |

---

## Reviewer's Closing Note

Final verdict: Changes Requested. Five P0 items must be fixed before Gate 1 approval:
resolve the "every state transition" vs. notification-matrix contradiction; standardize all
domain event names and versioning; define the transactional/outbox/dedupe boundary as a
spec decision rather than a plan-time choice; define recipient-level idempotency and retry
behavior; and define the portal → notification-service payload contract as a formal schema.
Five P1 items are recommended but not, on their own, blocking: explicitly confirm HR
role-based notification against OQ-11; define behavior for out-of-order events; document why
fulfilment failures don't notify employees; add negative/failure/integration test cases; and
add a BRD → BR → AC → Test traceability matrix.

---

## Outcome

| Field                              | Value                                                       |
| ---------------------------------- | ----------------------------------------------------------- |
| **Outcome**                        | **Approved**                                                 |
| **Spec version after review**      | v1.0 — Changes Requested (2026-09-09); v1.3 — **Approved** (2026-09-11) |
| **Date**                           | 2026-09-09 (Changes Requested); 2026-09-11 (Approved)        |
| **Next step if Approved**          | Plan drafting may proceed. Outstanding risk: `internal-transfer-request` not yet Approved — track at programme level |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits               |

_When complete: update the spec status and `.ai-context/status.md` the same day._

---

## Re-review — v1.3, 2026-09-11: Approved

Author revision v1.2 (2026-09-11) responded to G1-F01–G1-F10; disposition table is in the
spec's own `## Gate 1 Review` section. v1.3 layered Product's 2026-09-11 lock of BRD-001
OQ-21 on top with no behaviour change.

1. **G1-F02 is closed end to end, across two specs.** The naming convention is shared fact
   OWN-09 and this spec uses only the canonical `.v1` forms; `internal-transfer-request`'s
   v1.3 adopted the same convention the same day under its own G1-F04, so all four specs
   now agree.
2. **G1-F08 / OQ-21 — now fully closed.** Product confirmed on 2026-09-11 that employees are
   not notified on a fulfilment failure for v1; AC15 asserts the v1 silence.
3. **G1-F01 surfaced an adjacent gap, noted rather than treated as a defect:**
   `CANCELLED` appears in the request state machine but no spec transitions a request into
   it, so v1 has no cancellation path at all. Recorded in _Transition coverage_; not a
   blocker for this spec.
4. **_Checks Performed_ above is now filled in** — see the Dependency check row for the one
   remaining Fail, carried as a non-blocking programme-level risk rather than a spec defect.

**Verdict: Approved.**
