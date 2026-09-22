# Tasks: Internal Transfer Approval Chain

## Derived From

`.ai-context/plans/internal-transfer-approval-chain.plan.md` (Plan Drafted — plan review pending)

Generated from the plan's Sequencing section on 2026-09-22.

Backend tasks follow `.agent/rules/int-standards.node.md`.
Frontend tasks follow `.agent/rules/int-standards.react.md`.

v1.3 `If-Match` behaviour (AC15) is inside T05. Do not start implementation until the
spec's Gate 1 block names v1.3 Approved. See the plan's Derived From.

## Task States

Checkbox state in this file is the task state:
`[ ]` Not Started · `[~]` In Progress · `[r]` In Review · `[x]` Merged

## How these are executed

One task, one prompt, one branch, one review. Red tests are confirmed failing before
implementation. Do not prompt this file as a whole.

## Sequence

- [ ] `internal-transfer-approval-chain.T01` — Backend: approvals inbox
      — Acceptance: `API01`, `AC6` (only stages the caller may decide), `AC7` (no reason
        on the list), `AC13` (401)
      — Tests first: `UT17` (inbox has no `reason`). API01 401 and "only stages this caller may decide" are part of AC6 and AC13 on this route
      — Touches: `employee-services/src/internal-transfer/approval/api/`,
        `employee-services/src/internal-transfer/approval/readmodel/`
      — Depends on: `internal-transfer-request.T01`, `internal-transfer-request.T05`
      — Note: composite index for `assigned_party_ref` + `IN_PROGRESS`, and for
        `HR_VALIDATION` + `IN_PROGRESS`. Page size only 10, 25 or 50. No N+1 name lookup

- [ ] `internal-transfer-approval-chain.T02` — Backend: approval detail
      — Acceptance: `API02`, `AC6` (404, not 403), `AC7` (reason key only for
        `HR_BUSINESS_PARTNER`), `AC13`
      — Tests first: `UT13`, `UT15`, `UT16`
      — Touches: `employee-services/src/internal-transfer/approval/api/`,
        `employee-services/src/internal-transfer/approval/readmodel/`
      — Depends on: `T01`
      — Note: response includes `version` for the decision screen's `If-Match`. Reason
        is decrypted only for the HR role and is not logged

- [ ] `internal-transfer-approval-chain.T03` — Backend: approve transaction
      — Acceptance: `AC1`, `AC2`, `AC3`
      — Tests first: `UT01`, `UT02`, `UT03`, `UT04`, `UT05`, `UT06`
      — Touches: `employee-services/src/internal-transfer/approval/domain/`,
        `employee-services/src/internal-transfer/approval/api/`
      — Depends on: `T02`
      — Note: one transaction, no outbound HTTP. `MANAGER_RELEASE` approve stays in
        `MANAGER_REVIEW` and emits `stage-pending.v1` for `MANAGER_ACCEPT`.
        `MANAGER_ACCEPT` approve moves to `HR_VALIDATION`. HR approve requires
        `confirmedEffectiveDate`, sets `FULFILMENT`, moves `ORG_DATA_UPDATE` to
        `IN_PROGRESS`, emits `approved.v1` with the allow-list payload

- [ ] `internal-transfer-approval-chain.T04` — Backend: reject transaction
      — Acceptance: `AC4`, `AC5`
      — Tests first: `UT07`, `UT08`, `UT09`, `UT10`, `UT11`
      — Touches: `employee-services/src/internal-transfer/approval/domain/`
      — Depends on: `T03`
      — Note: failure path is its own task. `REJECTED`, incomplete stages `CANCELLED`,
        `confirmedEffectiveDate` stays null, `rejected.v1` has no reason text

- [ ] `internal-transfer-approval-chain.T05` — Backend: idempotency, compare-and-swap, races
      — Acceptance: `AC8`, `AC9`, `AC10`, `AC15`, `AC13` on API03
      — Tests first: `UT12`, `UT14`, `UT18`, `UT19`, `UT20`, `UT21`, `UT22`, `UT23`,
        `UT28`, `UT30`, `UT31`, `UT32`
      — Touches: `employee-services/src/internal-transfer/approval/api/`,
        `employee-services/src/internal-transfer/approval/persistence/`
      — Depends on: `T03`, `T04`
      — Note: idempotent replay is checked before `If-Match`. Null `assigned_party_ref`
        is 409 `assignee-unresolved` with no live lookup and no delegation. Blocked for
        implementation until the spec names v1.3 Approved

- [ ] `internal-transfer-approval-chain.T06` — Backend: audit, narrative exclusion, rate limits
      — Acceptance: `AC11`
      — Tests first: `UT24`, `UT25`
      — Touches: `employee-services/src/internal-transfer/approval/`, gateway rate-limit
        configuration for API01 (300/hour), API02 (300/hour), API03 (30/hour)
      — Depends on: `T03`, `T04`
      — Note: log capture is across the HR approve path, not a redaction unit test.
        Counter key is a salted hash of the token subject

- [ ] `internal-transfer-approval-chain.T07` — Frontend: manager inbox and decision
      — Acceptance: `AC12`, `AC14`, and the manager half of `AC7` (no reason control,
        because the key is absent)
      — Tests first: `UT26`, `UT29`, plus a Playwright journey: open inbox, open a
        release decision, approve, see the stage leave the inbox
      — Touches: `employee-portal-web/src/features/internal-transfer-approval/`
      — Depends on: `T01`, `T02`, `T03`
      — Note: RTK Query only. Design system components. Copy externalised. Queries by
        accessible role. MSW uses the spec's 200 and problem bodies, including 409
        `version-conflict`, which is shown to the user and not overwritten. No reason
        in storage, URL or analytics. Unauthenticated visit uses the portal sign-in.
        `axe` and a keyboard pass are part of this task

- [ ] `internal-transfer-approval-chain.T08` — Frontend: HR inbox and validation
      — Acceptance: `AC12`, `AC14`, HR half of `AC7` (reason rendered, then not stored)
      — Tests first: `UT27`, plus a Playwright journey: HR opens validation, sees reason
        text from the fixture only in the document, approves with a confirmed date,
        and a 422 on a missing date is announced and associated with that field
      — Touches: `employee-portal-web/src/features/internal-transfer-approval/`
      — Depends on: `T02`, `T03`, `T07`
      — Note: reason text is not written to a slice, `localStorage`, the URL or a log.
        Confirmed date is required only on HR approve. This feature does not import the
        employee wizard feature

## Traceability

| AC | Covered by | Test cases | Status |
|---|---|---|---|
| `AC1` — release approve | T03 | UT01, UT02 | Not Started |
| `AC2` — accept approve | T03 | UT03 | Not Started |
| `AC3` — HR approve and confirmed date | T03 | UT04, UT05, UT06 | Not Started |
| `AC4` — reject is terminal | T04 | UT07, UT08, UT09 | Not Started |
| `AC5` — out of order refused | T04 | UT10, UT11 | Not Started |
| `AC6` — 404, token identity | T01, T02 | UT12, UT13, UT14 | Not Started |
| `AC7` — reason only for HR | T01, T02, T07, T08 | UT15, UT16, UT17 | Not Started |
| `AC8` — idempotency | T05 | UT18, UT19, UT20 | Not Started |
| `AC9` — withdrawn or lost race | T05 | UT21, UT22 | Not Started |
| `AC10` — null assignee | T05 | UT23 | Not Started |
| `AC11` — no narrative in logs; append-only audit | T06 | UT24, UT25 | Not Started |
| `AC12` — WCAG on four screens | T07, T08 | UT26, UT27 | Not Started |
| `AC13` — 401 | T01, T05 | UT28 | Not Started |
| `AC14` — portal session, no transfer login | T07, T08 | UT29 | Not Started |
| `AC15` — `If-Match` | T05 | UT30, UT31, UT32 | Not Started |

**Reverse check:** T01 → AC6/AC7/AC13 · T02 → AC6/AC7/AC13 · T03 → AC1/AC2/AC3 ·
T04 → AC4/AC5 · T05 → AC8/AC9/AC10/AC13/AC15 · T06 → AC11 · T07 → AC7/AC12/AC14 ·
T08 → AC7/AC12/AC14. No orphans.

## Deferred — must NOT appear in any of these tasks

- Submit, withdraw, wizard, or status page
- Re-evaluation of BR1–BR8, or a disciplinary API call
- A fulfilment webhook POST from the approve handler
- Any notification HTTP call
- Delegation, SLA, free-text comments, return-for-edit
- A login form

## Execution Notes

| Task | Branch | PR | Red confirmed | Green confirmed | Gate 2 | Merged |
|---|---|---|---|---|---|---|
| `T01` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T02` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T03` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T04` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T05` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T06` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T07` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
| `T08` | `feature/internal-transfer-approval-chain` | — | — | — | — | — |
