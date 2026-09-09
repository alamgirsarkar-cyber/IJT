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
| Outcome                                      | _**Approved** or **Changes Requested** — fill when review is complete_ |

## Submission notes for the reviewer

- Submitted together with the other BRD-001 specs. Can be reviewed after
  `internal-transfer-request` (primary dependency). Event rows for approval-chain and
  downstream are unused until those specs emit.
- Product has excluded notifications from the first submit release; that is sequencing,
  not a reason to skip Gate 1 on this draft.
- Dependency check: request spec is **In Peer Review**, not yet Approved.

## Findings

| ID     | Severity | Where | Finding | Required change |
| ------ | -------- | ----- | ------- | --------------- |
| G1-F01 |          |       |         |                 |
|        |          |       |         |                 |

---

## Checks Performed

| Check                                                                                   | Result |
| --------------------------------------------------------------------------------------- | ------ |
| **Reviewer ≠ author**                                                                   |        |
| **Intent is one unambiguous paragraph**                                                 |        |
| **Every AC given/when/then and individually IDed**                                      |        |
| **API Contract complete — or correctly absent (this feature has no employee HTTP API)** |        |
| **Out-of-scope items explicit**                                                         |        |
| **Ambiguity — could two engineers build materially different things?**                  |        |
| **Constitution compliance (especially reason text never in notification payloads)**     |        |
| **Overlap with an existing spec**                                                       |        |
| **Dependency check — Builds-on/Related specs in Approved or Released state**            |        |
| **Security / Architecture sign-off obtained where required**                            |        |
| **Status updated to Approved or Changes Requested — never left ambiguous**              |        |

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
| **Outcome**                        | _**Approved** / **Changes Requested**_                      |
| **Spec version after review**      |                                                             |
| **Date**                           |                                                             |
| **Next step if Approved**          | Plan drafting may start after request spec is also Approved |
| **Next step if Changes Requested** | Author revises spec, bumps version, resubmits               |

_When complete: update the spec status and `.ai-context/status.md` the same day._
