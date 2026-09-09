# Gate 1 — Spec Peer Review: `internal-transfer-notifications`

> **This record is for the named human reviewer.** An agent may prepare a first sweep using
> `.agent/workflows/spec-review.md`; it does not sign off here.

## Review Record

| Field | Value |
|---|---|
| Spec under review | `.ai-context/specs/internal-transfer-notifications.spec.md` |
| Version submitted | v1.0 |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikary |
| Security / Architecture (constitution check) | _Pending — name reviewer and date when obtained_ |
| Submitted | 2026-09-07 |
| Outcome | **Changes Requested** (2026-09-09) — 5 Blocker (P0), 5 Should-fix (P1) findings |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. Can be reviewed after
  `internal-transfer-request` (primary dependency). Event rows for approval-chain and
  downstream are unused until those specs emit.
- Product has excluded notifications from the first submit release; that is sequencing,
  not a reason to skip Gate 1 on this draft.
- Dependency check: request spec is **In Peer Review**, not yet Approved.

## Findings

| ID | Severity | Where | Finding | Required change |
|---|---|---|---|---|
| G1-F01 | Blocker (P0) | BR1 (line 63), Notification Matrix (lines 69–86), Open Questions #1 (line 177) | BR1's source cites the BRD framing "on every state transition," but the rule itself and Open Questions #1 ("Matrix is the closed set for v1") restrict notifications to only the seven matrix rows — fulfilment/compensation transitions from `internal-transfer-downstream-orchestration` are not notified at all | Resolve the "every state transition" vs. notification-matrix contradiction: state explicitly that the matrix is the complete, closed set for v1 and that "every state transition" in the BRD means every *matrix* transition, not every possible request/stage transition |
| G1-F02 | Blocker (P0) | Notification Matrix trigger column (lines 73–79) | Domain event names are written inconsistently — some as `name` / `name.v1` pairs (`employee.transfer.requested` / `requested.v1`), some with only a bare name (`employee.transfer.withdrawn` / `withdrawn.v1`), some with only a versioned name (`employee.transfer.stage-pending.v1`, `employee.transfer.rejected.v1`) — it's not clear which is the actual event name the handler subscribes to | Standardize all domain event names and versioning to one consistent naming convention across the matrix and the ACs |
| G1-F03 | Blocker (P0) | API Contract (lines 88–97) | The transactional/outbox/dedupe boundary is left as an open implementation choice ("a notification outbox row committed with the handler's dedupe record, or the handler is the relay of an already-committed domain event — plan chooses") rather than a spec-level decision | Define the transactional/outbox/dedupe boundary as a spec decision, not something deferred to the plan |
| G1-F04 | Blocker (P0) | Notification Matrix dedupe note (lines 84–86), AC6 (lines 128–131) | Idempotency is defined only as "no second notification for the same requestId + template id + recipient id within 24 hours" — there is no recipient-level retry policy (schedule, backoff, max attempts, what happens after the 24-hour idempotency window during a retry storm) | Define recipient-level idempotency and retry behavior precisely: retry schedule/backoff, max attempts, and interaction with the 24-hour dedupe window |
| G1-F05 | Blocker (P0) | Notification Matrix "Permitted payload fields" column (lines 71–79), API Contract (lines 88–97) | The portal → notification-service payload contract is only an informal list of field names per matrix row; there is no formal schema (types, required/optional, envelope shape, template-id contract) for the webhook the notification service receives | Define the portal → notification-service payload contract as a formal schema, not a column of field names |
| G1-F06 | Should-fix (P1) | BR5 (line 67), Notification Matrix HR_VALIDATION row (line 75) | BR5 and the HR_VALIDATION matrix row assume role-based notification (`HR_BUSINESS_PARTNER`) is correct per BRD-001 OQ-11, but OQ-11 (per the BRD, now Gate 1 approved with comment) concerns "pending with" visibility to the *employee*, not who the notification service targets — the read-across is not explicitly confirmed | Explicitly confirm that HR role-based notification targeting is consistent with the resolved/deferred OQ-11 answer, not just cite it as source |
| G1-F07 | Should-fix (P1) | Notification Matrix (lines 69–86), Acceptance Criteria (lines 99–140) | No rule or AC defines behaviour when domain events for the same request arrive out of order (e.g., `stage-pending.v1` for a later stage delivered before an earlier stage's terminal event) | Define behavior for out-of-order events |
| G1-F08 | Should-fix (P1) | Explicitly Out of Scope (lines 163–171) | Fulfilment/approval-chain behaviour is listed as out of scope, but the spec does not explain *why* employees are not notified on a fulfilment failure, which is a meaningful gap for the employee experience | Explicitly document the reasoning for why fulfilment failures don't notify employees, so it reads as a decision rather than an omission |
| G1-F09 | Should-fix (P1) | Unit Test Cases (lines 142–155) | Test cases cover service-unavailable and duplicate-delivery cases, but there is no coverage for malformed/unknown event payloads, missing required fields on a domain event, or negative cases beyond `assigned_party_ref` being null | Add negative/failure/integration test cases beyond the current service-down and duplicate-delivery scenarios |
| G1-F10 | Should-fix (P1) | Whole spec | BR/AC/Test rows do not consistently cite the BRD-001 open question or business rule they derive from in one place | Add a BRD → BR → AC → Test traceability matrix |

---

## Checks Performed

| Check | Result |
|---|---|
| **Reviewer ≠ author** | Pass — Abhijit Adhikary ≠ Alamgir Sarkar |
| **Intent is one unambiguous paragraph** | Pass |
| **Every AC given/when/then and individually IDed** | Pass |
| **API Contract complete — or correctly absent (this feature has no employee HTTP API)** | Fail — see G1-F03, G1-F05 |
| **Out-of-scope items explicit** | Should-fix — see G1-F08 |
| **Ambiguity — could two engineers build materially different things?** | Fail — see G1-F01, G1-F02, G1-F03, G1-F04, G1-F05 |
| **Constitution compliance (especially reason text never in notification payloads)** | Pass — BR2/AC5 explicitly exclude reason text and PII |
| **Overlap with an existing spec** | Pass |
| **Dependency check — Builds-on/Related specs in Approved or Released state** | Fail — `internal-transfer-request` not yet Approved |
| **Security / Architecture sign-off obtained where required** | Pending — not yet obtained |
| **Status updated to Approved or Changes Requested — never left ambiguous** | Pass — set to Changes Requested below |

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

| Field | Value |
|---|---|
| **Outcome** | **Changes Requested** |
| **Spec version after review** | v1.0 — Changes Requested |
| **Date** | 2026-09-09 |
| **Next step if Approved** | Plan drafting may start after request spec is also Approved |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits |

_When complete: update the spec status and `.ai-context/status.md` the same day._
