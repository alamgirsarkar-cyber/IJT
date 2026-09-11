# Spec: Internal Transfer Notifications

## Spec ID

`internal-transfer-notifications`

## Status

**In Peer Review (Gate 1)** — Draft v1.3. Gate 1 **Changes Requested** (2026-09-09) was
answered in v1.2; v1.3 records Product's 2026-09-11 lock of BRD-001 **OQ-21** (no employee
notification on fulfilment failure). Full state machine in `.ai-context/status.md`.
Do not generate a plan or code until **Approved**.

**Reviewer note:** v1.2 answered all five P0 and five P1 findings. OQ-21 is now **Resolved**
— silent to the employee; the status page is the progress view. Finding-by-finding
disposition is in _Gate 1 Review_ at the end of this file. Primary dependency remains
`internal-transfer-request`; Product may still sequence implementation after the first
submit release.

## Linked BRD

`.ai-context/BRD.md#brd-001-employee-internal-transfer-digital-journey`

## Owner / Reviewer

| Role                               | Name             | Date                           |
| ---------------------------------- | ---------------- | ------------------------------ |
| Author / owner                     | Alamgir Sarkar   | 2026-09-03                     |
| Gate 1 reviewer (never the author) | Abhijit Adhikari | 2026-09-09 — **Changes Requested** on v1.1; v1.3 not yet reviewed |
| Gate 2 reviewer                    | Tapas Dutta      | —                              |

Gate 1 sign-off is a dated `## Gate 1 Review` block on this spec (`.agent/rules/governance.md`). Findings worksheet: `.ai-context/reviews/internal-transfer-notifications.gate1.md`.

## Intent

When an internal transfer request records a state transition that the employee or an
approver must know about, the portal asks the existing notification service to notify
that person, using the request reference and the role the action is waiting on — never
the transfer reason, never a withdrawal reason, and never another employee's contact
details. A failed or delayed notification does not change request status, stages or
audit. This spec does not open a new inbox UI, does not make approval decisions, and
does not fulfil downstream systems.

## Context

- Builds on: `.ai-context/architecture.md` — Notification service row in _Integration
  Points_ (HTTPS webhook, async; loss does not affect request state);
  _Authentication and Authorisation_
- Constitution: `.ai-context/constitution.md` — PII and free-text narrative must not
  appear in notification payloads; events via outbox
- Related: `.ai-context/specs/internal-transfer-request.spec.md` — **In Peer Review
  (Draft v1.3)**. Owns the request aggregate, the stage plan and the authoritative state
  and transition contract this spec reacts to (OWN-10). Emits
  `employee.transfer.requested.v1` and `employee.transfer.withdrawn.v1`, both OWN-09
  compliant and both with a defined payload schema since its v1.3
- Related: `.ai-context/specs/internal-transfer-approval-chain.spec.md` — **In Peer Review**.
  Emits `employee.transfer.stage-pending.v1`, `employee.transfer.rejected.v1`,
  `employee.transfer.approved.v1`
- Related: `.ai-context/specs/internal-transfer-downstream-orchestration.spec.md` —
  **In Peer Review (Draft v1.2)**. Emits `employee.transfer.fulfilment-stage.v1`,
  `employee.transfer.fulfilment-failed.v1`, `employee.transfer.compensate.v1` and
  `employee.transfer.completed.v1`. Of those, only `completed.v1` notifies anyone in v1 —
  the reasoning is in _Transition coverage_, not left implied
- Shared facts: `.ai-context/ownership_index.md` (OWN-01, OWN-04, OWN-05, OWN-07, OWN-08,
  OWN-09)
- API contract consumed: existing notification-service webhook (platform). This spec
  does not define that service's internals
- Design: no new screen; copy lives in notification templates owned by Product

## Business Rules

| Rule ID                               | Rule                                                                                                                                                                                                                                                                                      | Source                                                      | Business or technical decision |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------ |
| `internal-transfer-notifications.BR1` | The **Notification Matrix is the closed set** of events that notify anyone, and each matrix row produces exactly one notification request per recipient. BRD-001's spec-map phrase "on every state transition" is satisfied by the _Transition coverage_ inventory being **complete** — every event any of the four transfer specs emits appears there as either a matrix row or a deliberately silent row with a recorded reason — not by mailing on every transition. A new transition in any sibling spec requires a row in that inventory in the same change. | BRD-001 spec map ("on every state transition"); Gate 1 G1-F01 | Business                       |
| `internal-transfer-notifications.BR2` | Notification payloads must not contain `reason`, `withdrawalReason`, legal name of anyone but the recipient's own (if the platform already knows it), contact details harvested from the transfer record, or other constitution PII. Reference number and stage/role codes are permitted. | Constitution Security Posture; BRD-001 OQ-12; OWN-05        | Business + Technical           |
| `internal-transfer-notifications.BR3` | Notification failure or delay must not change `transfer_request` status, stages or audit.                                                                                                                                                                                                 | Architecture _Integration Points_; constitution degradation | Technical                      |
| `internal-transfer-notifications.BR4` | English only. No second locale.                                                                                                                                                                                                                                                           | BRD-001 OQ-18                                               | Business                       |
| `internal-transfer-notifications.BR5` | Recipients are resolved from token-quality identifiers already on the aggregate: owning `employee_id`; manager `assigned_party_ref`; HR as role `HR_BUSINESS_PARTNER` (fan-out is the notification service's directory lookup for that role, never a name list minted here). **This is governed by OWN-04, not by BRD-001 OQ-11** — see _Transition coverage_ → "Why OQ-11 is not a dependency of this spec". | OWN-04; BRD-001 BR13; Gate 1 G1-F06 | Technical enforcement |
| `internal-transfer-notifications.BR6` | Every event name this spec consumes obeys **OWN-09**: `employee.transfer.<past-tense>.v<major>`, with the version suffix mandatory. This spec uses only the suffixed forms; no alternative or unsuffixed spelling of the same event appears anywhere in it. | OWN-09; Gate 1 G1-F02; request spec G1-F04 | Technical |
| `internal-transfer-notifications.BR7` | **Dispatch boundary, decided here rather than in the plan:** the handler runs *after* the domain event is committed and published, never inside the submit/approve/fulfil transaction. In one transaction of its own it writes the ingress dedupe record and the notification-outbox row; the relay then calls the notification service. Two hops, both outbox-backed. | Gate 1 G1-F03; ADR-0001; constitution (outbox) | Technical |
| `internal-transfer-notifications.BR8` | Idempotency has three keyed layers, tabulated in _Idempotency, ordering and retry_. **Primary — event level:** the domain `eventId` is the ingress key, so any redelivery of the same event is a no-op. **Secondary — recipient level:** `requestId` + `eventType` + `stageCode` + `templateId` + `recipientRef` must not enqueue twice inside 24 hours, enforced by a database unique constraint, not by an application check alone. **Third — egress:** `notificationId` is the platform's idempotency key, so a relay retry is not a second mail. | Gate 1 G1-F04; ADR-0001 (at-least-once) | Technical |
| `internal-transfer-notifications.BR9` | A notification row retries with bounded backoff. On exhausting the bound it becomes `UNDELIVERABLE` and raises an operational alert to the **portal platform team** (the notification service's owner in BRD-001 Dependencies). It is never retried forever, never silently dropped, and never allowed to touch request state (BR3). | Gate 1 G1-F04; BRD-001 Dependencies; constitution degradation | Technical |
| `internal-transfer-notifications.BR10` | Before enqueuing an **action-required** notification (`itr.approver.pending`), the handler re-reads the aggregate and skips the enqueue if that stage is no longer awaiting action or the request has become terminal. A late or out-of-order event must never ask someone to act on something already decided. | Gate 1 G1-F07 | Technical |

## Notification Matrix

Event names below are the canonical OWN-09 forms (BR6). Every trigger carries the `.v1`
suffix; the "`X` / `X.v1`" double spelling that v1.1 used is gone.

| Trigger (domain event)                  | Recipient                                                                   | `recipientRef` sent                       | Template id                | Permitted `data` fields                                                 |
| --------------------------------------- | --------------------------------------------------------------------------- | ----------------------------------------- | -------------------------- | ----------------------------------------------------------------------- |
| `employee.transfer.requested.v1`        | Owning employee                                                             | `employee:<employee_id>`                  | `itr.employee.submitted`   | `referenceNo`, `requestId`                                              |
| `employee.transfer.requested.v1`        | Current line manager (`MANAGER_RELEASE.assigned_party_ref`)                 | `employee:<assigned_party_ref>`           | `itr.approver.pending`     | `referenceNo`, `requestId`, `stageCode=MANAGER_RELEASE`, `assignedRole` |
| `employee.transfer.stage-pending.v1`    | Assignee of that stage; for `HR_VALIDATION`, the `HR_BUSINESS_PARTNER` role | `employee:<ref>` or `role:HR_BUSINESS_PARTNER` | `itr.approver.pending`     | `referenceNo`, `requestId`, `stageCode`, `assignedRole`                 |
| `employee.transfer.withdrawn.v1`        | Owning employee                                                             | `employee:<employee_id>`                  | `itr.employee.withdrawn`   | `referenceNo`, `requestId`                                              |
| `employee.transfer.rejected.v1`         | Owning employee                                                             | `employee:<employee_id>`                  | `itr.employee.rejected`    | `referenceNo`, `requestId`                                              |
| `employee.transfer.approved.v1`         | Owning employee                                                             | `employee:<employee_id>`                  | `itr.employee.hr-approved` | `referenceNo`, `requestId`                                              |
| `employee.transfer.completed.v1`        | Owning employee                                                             | `employee:<employee_id>`                  | `itr.employee.completed`   | `referenceNo`, `requestId`                                              |

No row includes reason text. No row notifies Payroll, IT or Facilities (they consume
fulfilment webhooks, not this spec). `recipientRef` is the dedupe component in BR8 and the
`recipient` block in the API payload; `role:` recipients are expanded by the notification
service's directory, never here.

Duplicate handling is specified in _Idempotency, ordering and retry_ below rather than in a
note here — v1.1's one-line "same `requestId` + template + recipient within 24 hours" rule
was found to suppress a legitimate second notification, and is corrected there.

## Transition coverage

This inventory is what closes G1-F01. It lists **every** event the four transfer specs
emit, so "notify on every state transition" can be checked rather than assumed. A silent
row is a decision with a reason, not an omission.

| Emitted by | Event or transition | Notified? | Why, when silent |
| --- | --- | --- | --- |
| request | Draft created, updated, autosaved | **Silent** | No event is emitted and no one is away from the screen — the employee is in the wizard (A3) |
| request | Draft discarded (`DISCARDED`) | **Silent** | The employee's own action with immediate UI feedback; nobody else ever knew the draft existed |
| request | `employee.transfer.requested.v1` (`DRAFT → MANAGER_REVIEW`) | **Yes** | Matrix rows 1–2 |
| request | ~~`SUBMITTED → MANAGER_REVIEW`~~ | **No such transition** | Removed 2026-09-11. The request spec's v1.3 made submission synchronous (its G1-F03): submit commits straight to `MANAGER_REVIEW` with `MANAGER_RELEASE` already `IN_PROGRESS`, and `SUBMITTED` is now a history event type rather than a status (OWN-10). No approval-chain `stage-pending.v1` fires for stage 1 either, so matrix row 2 — the line-manager notification on `requested.v1` — is what tells the manager, and it does so exactly once |
| request | `employee.transfer.withdrawn.v1` | **Yes** | Matrix row 4. The employee's own action, but a terminal-state acknowledgement is what makes the trail defensible |
| approval-chain | `employee.transfer.stage-pending.v1` (`MANAGER_ACCEPT`, `HR_VALIDATION`) | **Yes** | Matrix row 3 — the only action-required template |
| approval-chain | `employee.transfer.rejected.v1` | **Yes** | Matrix row 5 |
| approval-chain | `employee.transfer.approved.v1` (`→ FULFILMENT`) | **Yes** | Matrix row 6 |
| downstream | `employee.transfer.fulfilment-stage.v1` | **Silent** | A back-office step with nothing for the employee or an approver to do. Per-stage mail would be pure noise, and KD-05 already gives the employee the status page for progress |
| downstream | `employee.transfer.fulfilment-failed.v1` | **Silent to the employee in v1** | HR Operations owns closing a failed fulfilment out off-portal (OWN-08). A "something went wrong" mail the employee cannot act on adds worry without a next step. **Confirmed Product 2026-09-11 — BRD-001 OQ-21 Resolved** |
| downstream | `employee.transfer.compensate.v1` | **Silent** | Addressed to a downstream system, not a person; the employee-visible consequence is covered by the failure row above |
| downstream | `employee.transfer.completed.v1` | **Yes** | Matrix row 7 — BRD-001 journey stage 8 |
| — | `CANCELLED` at request level | **No row, and none needed in v1** | The request state machine lists `CANCELLED`, but **no spec transitions a request into it**: HR cancellation after fulfilment begins is out of scope in both downstream and approval-chain (BRD-001 OQ-06 makes it an HR action outside the portal). If a later spec adds HR cancellation it adds a matrix row here in the same change (BR1) |

### Why OQ-11 is not a dependency of this spec

G1-F06 asked for an explicit confirmation, so: **confirmed, and the dependency does not
exist.** BRD-001 OQ-11 governs *disclosure* — whether the employee, looking at
"pending with", sees a named person or only a role. This spec never discloses a person to
anyone: the matrix carries no name field for any recipient (BR2), and HR is addressed as
`role:HR_BUSINESS_PARTNER` under OWN-04 and BRD-001 BR13, which are settled. So OQ-11's
outcome, either way, changes nothing here. v1.1's BR5 cited OQ-11 as its source, which
implied a dependency that was never real; BR5 now cites OWN-04.

## Event naming and versioning

Recorded as shared fact **OWN-09** so it is stated once for the whole programme rather than
four times inconsistently. Every domain event in this journey is
`employee.transfer.<past-tense-verb>.v<major>`; the version suffix is **mandatory**, and a
breaking payload change means a new suffix, never an in-place edit (constitution —
Versioning Rules).

| Canonical name | Emitted by |
| --- | --- |
| `employee.transfer.requested.v1` | `internal-transfer-request` |
| `employee.transfer.withdrawn.v1` | `internal-transfer-request` |
| `employee.transfer.stage-pending.v1` | `internal-transfer-approval-chain` |
| `employee.transfer.rejected.v1` | `internal-transfer-approval-chain` |
| `employee.transfer.approved.v1` | `internal-transfer-approval-chain` |
| `employee.transfer.fulfilment-stage.v1` | `internal-transfer-downstream-orchestration` |
| `employee.transfer.fulfilment-failed.v1` | `internal-transfer-downstream-orchestration` |
| `employee.transfer.compensate.v1` | `internal-transfer-downstream-orchestration` |
| `employee.transfer.completed.v1` | `internal-transfer-downstream-orchestration` |

**Divergence closed 2026-09-11.** When v1.2 was written, `internal-transfer-request` still
emitted `employee.transfer.requested` and `employee.transfer.withdrawn` unsuffixed, and
this spec recorded that as a release blocker rather than quietly accepting two spellings.
That spec's v1.3 adopted the suffix under its own G1-F04, so all four specs now agree.
AC16 stays as written: it is the guard that made the mismatch fail loudly, and it is worth
keeping against the next divergence.

## Authentication and Authorisation

Cites BRD-001 KD-07 and `.ai-context/architecture.md` — _Authentication and Authorisation_.
This spec exposes **no** public employee, manager or HR HTTP API and does not add login.

| Concern | Rule on this spec |
| --- | --- |
| Employee / approver AuthN | Not used on a new endpoint here. Recipients are already-authenticated portal users addressed by employee id or role already stored on the aggregate (BR5). |
| Notification service | Platform webhook authentication already in use (AS-03). This spec does not introduce a second credential scheme. |
| Authorisation of content | Payload matrix is the allow-list. Reason text, names and contact details are forbidden regardless of who could theoretically read a mail. |
| Inbox UI | Not added. Approvers act through the approval-chain screens, which use OIDC. |

## API Contract

This spec exposes **no** public employee API. It consumes domain events and calls the
existing notification-service webhook.

### Dispatch boundary — decided, not deferred to the plan

v1.1 offered the plan a choice ("plan chooses"). G1-F03 was right that this is a spec
decision: the two options have different failure semantics, so leaving it open means two
engineers build materially different systems. The decision (BR7):

```
domain transaction                     ── commits status change + domain outbox row
        │                                  (owned by request / approval-chain / downstream)
        ▼
domain outbox relay                    ── publishes the committed domain event
        │
        ▼
notification handler  ── one transaction: ingress dedupe record (domain eventId)
        │                               + notification_dispatch row(s), status PENDING
        ▼
notification relay                     ── POSTs to the notification service, bounded retry
        │
        ▼
notification service (platform)        ── delivers in-portal / email
```

Three consequences, all testable:

- The handler runs **after** the domain commit, never inside it. No notification work can
  fail, slow or roll back a submit, an approval or a fulfilment report (BR3, BR7, AC7).
- The handler's own write is still transactional, so a dedupe record without its dispatch
  rows — or dispatch rows without their dedupe record — cannot exist.
- Only the relay talks to the platform. Nothing in this spec makes an outbound HTTP call
  from inside a request handler.

### Portal → notification service payload

The formal schema G1-F05 asked for. This is the **portal's side** of an existing platform
contract — the notification service's own internals stay out of scope, and A4 records what
happens if the platform's schema turns out to differ.

```json
{
  "notificationId": "uuid",
  "templateId": "itr.approver.pending",
  "recipient": { "type": "EMPLOYEE", "ref": "employee:<employee_id>" },
  "locale": "en",
  "correlationId": "uuid",
  "sourceEventId": "uuid",
  "data": {
    "referenceNo": "ITR-2026-000123",
    "requestId": "uuid",
    "stageCode": "MANAGER_RELEASE",
    "assignedRole": "LINE_MANAGER"
  }
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `notificationId` | UUID | Yes | Identifies this dispatch; the platform's idempotency key, so a relay retry is not a second mail |
| `templateId` | Enum — the six `itr.*` ids in the matrix | Yes | Copy is Product's, held in the template. The portal never sends prose |
| `recipient.type` | Enum `EMPLOYEE` \| `ROLE` | Yes | `ROLE` fan-out is the platform's directory lookup (BR5) |
| `recipient.ref` | String `employee:<id>` or `role:<ROLE>` | Yes | Exactly the `recipientRef` in the matrix. An email address is never sent — the portal does not hold one for this purpose |
| `locale` | String, always `en` | Yes | BR4. Present so a second locale is additive later |
| `correlationId` | UUID | Yes | Propagated from the domain event, so a mail can be traced to the transition that caused it |
| `sourceEventId` | UUID | Yes | The domain `eventId` (BR8 primary key) — makes the trail auditable in both directions |
| `data` | Object | Yes | **Allow-list**, restricted to that matrix row's permitted fields. A key outside the row's list is a defect, not a warning (AC5, AC11) |

**Response handling** — required so retry behaviour is not invented per environment:

| Platform response | Portal behaviour |
| --- | --- |
| 2xx | Dispatch `SENT`. Delivery beyond this point is the platform's business (BR3) |
| 4xx other than 429 | Permanent. Dispatch `UNDELIVERABLE`, alert raised, **no retry** — retrying a rejected payload just repeats the defect |
| 429, 5xx, timeout, connection failure | Transient. Retry with bounded backoff per BR9 |

If the notification service is unreachable, the dispatch row stays `PENDING` and retries;
the domain aggregate is never rolled back.

## Idempotency, ordering and retry

### Three idempotency layers, and why v1.1's single rule was wrong

| Layer | Key | Guarantees |
| --- | --- | --- |
| Ingress (primary) | Domain `eventId` | One handling per domain event. An at-least-once redelivery of the same event enqueues nothing further |
| Enqueue (secondary) | `requestId` + `eventType` + `stageCode` + `templateId` + `recipientRef`, 24-hour window | One mail per recipient per fact, even if two distinct events describe the same fact |
| Relay → platform | `notificationId` | A relay retry after an ambiguous failure is not a second mail |

v1.1's rule keyed only on `requestId` + template + recipient. That silently suppresses a
**legitimate** notification: where one person is both the releasing and the receiving
manager, they must get `itr.approver.pending` twice — once for `MANAGER_RELEASE`, once for
`MANAGER_ACCEPT` — and the old key would have dropped the second. Adding `eventType` and
`stageCode` fixes it, and making the domain `eventId` the primary key means correctness no
longer depends on the window at all. The secondary key is enforced by a **database unique
constraint**, not an application check, because the constraint is what survives two workers
racing — "the constraints we rely on are database constraints" (constitution, Testing
Discipline). Idempotency records live in the same SQLite datastore the constitution already
names for them; no new datastore.

### Ordering

The handler is stateless per event and does **not** buffer or reorder. Each event is
evaluated on its own against the current aggregate:

- **Action-required notifications are guarded** (BR10). Before enqueuing
  `itr.approver.pending`, the handler re-reads the request: if that stage is no longer
  awaiting action, or the request is terminal, the enqueue is skipped and the skip is
  recorded. A `stage-pending.v1` that arrives after the request was rejected must never
  ask a manager to approve it.
- **Informational notifications are not guarded.** `withdrawn`, `rejected`, `approved` and
  `completed` describe facts that stay true, so a late delivery is still accurate and is
  sent.
- **Out-of-order arrival is never "fixed" by inventing the missing event.** If
  `approved.v1` is handled before a `stage-pending.v1` that preceded it, the pending mail
  is skipped by the guard above; the portal does not synthesise the notification it thinks
  it missed.

### Retry and terminal failure

Bounded backoff per BR9, then `UNDELIVERABLE` plus an operational alert to the portal
platform team. No notification is retried indefinitely, none is silently dropped, and in
every case request status, stages and audit are untouched (BR3).

## Acceptance Criteria

1. `internal-transfer-notifications.AC1` — Given `employee.transfer.requested.v1` is
   committed and published, when the notification handler runs, then one notification is requested for
   the owning employee (`itr.employee.submitted`) and one for
   `MANAGER_RELEASE.assigned_party_ref` (`itr.approver.pending`), each payload limited to
   the matrix fields, and the request row remains `MANAGER_REVIEW` — the status a
   successful submit commits (OWN-10) — even if the notification service returns 5xx.

2. `internal-transfer-notifications.AC2` — Given `employee.transfer.stage-pending.v1`
   for `MANAGER_ACCEPT`, when the handler runs, then only the receiving manager's
   `assigned_party_ref` is notified with `itr.approver.pending` — not the line manager
   again, not the employee.

3. `internal-transfer-notifications.AC3` — Given `employee.transfer.stage-pending.v1`
   for `HR_VALIDATION`, when the handler runs, then the notification service is called
   with recipient type `role` = `HR_BUSINESS_PARTNER` (not a list of names minted here)
   and payload fields from the matrix only.

4. `internal-transfer-notifications.AC4` — Given `employee.transfer.withdrawn.v1`,
   `rejected.v1`, `approved.v1` or `completed.v1`, when the handler runs, then the owning employee
   receives the matching template and no manager is notified on withdrawn/rejected
   unless they still have an incomplete approval stage (they do not: those events are
   terminal for approval).

5. `internal-transfer-notifications.AC5` — Given any notification payload, when it is
   inspected, then it has no `reason`, `withdrawalReason`, `reasonCiphertext` or
   equivalent key, and logs of the handler contain none of that text.

6. `internal-transfer-notifications.AC6` — Given the same domain event is delivered to
   the handler twice (at-least-once), when the second delivery runs, then it is a no-op on
   the `eventId` ingress key and no further dispatch is enqueued; and given one person is
   both the releasing and the receiving manager, when `stage-pending.v1` fires for
   `MANAGER_RELEASE` and later for `MANAGER_ACCEPT`, then they receive
   `itr.approver.pending` **twice** — the secondary key includes `eventType` and
   `stageCode` precisely so this is not suppressed; and given two workers race the same
   event, then the database unique constraint, not the application check, is what leaves
   exactly one dispatch row.

7. `internal-transfer-notifications.AC7` — Given the notification service is down, when
   the handler cannot publish, then request status, stages and audit are unchanged and
   the unpublished notification outbox row is retained for retry.

8. `internal-transfer-notifications.AC8` — Given `MANAGER_RELEASE.assigned_party_ref` is
   null on submit, when AC1 runs, then the employee still receives
   `itr.employee.submitted` and the manager pending notification is skipped (not
   sent to a guessed person); no 5xx is raised to the employee submit path.

9. `internal-transfer-notifications.AC9` — Given a submit, approval or fulfilment report,
   when its domain transaction commits, then no notification work took place inside that
   transaction and no outbound HTTP call to the notification service was made from that
   request handler; the notification handler runs only from the published domain event,
   and its own dedupe record and dispatch rows commit together or not at all (BR7).

10. `internal-transfer-notifications.AC10` — Given any dispatch the portal sends, then the
    payload carries `notificationId`, `templateId`, `recipient.type`, `recipient.ref`,
    `locale` = `en`, `correlationId` propagated from the domain event, `sourceEventId`
    equal to that event's `eventId`, and a `data` object — and `recipient.ref` is an
    `employee:` or `role:` reference, never an email address.

11. `internal-transfer-notifications.AC11` — Given any dispatch, then its `data` object
    contains **only** the keys its matrix row permits — no confirmed effective date, no
    assignment title, no manager name, no key outside the row's list — and a payload
    carrying an unlisted key fails the contract test rather than logging a warning.

12. `internal-transfer-notifications.AC12` — Given the notification service responds,
    then 2xx marks the dispatch `SENT`; a 4xx other than 429 marks it `UNDELIVERABLE`,
    raises an operational alert and is **not** retried; and 429, 5xx, a timeout or a
    connection failure is retried with bounded backoff and, once the bound is exhausted,
    marked `UNDELIVERABLE` with an alert — in every one of those cases request status,
    stages and audit are unchanged (BR3, BR9).

13. `internal-transfer-notifications.AC13` — Given `employee.transfer.stage-pending.v1`
    for a stage that is no longer awaiting action, or for a request that has since become
    terminal, when the handler runs, then no `itr.approver.pending` is enqueued and the
    skip is recorded — an out-of-order event never asks someone to act on a settled
    decision (BR10).

14. `internal-transfer-notifications.AC14` — Given `withdrawn.v1`, `rejected.v1`,
    `approved.v1` or `completed.v1` is handled late or out of order, when the handler
    runs, then the notification is still sent, because those events describe facts that
    remain true — and the portal never synthesises a notification for an event it did not
    receive.

15. `internal-transfer-notifications.AC15` — Given
    `employee.transfer.fulfilment-failed.v1`, `employee.transfer.fulfilment-stage.v1` or
    `employee.transfer.compensate.v1` is published, when the handler runs, then **no**
    notification is enqueued to the employee or to any approver, and the decision is
    asserted by test rather than left to the absence of a matrix row (see _Transition
    coverage_ and BRD-001 OQ-21).

16. `internal-transfer-notifications.AC16` — Given the handler's subscription list, then
    it contains only the canonical OWN-09 `.v1` event names, and an event published under
    an unsuffixed legacy name is not consumed — a naming mismatch surfaces as an
    unhandled event, never as a silently accepted second spelling (BR6).

## Unit Test Cases (spec-derived)

| Test ID                                | Maps to AC | Scenario                                            | Expected                                                                       |
| -------------------------------------- | ---------- | --------------------------------------------------- | ------------------------------------------------------------------------------ |
| `internal-transfer-notifications.UT01` | AC1        | Requested event                                     | Two notification outbox/enqueue rows: employee submitted, line manager pending |
| `internal-transfer-notifications.UT02` | AC1        | Notification service 503                            | Request still `MANAGER_REVIEW`; notification row unpublished                   |
| `internal-transfer-notifications.UT03` | AC2        | Stage-pending `MANAGER_ACCEPT`                      | Exactly one pending notify to receiving manager ref                            |
| `internal-transfer-notifications.UT04` | AC3        | Stage-pending `HR_VALIDATION`                       | Recipient is role `HR_BUSINESS_PARTNER`; payload has no names array            |
| `internal-transfer-notifications.UT05` | AC4        | Rejected.v1                                         | One employee `itr.employee.rejected`; zero manager pending                     |
| `internal-transfer-notifications.UT06` | AC4        | Completed.v1                                        | One employee `itr.employee.completed`                                          |
| `internal-transfer-notifications.UT07` | AC5        | Submitted event from a request that has reason text | Notification payload JSON has no reason key; logs have no reason substring     |
| `internal-transfer-notifications.UT08` | AC6        | Handler invoked twice for one requested event       | Notification service enqueue count remains 2 (employee + manager), not 4       |
| `internal-transfer-notifications.UT09` | AC7        | Relay crash after domain commit                     | Aggregate unchanged; notification retryable                                    |
| `internal-transfer-notifications.UT10` | AC8        | `assigned_party_ref` null                           | Employee notified; no manager notify; no throw into submit                     |
| `internal-transfer-notifications.UT11` | AC6        | Same person is both releasing and receiving manager | `itr.approver.pending` sent **twice** — once per `stageCode`, not suppressed   |
| `internal-transfer-notifications.UT12` | AC6        | Two workers handle one event concurrently           | Exactly one dispatch row; the database unique constraint rejects the second    |
| `internal-transfer-notifications.UT13` | AC9        | Trace of the submit and approve HTTP handlers       | Zero notification-service calls and zero notification writes inside the domain transaction |
| `internal-transfer-notifications.UT14` | AC9        | Handler crashes between dedupe record and dispatch rows | Neither is present — the handler transaction rolled back as one unit      |
| `internal-transfer-notifications.UT15` | AC10       | Any dispatch captured at the relay boundary         | Full envelope present; `sourceEventId` equals the domain `eventId`; `recipient.ref` is `employee:`/`role:`, never an address |
| `internal-transfer-notifications.UT16` | AC11       | Dispatch built from a request with a confirmed date, titles and manager names available | `data` carries only the matrix-row keys; contract test fails on any extra key |
| `internal-transfer-notifications.UT17` | AC12       | Platform returns 400                                | `UNDELIVERABLE`; alert raised; retry count stays 0                             |
| `internal-transfer-notifications.UT18` | AC12       | Platform returns 429 then 200                       | Retried with backoff; ends `SENT`; one mail, not two                           |
| `internal-transfer-notifications.UT19` | AC12       | Platform 5xx until the retry bound is exhausted     | `UNDELIVERABLE`; alert raised; request status, stages and audit untouched      |
| `internal-transfer-notifications.UT20` | AC13       | `stage-pending.v1` for `HR_VALIDATION` arrives after the request is `REJECTED` | No enqueue; skip recorded                                    |
| `internal-transfer-notifications.UT21` | AC14       | `completed.v1` delivered hours late                 | Notification still sent; content still accurate                                |
| `internal-transfer-notifications.UT22` | AC15       | `fulfilment-failed.v1`, `fulfilment-stage.v1` and `compensate.v1` published | Zero notifications enqueued for any recipient                    |
| `internal-transfer-notifications.UT23` | AC16       | Event published as `employee.transfer.requested` (no suffix) | Not consumed; surfaces as an unhandled event rather than a silent success |
| `internal-transfer-notifications.UT24` | AC1, AC6, AC12 | **Integration**, notification-service contract double: submit → two dispatches → platform 5xx → retry → `SENT` | End state `SENT` for both; request `MANAGER_REVIEW` throughout; exactly two mails |
| `internal-transfer-notifications.UT25` | AC13, AC14 | **Integration**, contract double redelivers the approval-chain events out of order and duplicated | Pending mail suppressed by the guard; informational mails sent once each |

Integration rows use a contract double for the notification service, never a hand-rolled
stub (constitution — Testing Discipline). UT13, UT14, UT17, UT19, UT20 and UT23 are the
failure and negative paths G1-F09 asked for; coverage at 85% with no failure-path tests
would fail review regardless of the number.

## Traceability — BRD → rule → AC → test

Read in both directions: every rule reaches at least one AC and one test, and every AC and
test traces back to a BRD-001 item, a shared fact, an ADR, the constitution, or a named
Gate 1 finding. No orphans either way.

| Source of record | Spec rule | Acceptance criteria | Tests |
| --- | --- | --- | --- |
| BRD-001 spec map ("on every state transition"); Gate 1 G1-F01 | BR1; _Transition coverage_ | AC1, AC2, AC3, AC4, AC15 | UT01, UT03, UT05, UT06, UT22 |
| Constitution Security Posture; BRD-001 OQ-12; OWN-05 | BR2 | AC5, AC11 | UT07, UT16 |
| Architecture _Integration Points_; constitution degradation | BR3 | AC7, AC9, AC12 | UT02, UT09, UT13, UT14, UT19 |
| BRD-001 OQ-18 | BR4 | AC10 (`locale`) | UT15 |
| OWN-04; BRD-001 BR13; Gate 1 G1-F06 | BR5 | AC3, AC8 | UT04, UT10 |
| OWN-09; Gate 1 G1-F02; request spec G1-F04 | BR6 | AC16 | UT23 |
| Gate 1 G1-F03; ADR-0001; constitution (outbox) | BR7 | AC9 | UT13, UT14 |
| Gate 1 G1-F04; ADR-0001 (at-least-once) | BR8 | AC6 | UT08, UT11, UT12 |
| Gate 1 G1-F04; BRD-001 Dependencies (notification service owner) | BR9 | AC12 | UT17, UT18, UT19, UT24 |
| Gate 1 G1-F07 | BR10 | AC13, AC14 | UT20, UT21, UT25 |
| Gate 1 G1-F05; BRD-001 AS-03 | _Portal → notification service payload_ | AC10, AC11 | UT15, UT16 |
| BRD-001 OQ-21 Resolved 2026-09-11; KD-05; OWN-08; Gate 1 G1-F08 | _Transition coverage_ — fulfilment-failure row | AC15 | UT22 |

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
- A login, mailbox, or OIDC endpoint — authentication remains the existing portal and
  notification service.
- Including confirmed effective date, assignment titles or manager names in the payload
  (not required by the BRD; titles/names are PII risk — matrix omits them).
- Notifying the employee when a fulfilment stage fails. **Confirmed silent in v1**
  (BRD-001 OQ-21 Resolved 2026-09-11). A later mail is a new matrix row, not a redesign.
- Per-fulfilment-stage progress mail. The status page is the employee's progress view
  (KD-05); this spec does not duplicate it one mail at a time.
- Delivery-channel choice, read receipts, or proof of delivery beyond the platform's 2xx.
  Once accepted, delivery is the notification service's responsibility (BR3).
- Reordering or replaying domain events to reconstruct a missed notification (see
  _Ordering_).

## Open Questions

| #   | Question                                                                                        | Owner | Needed by | Resolution                      |
| --- | ----------------------------------------------------------------------------------------------- | ----- | --------- | ------------------------------- |
| 1   | Is the employee told when a downstream fulfilment stage fails, or is the status page enough while HR Operations closes it out off-portal? | Product | Closed | **Resolved 2026-09-11 — BRD-001 OQ-21.** No employee notification. Status page (KD-05) is the progress view. AC15 / UT22. |
| 2   | Nothing else. Who is notified on the listed transitions, and what is forbidden in a payload, is closed — the matrix plus _Transition coverage_ is the complete set for v1. | — | — | Closed |

Copy for each template id is Product's, outside this spec. A plan must not invent
legal-sounding HR prose in code; it references the template id.

## Assumptions

- A1 — The portal notification service already authenticates employees and can address
  an employee id and a role. If false: AS-03 in the BRD; this spec cannot ship.
- A2 — Sibling specs emit the canonical OWN-09 names in _Event naming and versioning_.
  **Verified, not assumed, as of 2026-09-11:** all four specs now use the suffixed forms,
  the last of them being `internal-transfer-request` v1.3. AC16 remains the guard that
  makes any future mismatch fail loudly rather than degrade quietly.
- A3 — "Every state transition" in the BRD map means the events inventoried in
  _Transition coverage_, not draft autosave. Draft create, update and discard are silent
  and the reason is recorded there. If Product wants draft reminders, a new row is added
  before Approved.
- A4 — The notification service's webhook accepts the field set in _Portal → notification
  service payload_, or the platform team maps it. If false: only that mapping table
  changes — the matrix, the allow-list and the dedupe keys do not, because none of them
  depends on the wire format.
- A5 — The portal platform team acts on an `UNDELIVERABLE` alert (BR9). If false:
  notifications fail silently in the operational sense, which is a monitoring gap for that
  team to own, not a reason to retry forever in this spec.

## Non-Functional Constraints (from constitution.md)

- Notification work is **off** the employee submit p95 budget, not conditionally off it:
  BR7 puts the handler after the domain commit, so submit's p95 < 700 ms is unaffected by
  notification latency and submit still succeeds when the notification service is down
  (AC7, AC9). v1.1's "if a plan puts it in the submit transaction" caveat is gone, because
  a plan may no longer do that.
- 99.9% availability applies to the request path, not to notification delivery.
- No PII in logs or notification payloads (AC5). The `data` allow-list is the enforcement
  point (AC11).
- Both hops go through a transactional outbox (BR7). No fire-and-forget HTTP call from a
  submit, approve or fulfilment handler, under any circumstances.
- Retry is **bounded**, ending in `UNDELIVERABLE` plus an alert (BR9). No unbounded retry
  loop and no silent drop.
- WCAG does not add a new screen here.

## Revision History

| Version | Date       | Change        | Driver  |
| ------- | ---------- | ------------- | ------- |
| v1.0    | 2026-09-03 | Initial draft | BRD-001 |
| v1.1    | 2026-09-08 | Authentication and authorisation section: no new OIDC API; recipients from aggregate ids only | BRD-001 KD-07 |
| v1.2    | 2026-09-11 | Gate 1 response. New _Transition coverage_ inventory (every sibling event, notified or deliberately silent, with reasons) and _Event naming and versioning_ (OWN-09); BR6–BR10; dispatch boundary decided rather than left to the plan, with the two-hop pipeline; formal portal → notification-service payload schema and response-handling table; new _Idempotency, ordering and retry_ section correcting v1.1's dedupe key; AC9–AC16; UT11–UT25 including two integration rows; traceability matrix; A4, A5; BRD-001 OQ-21 raised for employee notification on fulfilment failure | Gate 1 G1-F01–G1-F10 (Abhijit Adhikari, 2026-09-09) |
| v1.3    | 2026-09-11 | Product v1 lock: OQ-21 confirmed — no employee notification on fulfilment failure. Behaviour unchanged from v1.2's proposed answer | Product, 2026-09-11 |

## Gate 1 Review

> Reviewed by: Abhijit Adhikari, 2026-09-09, **Changes Requested** — five P0 and five P1
> findings. Findings worksheet:
> `.ai-context/reviews/internal-transfer-notifications.gate1.md`.

### Author response — v1.2, 2026-09-11 (Alamgir Sarkar)

| Finding | Severity | Addressed in v1.2 by |
| --- | --- | --- |
| G1-F01 — "every state transition" contradicts the matrix | P0 | BR1 rewritten: the matrix is the closed set, and the new _Transition coverage_ inventory accounts for **every** event the four specs emit as notified or deliberately silent with a reason. Surfaced in passing that `CANCELLED` is unreachable in v1 because no spec transitions into it |
| G1-F02 — standardise domain event names and versioning | P0 | _Event naming and versioning_ + shared fact OWN-09; BR6; AC16; the dual "`X` / `X.v1`" spellings removed from the matrix. The request spec's non-compliance was stated rather than absorbed, and it adopted the convention in its v1.3 the same day — **closed end to end** |
| G1-F03 — outbox/dedupe boundary left to the plan | P0 | BR7 and the _Dispatch boundary_ pipeline: handler after the domain commit, its own transaction for dedupe record plus dispatch rows, relay-only egress; AC9; UT13, UT14 |
| G1-F04 — recipient-level idempotency and retry | P0 | BR8, BR9 and _Idempotency, ordering and retry_ — three keyed layers, a database unique constraint, bounded backoff ending in `UNDELIVERABLE` with an alert; AC6, AC12 |
| G1-F05 — formal portal → notification-service payload contract | P0 | _Portal → notification service payload_ with a typed field table, the `data` allow-list rule and a response-handling table; AC10, AC11; UT15, UT16 |
| G1-F06 — confirm HR role-based notification against OQ-11 | P1 | Confirmed, and the dependency shown not to exist: OQ-11 governs disclosure to the employee, while recipient resolution is OWN-04/BR13. BR5 now cites OWN-04 instead of OQ-11 |
| G1-F07 — behaviour for out-of-order events | P1 | BR10 and _Ordering_ — action-required notifications guarded against stale state, informational ones still sent, nothing synthesised; AC13, AC14; UT20, UT21, UT25 |
| G1-F08 — why fulfilment failures don't notify employees | P1 | Reasoning recorded in _Transition coverage_ and Out of Scope, asserted by AC15/UT22. **OQ-21 Resolved 2026-09-11 (Product):** silent in v1 |
| G1-F09 — negative / failure / integration test cases | P1 | UT11–UT25, including permanent-4xx, retry-exhaustion, concurrency, transaction-rollback and two contract-double integration rows |
| G1-F10 — BRD → BR → AC → Test traceability | P1 | _Traceability_ section, readable in both directions, no orphans |

**Two things this revision did not settle on the day it was written, both now closed.**
First, G1-F02 was only fully closed once `internal-transfer-request` renamed its two events
under its own G1-F04 — that landed the same day in its v1.3, so **G1-F02 is now closed end
to end**. Second, whether the employee is told when fulfilment fails was Product's call;
**OQ-21 is Resolved 2026-09-11** — no employee notification in v1.
