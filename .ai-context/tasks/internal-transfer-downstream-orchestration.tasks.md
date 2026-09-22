# Tasks: Internal Transfer Downstream Orchestration

## Derived From

`.ai-context/plans/internal-transfer-downstream-orchestration.plan.md` (Plan Drafted — plan review pending)

Generated from the plan's Sequencing section on 2026-09-22.

All tasks are backend and follow `.agent/rules/int-standards.node.md`.
The spec defines no employee-facing screen, so there is no frontend task. Employee
rendering of fulfilment stage labels stays on `internal-transfer-request.T07` and `T11`.

T07 (AC20, v1.4 compare-and-swap) does not start until Gate 1 re-reviews v1.4.

## Task States

Checkbox state in this file is the task state:
`[ ]` Not Started · `[~]` In Progress · `[r]` In Review · `[x]` Merged

## How these are executed

One task, one prompt, one branch, one review. Red tests are confirmed failing before
implementation. Do not prompt this file as a whole.

## Sequence

- [ ] `internal-transfer-downstream-orchestration.T01` — Backend: webhook signature
      — Acceptance: `AC8`, `AC11`, `AC16`
      — Tests first: `UT11`, `UT15`, `UT23`, `UT24`
      — Touches: `employee-services/src/internal-transfer/fulfilment/api/`
      — Depends on: `internal-transfer-request.T01`
      — Note: HMAC-SHA256 over the spec's five-line canonical string, raw body hashed
        before parse, constant-time compare, ±300 s, key id from Secrets Manager.
        Unknown or retired key id is 401 with no source list. An employee bearer token
        without a valid HMAC is 401. Body, signature and secret are not logged.
        No new crypto dependency

- [ ] `internal-transfer-downstream-orchestration.T02` — Backend: start fulfilment
      — Acceptance: `AC1`, `AC6`
      — Tests first: `UT01`, `UT02`, `UT09`
      — Touches: `employee-services/src/internal-transfer/fulfilment/domain/`
      — Depends on: `T01`, `internal-transfer-approval-chain.T03`
      — Note: handler runs after `approved.v1` is published, not inside the approval
        HTTP transaction. `ORG_DATA_UPDATE` becomes `IN_PROGRESS` with one
        `fulfilment-stage.v1` row, or the transaction rolls back. Later stages stay
        `NOT_STARTED`. No HTTP call to Payroll, ITSM, Facilities or an HRIS write

- [ ] `internal-transfer-downstream-orchestration.T03` — Backend: sequential success
      — Acceptance: `AC2`, `AC3`, `AC19`
      — Tests first: `UT03`, `UT04`, `UT05`, `UT14`, `UT27`, `UT28`
      — Touches: `employee-services/src/internal-transfer/fulfilment/domain/`,
        `employee-services/src/internal-transfer/fulfilment/api/`
      — Depends on: `T01`, `T02`
      — Note: at most one work stage `IN_PROGRESS`. Non-applicable stages are never
        signalled. Last applicable success completes `EMPLOYEE_CONFIRMATION` and the
        request, and writes `completed.v1`. Out-of-order report is 409. UT28 uses a
        contract double

- [ ] `internal-transfer-downstream-orchestration.T04` — Backend: failure, cancel, compensate
      — Acceptance: `AC4`, `AC12`
      — Tests first: `UT06`, `UT07`, `UT16`, `UT17`
      — Touches: `employee-services/src/internal-transfer/fulfilment/domain/`
      — Depends on: `T03`
      — Note: request stays `FULFILMENT`. One `fulfilment-failed.v1`. Compensate in
        reverse sequence. Zero compensate events when org update is the failing stage.
        Later `NOT_STARTED` work stages become `CANCELLED` and are never signalled

- [ ] `internal-transfer-downstream-orchestration.T05` — Backend: compensation acknowledgement
      — Acceptance: `AC13`, `AC14`, `AC17`
      — Tests first: `UT18`, `UT19`, `UT20`, `UT25`, `UT29`
      — Touches: `employee-services/src/internal-transfer/fulfilment/domain/`
      — Depends on: `T04`
      — Note: `COMPENSATED` or `COMPENSATION_FAILED`. No re-signal and no portal retry.
        A report against `FAILED` or `CANCELLED` is 409. No scheduled resume job.
        UT29 uses a contract double

- [ ] `internal-transfer-downstream-orchestration.T06` — Backend: idempotency, allow-list, audit, rate limit
      — Acceptance: `AC5`, `AC7`, `AC9`, `AC10`, `AC15`, `AC18`
      — Tests first: `UT08`, `UT10`, `UT12`, `UT13`, `UT21`, `UT22`, `UT26`, `UT30`
      — Touches: `employee-services/src/internal-transfer/fulfilment/persistence/`,
        `docs/contracts/`
      — Depends on: `T03`, `T04`, `T05`
      — Note: `eventId` row retained for the life of the request. Byte-identical replay
        is 200 and does not increment `version`. Different body is 409
        `idempotency-key-conflict`. `failureCode` outside `^[A-Z0-9_]{1,64}$` is 422
        and is not logged. Audit actor is `SYSTEM` or the webhook source id. Rate limit
        600/hour per source key id. UT30 uses a contract double

- [ ] `internal-transfer-downstream-orchestration.T07` — Backend: compare-and-swap
      — Acceptance: `AC20`
      — Tests first: `UT31`
      — Touches: `employee-services/src/internal-transfer/fulfilment/domain/`
      — Depends on: `T06`
      — **Blocked.** v1.4 is not Approved. Do not start this task until a new Gate 1
        line on the spec names v1.4 Approved. In-transaction expected version, no
        `If-Match`. Byte-identical `eventId` replay stays 200 and does not increment

## Traceability

| AC | Covered by | Test cases | Status |
|---|---|---|---|
| `AC1` — start org update | T02 | UT01, UT02 | Not Started |
| `AC2` — next applicable stage | T03 | UT03, UT04, UT14 | Not Started |
| `AC3` — request completed | T03 | UT05 | Not Started |
| `AC4` — failure and compensate | T04 | UT06, UT07, UT17 | Not Started |
| `AC5` — eventId idempotency | T06 | UT08, UT21 | Not Started |
| `AC6` — no sync downstream call | T02 | UT09 | Not Started |
| `AC7` — payload and logs | T06 | UT10 | Not Started |
| `AC8` — bad HMAC | T01 | UT11 | Not Started |
| `AC9` — report outside fulfilment | T06 | UT12 | Not Started |
| `AC10` — append-only audit | T06 | UT13 | Not Started |
| `AC11` — bearer token rejected | T01 | UT15 | Not Started |
| `AC12` — later stages cancelled | T04 | UT16 | Not Started |
| `AC13` — compensation success | T05 | UT18, UT20 | Not Started |
| `AC14` — compensation failed | T05 | UT19 | Not Started |
| `AC15` — failureCode pattern | T06 | UT22 | Not Started |
| `AC16` — replay window and key rotation | T01 | UT23, UT24 | Not Started |
| `AC17` — no portal resume | T05 | UT25 | Not Started |
| `AC18` — envelope | T06 | UT26 | Not Started |
| `AC19` — out of order refused | T03 | UT27 | Not Started |
| `AC20` — version compare-and-swap | T07 | UT31 | Not Started — blocked on v1.4 Gate 1 |

Integration rows: UT28 on T03, UT29 on T05, UT30 on T06.

**Reverse check:** T01 → AC8/AC11/AC16 · T02 → AC1/AC6 · T03 → AC2/AC3/AC19 ·
T04 → AC4/AC12 · T05 → AC13/AC14/AC17 · T06 → AC5/AC7/AC9/AC10/AC15/AC18 ·
T07 → AC20. No orphans. No frontend task, because the spec has no screen.

## Deferred — must NOT appear in any of these tasks

- A React route, resume button, or "mark complete" action
- Parallel fan-out of payroll, IT and facilities
- An HTTP call to Payroll, ITSM, Facilities or an HRIS write from a request handler
- Notification mail
- Approval decisions
- T07, until v1.4 is Approved

## Execution Notes

| Task | Branch | PR | Red confirmed | Green confirmed | Gate 2 | Merged |
|---|---|---|---|---|---|---|
| `T01` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T02` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T03` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T04` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T05` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T06` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
| `T07` | `feature/internal-transfer-downstream-orchestration` | — | — | — | — | — |
