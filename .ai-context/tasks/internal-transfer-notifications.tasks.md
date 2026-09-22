# Tasks: Internal Transfer Notifications

## Derived From

`.ai-context/plans/internal-transfer-notifications.plan.md` (Plan Drafted — plan review pending)

Generated from the plan's Sequencing section on 2026-09-22.

All tasks are backend and follow `.agent/rules/int-standards.node.md`.
The spec defines no screen, so there is no frontend task. Template ids are referenced;
template wording is not written in these tasks.

## Task States

Checkbox state in this file is the task state:
`[ ]` Not Started · `[~]` In Progress · `[r]` In Review · `[x]` Merged

## How these are executed

One task, one prompt, one branch, one review. Red tests are confirmed failing before
implementation. Do not prompt this file as a whole.

## Sequence

- [ ] `internal-transfer-notifications.T01` — Backend: ingress and dispatch store
      — Acceptance: `AC6` (the unique index is what leaves one row), `AC9` (ingress and
        dispatch commit together)
      — Tests first: `UT12`, `UT14`
      — Touches: `employee-services/src/internal-transfer/notifications/persistence/`,
        `employee-services/migrations/`
      — Depends on: `internal-transfer-request.T01`
      — Note: real SQLite file. Unique index on
        `(request_id, event_type, stage_code, template_id, recipient_ref, window_start)`.
        `notification_ingress.event_id` is the primary key. No reason column

- [ ] `internal-transfer-notifications.T02` — Backend: requested handler
      — Acceptance: `AC1`, `AC8`
      — Tests first: `UT01`, `UT02`, `UT10`
      — Touches: `employee-services/src/internal-transfer/notifications/domain/`
      — Depends on: `T01`, `internal-transfer-request.T06`
      — Note: runs after `requested.v1` is published. Two dispatch rows, matrix fields
        only. Platform 5xx leaves the request `MANAGER_REVIEW`. A null manager ref
        skips that recipient and still notifies the employee. No throw into submit

- [ ] `internal-transfer-notifications.T03` — Backend: stage-pending handler
      — Acceptance: `AC2`, `AC3`, `AC6`
      — Tests first: `UT03`, `UT04`, `UT08`, `UT11`
      — Touches: `employee-services/src/internal-transfer/notifications/domain/`
      — Depends on: `T01`
      — Note: HR recipient is `role:HR_BUSINESS_PARTNER`, not a name list. The same
        person on release and accept gets two mails because `stage_code` differs.
        A second delivery of one `eventId` enqueues nothing

- [ ] `internal-transfer-notifications.T04` — Backend: informational handler
      — Acceptance: `AC4`, `AC14`
      — Tests first: `UT05`, `UT06`, `UT21`
      — Touches: `employee-services/src/internal-transfer/notifications/domain/`
      — Depends on: `T01`
      — Note: employee templates only. A late `completed.v1` is still sent. The handler
        does not invent a mail for an event it did not receive

- [ ] `internal-transfer-notifications.T05` — Backend: silence and event names
      — Acceptance: `AC15`, `AC16`
      — Tests first: `UT22`, `UT23`
      — Touches: `employee-services/src/internal-transfer/notifications/domain/`
      — Depends on: `T01`
      — Note: `fulfilment-failed.v1`, `fulfilment-stage.v1` and `compensate.v1` enqueue
        zero rows, asserted by test. An unsuffixed name is not on the subscription list

- [ ] `internal-transfer-notifications.T06` — Backend: staleness guard
      — Acceptance: `AC13`
      — Tests first: `UT20`
      — Touches: `employee-services/src/internal-transfer/notifications/domain/`
      — Depends on: `T03`
      — Note: re-read the aggregate before `itr.approver.pending`. Skip is stored as
        `SKIPPED`. Informational templates are not guarded; that difference is why this
        is not folded into T03

- [ ] `internal-transfer-notifications.T07` — Backend: relay, allow-list, retry
      — Acceptance: `AC5`, `AC7`, `AC9`, `AC10`, `AC11`, `AC12`
      — Tests first: `UT07`, `UT09`, `UT13`, `UT15`, `UT16`, `UT17`, `UT18`, `UT19`
      — Touches: `employee-services/src/internal-transfer/notifications/integration/`,
        `docs/contracts/`
      — Depends on: `T02`, `T03`, `T04`
      — Note: only the relay calls the platform. Timeout is explicit. 2xx → `SENT`.
        4xx other than 429 → `UNDELIVERABLE`, alert, no retry. 429 and 5xx retry at
        most 5 times with exponential backoff from 1 s capped at 5 min, then
        `UNDELIVERABLE` and an alert. `data` is an allow-list per matrix row.
        `recipient.ref` is never an email address. `locale` is `en`. No new dependency

- [ ] `internal-transfer-notifications.T08` — Backend: contract-double journeys
      — Acceptance: `AC1`, `AC6`, `AC12`, `AC13`, `AC14`
      — Tests first: `UT24`, `UT25`
      — Touches: `employee-services/src/internal-transfer/notifications/`
      — Depends on: `T06`, `T07`
      — Note: contract double of the notification service, not a hand-rolled stub.
        UT24 is submit → two dispatches → 5xx → retry → `SENT`, request still
        `MANAGER_REVIEW`. UT25 is out-of-order redelivery: pending mail suppressed,
        informational mails sent once

## Traceability

| AC | Covered by | Test cases | Status |
|---|---|---|---|
| `AC1` — requested notifies employee and line manager | T02, T08 | UT01, UT02, UT24 | Not Started |
| `AC2` — accept notifies receiving manager only | T03 | UT03 | Not Started |
| `AC3` — HR is a role | T03 | UT04 | Not Started |
| `AC4` — terminal templates to the employee | T04 | UT05, UT06 | Not Started |
| `AC5` — no reason in payload or logs | T07 | UT07 | Not Started |
| `AC6` — eventId, dual manager, unique index | T01, T03, T08 | UT08, UT11, UT12 | Not Started |
| `AC7` — platform down leaves the aggregate | T07 | UT09 | Not Started |
| `AC8` — null manager ref | T02 | UT10 | Not Started |
| `AC9` — not inside the domain transaction | T01, T07 | UT13, UT14 | Not Started |
| `AC10` — envelope | T07 | UT15 | Not Started |
| `AC11` — data allow-list | T07 | UT16 | Not Started |
| `AC12` — response classes and bounded retry | T07, T08 | UT17, UT18, UT19, UT24 | Not Started |
| `AC13` — stale action-required is skipped | T06, T08 | UT20, UT25 | Not Started |
| `AC14` — late informational mail is sent | T04, T08 | UT21, UT25 | Not Started |
| `AC15` — fulfilment events are silent | T05 | UT22 | Not Started |
| `AC16` — unsuffixed name is not consumed | T05 | UT23 | Not Started |

**Reverse check:** T01 → AC6/AC9 · T02 → AC1/AC8 · T03 → AC2/AC3/AC6 · T04 → AC4/AC14 ·
T05 → AC15/AC16 · T06 → AC13 · T07 → AC5/AC7/AC9/AC10/AC11/AC12 ·
T08 → AC1/AC6/AC12/AC13/AC14. No orphans. No frontend task, because the spec has no screen.

## Deferred — must NOT appear in any of these tasks

- A portal inbox, toast, or email template body
- A notification call inside submit, approve or fulfilment HTTP handlers
- Employee mail on `fulfilment-failed.v1`
- Draft reminders
- SMS, push, a second locale
- Name or email lookup for `HR_BUSINESS_PARTNER`

## Execution Notes

| Task | Branch | PR | Red confirmed | Green confirmed | Gate 2 | Merged |
|---|---|---|---|---|---|---|
| `T01` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T02` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T03` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T04` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T05` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T06` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T07` | `feature/internal-transfer-notifications` | — | — | — | — | — |
| `T08` | `feature/internal-transfer-notifications` | — | — | — | — | — |
