# Spec: Internal Transfer Notifications

## Spec ID

`internal-transfer-notifications`

## Status

**Draft v1.0** — not submitted to Gate 1. Full state machine in `.ai-context/status.md`.
Do not generate a plan or code from this file until it is **Approved**.

The BRD map allows this spec to proceed once `internal-transfer-request` is **Approved**
(it consumes transitions; it does not need approval-chain or downstream to exist, but
templates for their events are unused until those specs emit). Product has excluded
notifications from the first submit release (`status.md`); that is a delivery sequencing
choice, not a reason to skip this spec.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role | Name | Date |
|---|---|---|
| Author / owner | Alamgir Sarkar | 2026-09-03 |
| Gate 1 reviewer (never the author) | | |
| Gate 2 reviewer | | |

## Intent

When an internal transfer request records a state transition that the employee or an
approver must know about, the portal asks the existing notification service to notify
that person, using the request reference and the role the action is waiting on — never
the transfer reason, never a withdrawal reason, and never another employee's contact
details. A failed or delayed notification does not change request status, stages or
audit. This spec does not open a new inbox UI, does not make approval decisions, and
does not fulfil downstream systems.

## Context

- Builds on: `.ai-context/architecture.md` — Notification service row in *Integration
  Points* (HTTPS webhook, async; loss does not affect request state)
- Constitution: `.ai-context/constitution.md` — PII and free-text narrative must not
  appear in notification payloads; events via outbox
- Related: `.ai-context/specs/internal-transfer-request.spec.md` — **In Peer Review**.
  Emits `employee.transfer.requested` and `employee.transfer.withdrawn`
- Related: `.ai-context/specs/internal-transfer-approval-chain.spec.md` — **Draft v1.0**.
  Emits `employee.transfer.stage-pending.v1`, `employee.transfer.rejected.v1`,
  `employee.transfer.approved.v1`
- Related: `.ai-context/specs/internal-transfer-downstream-orchestration.spec.md` —
  **Draft v1.0**. Emits `employee.transfer.completed.v1` and stage-failure (no employee
  mail required on compensate beyond the employee COMPLETED/not-completed view)
- API contract consumed: existing notification-service webhook (platform). This spec
  does not define that service's internals
- Design: no new screen; copy lives in notification templates owned by Product

## Business Rules

| Rule ID | Rule | Source | Business or technical decision |
|---|---|---|---|
| `internal-transfer-notifications.BR1` | Every request status transition listed in the Notification Matrix produces exactly one notification request per recipient row, via the notification service. | BRD-001 spec map ("on every state transition") | Business |
| `internal-transfer-notifications.BR2` | Notification payloads must not contain `reason`, `withdrawalReason`, legal name of anyone but the recipient's own (if the platform already knows it), contact details harvested from the transfer record, or other constitution PII. Reference number and stage/role codes are permitted. | Constitution Security Posture; BRD-001 OQ-12 | Business + Technical |
| `internal-transfer-notifications.BR3` | Notification failure or delay must not change `transfer_request` status, stages or audit. | Architecture *Integration Points*; constitution degradation | Technical |
| `internal-transfer-notifications.BR4` | English only. No second locale. | BRD-001 OQ-18 | Business |
| `internal-transfer-notifications.BR5` | Recipients are resolved from token-quality identifiers already on the aggregate: owning `employee_id`; manager `assigned_party_ref`; HR as role `HR_BUSINESS_PARTNER` (fan-out is the notification service's directory lookup for that role, not a name list in this spec). | BRD-001 OQ-11 | Technical enforcement |

## Notification Matrix

| Trigger (domain event) | Recipient | Template id | Permitted payload fields |
|---|---|---|---|
| `employee.transfer.requested` / requested.v1 | Owning employee | `itr.employee.submitted` | `referenceNo`, `requestId` |
| `employee.transfer.requested` / requested.v1 | Current line manager (`MANAGER_RELEASE.assigned_party_ref`) | `itr.approver.pending` | `referenceNo`, `requestId`, `stageCode=MANAGER_RELEASE`, `assignedRole` |
| `employee.transfer.stage-pending.v1` | Assignee of that stage; for `HR_VALIDATION`, the HR_BUSINESS_PARTNER role | `itr.approver.pending` | `referenceNo`, `requestId`, `stageCode`, `assignedRole` |
| `employee.transfer.withdrawn` / withdrawn.v1 | Owning employee | `itr.employee.withdrawn` | `referenceNo`, `requestId` |
| `employee.transfer.rejected.v1` | Owning employee | `itr.employee.rejected` | `referenceNo`, `requestId` |
| `employee.transfer.approved.v1` | Owning employee | `itr.employee.hr-approved` | `referenceNo`, `requestId` |
| `employee.transfer.completed.v1` | Owning employee | `itr.employee.completed` | `referenceNo`, `requestId` |

No row includes reason text. No row notifies Payroll, IT or Facilities (they consume
fulfilment webhooks, not this spec).

Duplicate deliveries from at-least-once outbox must not produce a second notification
for the same `requestId` + template id + recipient id within 24 hours (idempotent
enqueue to the notification service).

## API Contract

This spec exposes **no** public employee API. It consumes domain outbox events and
enqueues an outbound notification-service webhook through the **same** transactional
outbox pattern (a notification outbox row committed with the handler's dedupe record,
or the handler is the relay of an already-committed domain event — plan chooses; the
guarantee is BR3 and idempotent enqueue).

If the notification service is unreachable, the notification outbox row remains
unpublished and retries; the domain aggregate is not rolled back.

## Acceptance Criteria

1. `internal-transfer-notifications.AC1` — Given `employee.transfer.requested` is
   committed, when the notification handler runs, then one notification is requested for
   the owning employee (`itr.employee.submitted`) and one for
   `MANAGER_RELEASE.assigned_party_ref` (`itr.approver.pending`), each payload limited to
   the matrix fields, and the request row remains `SUBMITTED` even if the notification
   service returns 5xx.

2. `internal-transfer-notifications.AC2` — Given `employee.transfer.stage-pending.v1`
   for `MANAGER_ACCEPT`, when the handler runs, then only the receiving manager's
   `assigned_party_ref` is notified with `itr.approver.pending` — not the line manager
   again, not the employee.

3. `internal-transfer-notifications.AC3` — Given `employee.transfer.stage-pending.v1`
   for `HR_VALIDATION`, when the handler runs, then the notification service is called
   with recipient type `role` = `HR_BUSINESS_PARTNER` (not a list of names minted here)
   and payload fields from the matrix only.

4. `internal-transfer-notifications.AC4` — Given `withdrawn`, `rejected.v1`,
   `approved.v1` or `completed.v1`, when the handler runs, then the owning employee
   receives the matching template and no manager is notified on withdrawn/rejected
   unless they still have an incomplete approval stage (they do not: those events are
   terminal for approval).

5. `internal-transfer-notifications.AC5` — Given any notification payload, when it is
   inspected, then it has no `reason`, `withdrawalReason`, `reasonCiphertext` or
   equivalent key, and logs of the handler contain none of that text.

6. `internal-transfer-notifications.AC6` — Given the same domain event is delivered to
   the handler twice (at-least-once), when the second delivery runs, then the
   notification service is not given a second enqueue for the same
   `requestId` + template id + recipient within 24 hours.

7. `internal-transfer-notifications.AC7` — Given the notification service is down, when
   the handler cannot publish, then request status, stages and audit are unchanged and
   the unpublished notification outbox row is retained for retry.

8. `internal-transfer-notifications.AC8` — Given `MANAGER_RELEASE.assigned_party_ref` is
   null on submit, when AC1 runs, then the employee still receives
   `itr.employee.submitted` and the manager pending notification is skipped (not
   sent to a guessed person); no 5xx is raised to the employee submit path.

## Unit Test Cases (spec-derived)

| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| `internal-transfer-notifications.UT01` | AC1 | Requested event | Two notification outbox/enqueue rows: employee submitted, line manager pending |
| `internal-transfer-notifications.UT02` | AC1 | Notification service 503 | Request still `SUBMITTED`; notification row unpublished |
| `internal-transfer-notifications.UT03` | AC2 | Stage-pending `MANAGER_ACCEPT` | Exactly one pending notify to receiving manager ref |
| `internal-transfer-notifications.UT04` | AC3 | Stage-pending `HR_VALIDATION` | Recipient is role `HR_BUSINESS_PARTNER`; payload has no names array |
| `internal-transfer-notifications.UT05` | AC4 | Rejected.v1 | One employee `itr.employee.rejected`; zero manager pending |
| `internal-transfer-notifications.UT06` | AC4 | Completed.v1 | One employee `itr.employee.completed` |
| `internal-transfer-notifications.UT07` | AC5 | Submitted event from a request that has reason text | Notification payload JSON has no reason key; logs have no reason substring |
| `internal-transfer-notifications.UT08` | AC6 | Handler invoked twice for one requested event | Notification service enqueue count remains 2 (employee + manager), not 4 |
| `internal-transfer-notifications.UT09` | AC7 | Relay crash after domain commit | Aggregate unchanged; notification retryable |
| `internal-transfer-notifications.UT10` | AC8 | `assigned_party_ref` null | Employee notified; no manager notify; no throw into submit |

## Surfaces

No new portal screen. Delivery uses the existing notification service (in-portal and/or
email as that platform already does). Template wording is Product-owned and is not
specified here beyond template ids in the matrix.

## Explicitly Out of Scope

- In-portal status and pending-with — `internal-transfer-request` (KD-05).
- Approval or fulfilment behaviour.
- SMS, native push, or a second locale (OQ-18, OQ-19).
- Notifying Payroll, IT or Facilities (fulfilment webhooks).
- Digest/batching, user notification preferences, or unsubscribe (not in BRD-001).
- Including confirmed effective date, assignment titles or manager names in the payload
  (not required by the BRD; titles/names are PII risk — matrix omits them).

## Open Questions

| # | Question | Owner | Needed by | Resolution |
|---|---|---|---|---|
| 1 | None that change who is notified on the listed transitions or what is forbidden in the payload. | — | — | Matrix is the closed set for v1 |

Copy for each template id is Product's, outside this spec. A plan must not invent
legal-sounding HR prose in code; it references the template id.

## Assumptions

- A1 — The portal notification service already authenticates employees and can address
  an employee id and a role. If false: AS-03 in the BRD; this spec cannot ship.
- A2 — Domain events listed in the matrix will be emitted by the sibling specs under
  those names. If a name changes, this matrix is updated in the same change.
- A3 — "Every state transition" in the BRD map means the matrix rows, not draft
  autosave. Draft create/update is silent. If Product wants draft reminders, a new row
  is added before Approved.

## Non-Functional Constraints (from constitution.md)

- Notification enqueue is not on the employee submit p95 budget if it is relayed from
  the outbox after commit (BR3). If a plan puts it in the submit transaction, submit
  must still meet p95 < 700 ms and must still succeed when the notification service is
  down (AC7 forbids coupling).
- 99.9% availability applies to the request path, not to notification delivery.
- No PII in logs or notification payloads (AC5).
- Events / notification requests via transactional outbox, not a fire-and-forget HTTP
  call inside the submit/approve handler unless that call cannot fail the domain
  transaction (AC7).
- WCAG does not add a new screen here.

## Revision History

| Version | Date | Change | Driver |
|---|---|---|---|
| v1.0 | 2026-09-03 | Initial draft | BRD-001 |
