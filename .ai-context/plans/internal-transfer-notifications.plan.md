# Plan: Internal Transfer Notifications

## Derived From

`.ai-context/specs/internal-transfer-notifications.spec.md` (v1.3, Approved 2026-09-11, Abhijit Adhikari)

## Status

**Plan Drafted** · **Author:** Alamgir Sarkar · **Reviewer:** Abhijit Adhikari (_plan review pending_)

## Architecture Approach

- **No new service and no new screen.** The spec's Surfaces section says delivery stays
  on the existing notification-service webhook. This plan does not add a route under
  `employee-portal-web` and does not add an inbox. Template prose is Product's; the
  portal sends a `templateId` and an allow-listed `data` object, never a sentence.
  There is no React task. WCAG is unchanged because no screen is added.
- **Backend** is `employee-services/src/internal-transfer/notifications/{domain,persistence,integration}`
  inside the existing module, following `.agent/rules/int-standards.node.md`. No `api/`
  router: this spec exposes no public HTTP endpoint. No new dependency. The outbound
  call uses the platform HTTP client already used by the outbox relay, with an explicit
  timeout.
- **Dispatch boundary is the spec's, not a choice.** Domain transactions
  (submit, approve, fulfilment report) commit their own outbox rows and return. A handler
  runs only after that event is published. In one transaction of its own it writes the
  ingress dedupe row and the `notification_dispatch` rows. A separate relay POSTs to the
  notification service. Nothing in a request handler calls that service, and nothing in
  the notification transaction updates `transfer_request`, stages or audit (BR3).
- **Three idempotency layers, all in SQLite.** Ingress key is the domain `eventId`.
  Enqueue key is `requestId + eventType + stageCode + templateId + recipientRef` for 24
  hours, enforced by a unique index so two workers cannot both insert. Egress key is
  `notificationId`, sent to the platform so a relay retry is not a second mail.
- **Action-required mail is guarded.** Before enqueuing `itr.approver.pending` the handler
  re-reads the aggregate. If that stage is no longer awaiting action, or the request is
  terminal, the enqueue is skipped and the skip is recorded. Informational templates
  (`withdrawn`, `rejected`, `approved`, `completed`) are sent even when late. The handler
  does not reorder events and does not synthesise a mail for an event it did not receive.
- **Silent events are an explicit subscription gap, not a missing `if`.** The handler's
  subscription list is the OWN-09 names in the spec. `fulfilment-stage.v1`,
  `fulfilment-failed.v1` and `compensate.v1` are received and recorded as silent (AC15,
  OQ-21). An unsuffixed legacy name is not subscribed (AC16). Draft create, update and
  discard emit no event and produce no mail.
- **Recipients** come from the aggregate: owning `employee_id`, `assigned_party_ref`, or
  `role:HR_BUSINESS_PARTNER`. A null manager ref skips that recipient and still notifies
  the employee (AC8). The same person who is both releasing and receiving manager receives
  `itr.approver.pending` twice, once per `stageCode` (AC6). HR fan-out is the platform's
  directory lookup. This module does not expand the role to names and does not hold email
  addresses.

## Data Model

New tables in the same SQLite file. Additive. No change to `transfer_request`.

**`notification_ingress`**

| Column | Type | Notes |
|---|---|---|
| `event_id` | TEXT PK | Domain `eventId`. The key does not contain a name or reason |
| `event_type` | TEXT | Canonical `.v1` name |
| `received_at` | TEXT | UTC |

**`notification_dispatch`**

| Column | Type | Notes |
|---|---|---|
| `notification_id` | TEXT PK | Platform idempotency key |
| `request_id` | TEXT | |
| `event_id` | TEXT | |
| `event_type` | TEXT | |
| `stage_code` | TEXT | Empty string when the matrix row has no stage, so the unique key stays total |
| `template_id` | TEXT | One of the six `itr.*` ids |
| `recipient_ref` | TEXT | `employee:<id>` or `role:HR_BUSINESS_PARTNER`. Never an email address |
| `status` | TEXT | `PENDING`, `SENT`, `UNDELIVERABLE`, `SKIPPED` |
| `attempts` | INTEGER | |
| `window_start` | TEXT | UTC day containing `created_at`. Part of the secondary unique key |
| `created_at` | TEXT | |

SQLite cannot express "unique over a moving 24-hour clock" as a partial index. The
secondary key is therefore a real unique index, which is what survives two workers:

`UNIQUE (request_id, event_type, stage_code, template_id, recipient_ref, window_start)`

`window_start` is `created_at` truncated to the UTC day that contains it (the 24-hour
window the spec names). Two inserts in that day with the same five fields collide.
`MANAGER_ACCEPT` after `MANAGER_RELEASE` differs in `stage_code` and both rows are kept
(AC6). The primary guard remains `notification_ingress.event_id`: a redelivery of the
same event never reaches the secondary insert. Rows are retained with the request
aggregate (7 years), not deleted at 24 hours, so support can see what was sent. The
unique index only constrains one window because `window_start` changes the next day.

Skip rows (`SKIPPED`) use the same table so the skip is recorded (AC13) and so a retry
of the same event does not enqueue later. They occupy the unique key.

**Migration:** forward-only, additive. Rollback is leaving the tables unused.

**What the keys deliberately do not contain:** reason text, legal names, email addresses,
confirmed effective date, assignment titles.

## Integration Points

| System | Direction | Sync/Async | Failure behaviour | Timeout / retry | Owner |
|---|---|---|---|---|---|
| Domain outbox (`requested.v1`, `withdrawn.v1`, `stage-pending.v1`, `rejected.v1`, `approved.v1`, `completed.v1`, and the three silent fulfilment events) | In | Async, after the domain commit | Handler failure does not change request status. Redelivery is an ingress no-op | Domain relay | Portal |
| Notification service webhook | Out | Async, notification relay only | 2xx → `SENT`. 4xx other than 429 → `UNDELIVERABLE`, alert, no retry. 429, 5xx, timeout, connection failure → bounded backoff then `UNDELIVERABLE` plus alert. Aggregate untouched | Explicit timeout on the HTTP call. Bound stated in the relay task: 5 attempts, exponential backoff starting at 1 s, cap 5 min. Alert to the portal platform team | Portal platform |
| Corporate IdP | None on a new endpoint | — | Recipients are ids already on the aggregate | — | — |

The six templates and their permitted `data` keys are the matrix in the spec. A key
outside that row fails the contract test.

## Failure and Boundary Handling

| Scenario | Behaviour | Maps to AC |
|---|---|---|
| `requested.v1` published | One `itr.employee.submitted` and one `itr.approver.pending` for `MANAGER_RELEASE`. Request stays `MANAGER_REVIEW` even if the platform returns 5xx | AC1 |
| `stage-pending.v1` for `MANAGER_ACCEPT` | One pending mail to that stage's `assigned_party_ref` only | AC2 |
| `stage-pending.v1` for `HR_VALIDATION` | Recipient type `ROLE`, ref `role:HR_BUSINESS_PARTNER`. No names array | AC3 |
| `withdrawn.v1`, `rejected.v1`, `approved.v1`, `completed.v1` | Owning employee, matching template. No manager mail. Late delivery still sent | AC4, AC14 |
| Any payload or handler log | No `reason`, `withdrawalReason`, or ciphertext key | AC5 |
| Same `eventId` twice | Second delivery enqueues nothing | AC6 |
| Same person, release then accept | Two `itr.approver.pending` rows, different `stage_code` | AC6 |
| Two workers, one event | Unique index leaves one dispatch row | AC6 |
| Platform down | Dispatch stays `PENDING` or becomes `UNDELIVERABLE` after the bound. Request status, stages and audit unchanged | AC7, AC12 |
| Null `assigned_party_ref` on `MANAGER_RELEASE` | Employee mail still enqueued. Manager mail skipped. No error into the submit path | AC8 |
| Submit, approve or fulfilment HTTP handler | Zero notification writes and zero notification HTTP calls inside that transaction | AC9 |
| Handler crashes between ingress and dispatch rows | Both absent. One transaction | AC9 |
| Dispatch envelope | `notificationId`, `templateId`, `recipient.type`, `recipient.ref`, `locale=en`, `correlationId`, `sourceEventId` = domain `eventId`. Ref is `employee:` or `role:`, never an address | AC10 |
| `data` object | Only the matrix row's keys | AC11 |
| Platform 400 | `UNDELIVERABLE`, alert, attempts stay 0 | AC12 |
| Platform 429 then 200 | Retried; ends `SENT`; one mail | AC12 |
| `stage-pending.v1` after the stage is decided or the request is terminal | No enqueue. Status `SKIPPED` recorded | AC13 |
| `fulfilment-failed.v1`, `fulfilment-stage.v1`, `compensate.v1` | Zero dispatches. Asserted by test | AC15 |
| Event name without `.v1` | Not consumed | AC16 |

## Constitution Check

- [x] **No implementation without an approved spec** — v1.3 Approved 2026-09-11.
- [x] **No vibe coding** — tasks from Sequencing.
- [x] **Test-first** — UT01–UT25 named on tasks. UT24 and UT25 are integration tests
      against a contract double of the notification service.
- [x] **Spec is the contract** — no template prose, no extra matrix row, no employee mail
      on fulfilment failure.
- [x] **No secrets or PII in this plan** — payloads listed by field name only.
- [x] **Context scoped** — one task, its ACs, this plan, `int-standards.node.md`.
- [x] **No new datastore or service** — two tables in the approved SQLite file. The
      notification service already exists; this plan does not replace it.
- [x] **Testing discipline** — Jest. Real SQLite file for the unique index and the
      single-transaction ingress+dispatch rollback. Coverage floor 85% (employee records
      and notification of approval decisions). No snapshot-only tests. Log assertions are
      only the negative capture AC5 requires.
- [x] **Security posture** — allow-list `data`. No narrative in the payload or in logs.
      Recipient is an employee id or a role, never an address harvested from the transfer.
      No new credential scheme (AS-03 stands).
- [x] **Rate-limit decision** — **none on a new portal endpoint, because this spec adds
      no HTTP endpoint.** The outbound webhook is the platform notification service; this
      plan does not change that service's ingress limit. Bounded retry (5 attempts) is
      the abuse control on our side: a failing platform cannot be hammered without a cap.
- [x] **Async integration** — both hops are outbox-backed. No fire-and-forget from a
      request handler.
- [x] **Outbox** — domain events stay on the domain outbox. Notification delivery has its
      own dispatch row committed with the dedupe record, then a relay. That is the spec's
      two-hop reading of the constitution rule, not a direct HTTP call from the handler
      that also writes the dedupe row.
- [x] **No HRIS write** — not touched.
- [x] **Front end state** — not touched. No second state library is introduced by omission.
- [x] **Public API** — no new public route. No error body to version. Event names consumed
      are already `.v1`.
- [x] **Latency** — notification work is off the submit p95 budget by BR7. Submit stays
      under 700 ms when the notification service is down.
- [x] **Availability** — 99.9% applies to the request path, not to mail delivery.
- [x] **Durability** — dispatch rows live in the same SQLite file.
- [x] **Accessibility** — no new screen (spec Non-Functional Constraints).
- [x] **Degradation** — notification loss does not change request state and does not
      cascade into another journey.
- [x] **Audit** — this spec does not write transfer audit rows. A skip is a dispatch row
      with status `SKIPPED`, which is the record AC13 asks for. It is not a substitute
      for the domain audit.
- [x] **Versioning** — subscription list rejects unsuffixed names. Payload fields are
      additive only inside the matrix; a new key is a spec change, not a mapper change.

## ADR Candidates

| Decision | Significant? | ADR |
|---|---|---|
| Handler after publish, with its own transaction, rather than inside the domain transaction | Already decided by the spec (BR7). Reversing it changes failure semantics and is more than a day | Not a new ADR. ADR-0001 already requires the outbox |
| Secondary unique key includes `stage_code` and a window start | Specified (BR8) after v1.1's key was shown to drop a legitimate mail. The window column is the SQLite way to enforce it. Reversal is a migration, under a day before data exists | Recorded here |
| Silent fulfilment-failure mail | Specified (OQ-21). A later mail is a new matrix row | Not an ADR |
| No frontend | Specified. Building an inbox would be a new spec | Not an ADR |

## Explicitly Deferred

- In-portal status and pending-with — `internal-transfer-request`.
- Approval and fulfilment behaviour.
- SMS, native push, a second locale (OQ-18, OQ-19).
- Notifying Payroll, IT or Facilities.
- Digest, preferences, unsubscribe.
- A login, mailbox or OIDC endpoint.
- Confirmed effective date, titles or manager names in `data`.
- Employee notification when fulfilment fails (OQ-21). Asserted absent, not built later inside these tasks.
- Per-stage fulfilment progress mail.
- Read receipts and proof of delivery beyond platform 2xx.
- Reordering or replaying events to reconstruct a missed mail.
- Draft reminders (spec assumption A3).
- Template wording. Tasks reference template ids only.

## Sequencing

1. **Dispatch store (backend)** — ingress table, dispatch table, unique index, statuses.
2. **Requested handler (backend)** — employee submitted + line-manager pending, including
   a null manager ref.
3. **Stage-pending handler (backend)** — receiving manager, HR role, and the same person
   on both manager stages.
4. **Informational handler (backend)** — withdrawn, rejected, approved, completed,
   including a late event.
5. **Silence and naming (backend)** — the three fulfilment events enqueue nothing;
   an unsuffixed name is not consumed.
6. **Staleness guard (backend)** — action-required skip versus informational send.
   Its own task so the happy path cannot omit the re-read.
7. **Relay (backend)** — envelope, allow-list, response classes, bounded retry, alert,
   and the proof that domain handlers do not call the platform.
8. **Contract-double journeys (backend)** — UT24 and UT25. Not a new behaviour; they
   lock the path across handler and relay.

There is no frontend step.

## Documentation Impact

- [ ] `architecture.md` — on merge, the Notification service row notes that transfer
      notifications are a second outbox hop inside `employee-services`, not a new
      product. Currency check updates when this plan is reviewed.
- [ ] `decisions/` — none
- [ ] `README.md` — alert destination for `UNDELIVERABLE` is an operational note when
      the relay task merges. No template body and no secret.
- [ ] `docs/contracts/` — the portal → notification-service payload, copied from the
      spec, when T07 merges
