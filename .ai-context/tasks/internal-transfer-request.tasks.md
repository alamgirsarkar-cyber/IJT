# Tasks: Employee Internal Transfer Request

## Derived From

`.ai-context/plans/internal-transfer-request.plan.md` (Plan Drafted — plan review pending)

Generated from the plan's Sequencing section and reviewed by the engineer on 2026-09-01.

## Task States

Checkbox state in this file is the task state:
`[ ]` Not Started · `[~]` In Progress · `[r]` In Review · `[x]` Merged

## How these are executed

One task, one prompt, one branch, one review. The agent is run against a single task ID with
only that task's context tagged in; the Red tests are generated and confirmed failing before
any implementation prompt runs. Prompts are in
`.ai-context/prompts/internal-transfer-request.prompts.md`.

## Sequence

- [ ] `internal-transfer-request.T01` — Schema, migrations and the audit immutability guarantee
      — Acceptance: `AC1` (reference number format, snapshot columns), `AC8` (partial unique
        index enforces BR3), `AC18` (append-only audit)
      — Tests first: `UT01` (reference format), `UT23` (concurrent create), `UT52` (audit
        update rejected at the database)
      — Touches: `employee-services/src/internal-transfer/persistence/`,
        `employee-services/migrations/`
      — Delivers: `transfer_request`, `transfer_request_stage`, `transfer_request_audit`,
        `transfer_request_outbox`, `transfer_reference_seq`, the partial unique index, and
        `REVOKE UPDATE, DELETE` on the audit table
      — Note: the index and the revoke are the point of this task, not incidental to it —
        plan § concurrency / BR3 (partial unique index)

- [ ] `internal-transfer-request.T02` — HRIS client, reference-data cache and reference-data endpoint
      — Acceptance: `internal-transfer-request.API07`, `AC15` (staleness and unavailability),
        `AC6` (only open, internally fillable positions are offered)
      — Tests first: `UT42`, `UT43`, `UT44`
      — Touches: `internal-transfer/integration/hris/`, `internal-transfer/cache/`
      — Depends on: `T01`
      — Note: two read paths with deliberately different caching — reference data cached and
        servable stale, employment data uncached. Both live here; the asymmetry is the design,
        not an oversight (plan finding P5)

- [ ] `internal-transfer-request.T03` — Draft creation and update
      — Acceptance: `API01`, `API02`, `AC1`, `AC2` (optimistic concurrency), `AC8` (create
        side), `AC13` (ownership and 404-not-403)
      — Tests first: `UT01`, `UT02`, `UT03`, `UT04`, `UT05`, `UT21`, `UT22`, `UT23`, `UT36`, `UT37`
      — Touches: `internal-transfer/api/`, `internal-transfer/domain/request.ts`
      — Depends on: `T01`, `T02`

- [ ] `internal-transfer-request.T04` — Business rule set
      — Acceptance: `AC3`, `AC4` (BR7 window and BR8 advisory), `AC5` (BR5), `AC6` (BR6),
        `AC7` (BR1, BR2, BR4, and the mandatory BR9 advisory)
      — Tests first: `UT06` … `UT20`
      — Touches: `internal-transfer/rules/`
      — Depends on: `T02`
      — Note: one function per rule ID, each returning a violation carrying its own `ruleId`;
        every failed rule reports in the same response, never one at a time (AC7).
        Both date boundaries are inclusive and both are tested

- [ ] `internal-transfer-request.T05` — Submit transaction
      — Acceptance: `API03`, `AC9` (single transaction: status, snapshot freeze, stage plan,
        audit, outbox), `AC10` (idempotency), `AC15` (503 leaves the draft untouched)
      — Tests first: `UT24`, `UT25`, `UT26`, `UT27`, `UT28`, `UT29`, `UT45`
      — Touches: `internal-transfer/api/`, `internal-transfer/domain/`, `internal-transfer/outbox/`
      — Depends on: `T03`, `T04`
      — Note: the all-or-nothing assertion in `UT26` is the reason this is one task rather
        than three — splitting it would let each part pass while the guarantee fails

- [ ] `internal-transfer-request.T06` — Outbox relay and event publication
      — Acceptance: `AC9` (the event is delivered to the downstream webhook), `ADR-0001`
        (at-least-once, allow-list payload, unpublished-age alert)
      — Tests first: `UT46` (no reason text in the emitted payload), plus relay tests for
        backoff, crash-resume and duplicate publication
      — Touches: `internal-transfer/outbox/relay.ts`, `docs/contracts/`
      — Depends on: `T05`
      — Note: payload built by an explicit allow-list mapper, never by serialising the
        aggregate (plan § event payload allow-list)

- [ ] `internal-transfer-request.T07` — Status detail and list read model
      — Acceptance: `API04`, `API05`, `AC11` (stage rendering, `pendingWith`, the naming
        rule), `AC12` (own requests only, pagination, no reason in lists), `AC13`
      — Tests first: `UT30`, `UT31`, `UT32`, `UT33`, `UT34`, `UT35`, `UT48`
      — Touches: `internal-transfer/api/`, `internal-transfer/readmodel/`
      — Depends on: `T05`
      — Note: non-applicable stages are returned, not filtered out; `assignedPartyName` is
        populated only for the caller's own line manager (AC11, BRD-001 OQ-11)

- [ ] `internal-transfer-request.T08` — Withdrawal
      — Acceptance: `API06`, `AC14` (state guard, stage cancellation, repeat withdrawal,
        draft case), `AC16` (withdrawal reason handled as narrative)
      — Tests first: `UT38`, `UT39`, `UT40`, `UT41`
      — Touches: `internal-transfer/api/`, `internal-transfer/domain/`
      — Depends on: `T05`

- [ ] `internal-transfer-request.T09` — Cross-cutting hardening
      — Acceptance: `AC16` (field-level encryption, log absence), `AC17` (rate limits, hashed
        counter keys), `AC18` (correlation ID on every audit record)
      — Tests first: `UT47` (log capture across the whole submit path), `UT49`, `UT50`, `UT51`
      — Touches: `internal-transfer/security/`, `internal-transfer/observability/`,
        gateway rate-limit configuration
      — Depends on: `T05`, `T07`, `T08`
      — Note: `UT47` asserts across the real submit path, not against a redaction unit — the
        thing being proven is that no log line anywhere contains the text, not that a
        redaction function works

- [ ] `internal-transfer-request.T10` — Front end: transfer wizard and status timeline
      — Acceptance: `AC19` (WCAG 2.1 AA), and the employee-facing surfacing of `AC11`, `AC12`,
        `AC14`
      — Tests first: `UT53`, `UT54`, `UT55`, plus a Playwright journey covering draft → submit
        → view → withdraw
      — Touches: `employee-portal-web/src/features/internal-transfer/`
      — Depends on: `T03`, `T07`, `T08`
      — Note: accessibility is an acceptance condition of this task. Automated axe checks plus
        a manual keyboard and screen-reader pass; the stage timeline must not convey status by
        colour alone

## Traceability

Every AC is covered by at least one task, and every task serves at least one AC. A task
serving no AC is scope creep; an AC served by no task is a build gap. Both are caught here,
before generation.

| AC | Covered by | Test cases | Status |
|---|---|---|---|
| `AC1` — draft created with reference and snapshot | T01, T03 | UT01, UT02 | Not Started |
| `AC2` — optimistic concurrency on update | T03 | UT03, UT04, UT05 | Not Started |
| `AC3` — mandatory fields at submit | T04 | UT06, UT07 | Not Started |
| `AC4` — effective date window and payroll advisory | T04 | UT08, UT09, UT10, UT11 | Not Started |
| `AC5` — target must differ | T04 | UT12, UT13 | Not Started |
| `AC6` — position open and internally fillable | T02, T04 | UT14 | Not Started |
| `AC7` — eligibility rules and the BR9 advisory | T04 | UT15–UT20 | Not Started |
| `AC8` — one active request | T01, T03 | UT21, UT22, UT23 | Not Started |
| `AC9` — atomic submit | T05, T06 | UT24, UT25, UT26 | Not Started |
| `AC10` — idempotent submit | T05 | UT27, UT28, UT29 | Not Started |
| `AC11` — status view and pending-with naming | T07, T10 | UT30–UT33 | Not Started |
| `AC12` — own requests only, paginated, no reason | T07, T10 | UT34, UT35 | Not Started |
| `AC13` — ownership, 404 not 403, token-derived identity | T03, T07 | UT36, UT37 | Not Started |
| `AC14` — withdrawal window and stage cancellation | T08, T10 | UT38–UT41 | Not Started |
| `AC15` — dependency unavailability and degradation | T02, T05 | UT42–UT45 | Not Started |
| `AC16` — employee narrative handling | T06, T07, T08, T09 | UT46, UT47, UT48 | Not Started |
| `AC17` — rate limiting | T09 | UT49, UT50 | Not Started |
| `AC18` — immutable audit trail | T01, T09 | UT51, UT52 | Not Started |
| `AC19` — accessibility | T10 | UT53, UT54, UT55 | Not Started |

**Reverse check — every task serves an AC:** T01 → AC1/AC8/AC18 · T02 → AC6/AC15 ·
T03 → AC1/AC2/AC8/AC13 · T04 → AC3–AC7 · T05 → AC9/AC10/AC15 · T06 → AC9 ·
T07 → AC11/AC12/AC13/AC16 · T08 → AC14/AC16 · T09 → AC16/AC17/AC18 · T10 → AC19/AC11/AC12/AC14.
No orphans in either direction.

## Deferred — must NOT appear in any of these tasks

Carried from the plan's Explicitly Deferred section and from the plan review, so Gate 2 can
check the implementation did not creep into them:

- Any stage transition beyond creating the stage rows — no approval logic
- Any notification, including a confirmation message emitted on submit
- Any write to `confirmed_effective_date` or `sla_due_at`
- Approver delegation resolution
- The reason-text purge job
- Any synchronous call to Payroll, ITSM or Facilities, including a status check

## Execution Notes

| Task | Branch | PR | Red confirmed | Green confirmed | Gate 2 | Merged |
|---|---|---|---|---|---|---|
| `T01` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T02` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T03` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T04` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T05` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T06` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T07` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T08` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T09` | `feature/internal-transfer-request` | — | — | — | — | — |
| `T10` | `feature/internal-transfer-request` | — | — | — | — | — |
