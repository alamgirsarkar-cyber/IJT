# Gate 2 — Code Review Evidence: `internal-transfer-request`

> Gate 2 verifies the diff against the spec's acceptance criteria **by ID**, not against a
> sense that it looks reasonable. This file is the evidence record: it is prepared before
> implementation so that what will be checked is fixed in advance, and filled in per task as
> each one merges.

## Current State

**Implementation has not started.** The artefact chain is complete through
`tasks.md`; T01–T10 are all Not Started. Every row below is therefore *Not yet evidenced*.

This file exists now, rather than being written at review time, for the same reason the tests
are written before the code: a checklist assembled after seeing the diff tends to check what
the diff happens to contain.

| Field | Value |
|---|---|
| Spec | `internal-transfer-request.spec.md` v1.1 (In Peer Review — not yet Approved) |
| Plan | `internal-transfer-request.plan.md` (Plan Drafted — plan review pending) |
| Security assessment | `.ai-context/security/internal-transfer-request.security.md` — Draft; conditions C1–C3 when build starts |
| Reviewer | Tapas Dutta |
| Branch | `feature/internal-transfer-request` |
| Tasks in scope | T01–T10 |

## Acceptance Criteria Verification

Each AC is verified individually by ID against the diff. "Looks reasonable" is not an entry
in the Method column.

| AC | Verification method | Evidence | Verdict |
|---|---|---|---|
| AC1 | UT01, UT02 green; reference format asserted by regex, not by inspection | — | Not yet evidenced |
| AC2 | UT03–UT05 green; UT04a proves the two-tab case | — | Not yet evidenced |
| AC3 | UT06, UT07 green; one violation per missing field, verified in the response body | — | Not yet evidenced |
| AC4 | UT08–UT11 green; both boundaries inclusive; UT11 proves BR8 warns rather than blocks | — | Not yet evidenced |
| AC5 | UT12, UT13 green | — | Not yet evidenced |
| AC6 | UT14, UT14a green — position re-validated at submit, not at draft | — | Not yet evidenced |
| AC7 | UT15–UT20 green; UT19 proves multiple violations in one response; UT20 proves the BR9 advisory is always present on success | — | Not yet evidenced |
| AC8 | UT21–UT23 green; UT23 run against a real database with two connections | — | Not yet evidenced |
| AC9 | UT24–UT26 green; **UT26 is the one that matters** — persisted state inspected after an injected outbox failure | — | Not yet evidenced |
| AC10 | UT27–UT29, UT27a, UT27b green | — | Not yet evidenced |
| AC11 | UT30–UT33 green; UT32 is the privacy assertion, checked by reading the DTO as well as the test | — | Not yet evidenced |
| AC12 | UT34, UT35 green; reviewer confirms the list DTO type has no reason field, not merely that it is null at runtime | — | Not yet evidenced |
| AC13 | UT36, UT37, NT01, ST01 green; reviewer confirms 404 for both cases and that no authorisation path reads a caller-supplied identifier | — | Not yet evidenced |
| AC14 | UT38–UT41 green; UT39a proves the race resolves without a 500 | — | Not yet evidenced |
| AC15 | UT42–UT45 green; PT04 confirms no cascade into other journeys | — | Not yet evidenced |
| AC16 | UT46–UT48, ST02–ST05 green; **security condition C1** — UT47 asserts on captured output from the real path including an error path | — | Not yet evidenced |
| AC17 | UT49, UT50 green; reviewer inspects the key construction | — | Not yet evidenced |
| AC18 | UT51, UT52 green; UT52's rejection must come from the database | — | Not yet evidenced |
| AC19 | UT53–UT55, AT01–AT05; automated axe **plus** a manual keyboard and screen-reader pass — automation alone does not satisfy this AC | — | Not yet evidenced |

## Test-First Evidence

Red must be confirmed before implementation, per task. The evidence is the failing run, not an
assertion that it happened.

| Task | Red run | Failures for absent behaviour (not import/syntax errors) | Green run | Coverage | Verdict |
|---|---|---|---|---|---|
| T01 | — | — | — | — | Not started |
| T02 | — | — | — | — | Not started |
| T03 | — | — | — | — | Not started |
| T04 | — | — | — | — | Not started |
| T05 | — | — | — | — | Not started |
| T06 | — | — | — | — | Not started |
| T07 | — | — | — | — | Not started |
| T08 | — | — | — | — | Not started |
| T09 | — | — | — | — | Not started |
| T10 | — | — | — | — | Not started |

Coverage floor for this module is **85%**, because it handles employee records. Coverage is a
floor: a task at 85% with no failure-path tests fails this gate regardless of the number.

## Deferred-Scope Check

The plan and the plan review both listed what must not appear. Gate 2 verifies the
implementation did not creep into it — this is a check *for* absence, which no test can prove
and only a reviewer can.

| Deferred item | Where it would show up | Verdict |
|---|---|---|
| Any stage transition beyond creating stage rows | A status change in T05 or T08 outside the defined transitions | Not yet checked |
| Any notification, including a submit confirmation | An outbound call or a second event type in T05 | Not yet checked |
| Writes to `confirmed_effective_date` | Any UPDATE touching that column | Not yet checked |
| Writes to `sla_due_at` | Stage insert in T05 | Not yet checked |
| Approver delegation resolution | Party-reference resolution in T07 | Not yet checked |
| Reason-text purge job | Any scheduled task added | Not yet checked |
| Synchronous calls to Payroll, ITSM or Facilities | Any HTTP client in the request path | Not yet checked |

## Security Checklist

| Item | Verdict | Note |
|---|---|---|
| No PII in logs at any level | Not yet checked | Condition **C1** — evidence is UT47 against the real path |
| No secrets, credentials or tokens hardcoded or logged | Not yet checked | |
| Every new or changed endpoint has its stated rate limit implemented | Not yet checked | Seven endpoints, seven limits |
| New dependencies vetted before entering the manifest | Not yet checked | Condition **C3** — dependency diff across T01–T10 with vetting notes |
| Auth boundaries and least privilege checked, not assumed | Not yet checked | Includes the revoked audit-table privileges |
| Data at rest and in transit per `constitution.md` | Not yet checked | Field-level encryption on both narrative fields |
| Event payloads built by allow-list, not by serialising the aggregate | Not yet checked | Condition **C2** |
| SAST/DAST and dependency scan run and clean | Not yet checked | Necessary, not sufficient — T1, T2, T6, T8 and T12 are business-logic flaws no scanner detects |

## Definition of Done

| Item | Verdict |
|---|---|
| All acceptance criteria verified individually by ID | Not yet |
| Tests written first, confirmed Red, then Green | Not yet |
| No AI attribution in comments or commit messages (task-ID references are fine) | Not yet |
| No secrets, PII or client-confidential data in spec, plan, tasks or code | Holds for the artefacts as written |
| Security checklist passed against `constitution.md` | Not yet |
| `architecture.md` / ADRs updated | **Done** — updated at plan approval; ADR-0001 and ADR-0002 filed |
| Gate 2 review complete, categorised feedback addressed | Not yet |
| `test_cases/internal-transfer-request.test_cases.md` and spec `Status` updated | Test cases done; spec status moves on release |
| `status.md` updated same day | **Done** |

## Findings

Recorded per task as review happens, categorised Blocker / Should-fix / Nit.

| ID | Task | Severity | Finding | Resolution |
|---|---|---|---|---|
| — | — | — | *No implementation reviewed yet* | — |

## What This Gate Will Be Watching For

Recorded in advance by the reviewer, from the spec and plan and from where
agent-generated code characteristically fails:

1. **Failure paths present but hollow** — a `catch` that logs and rethrows in place of the
   specified behaviour. AC15 and AC9 are the ones to read carefully, because the correct
   behaviour there is "persist nothing," which is invisible in a diff and only provable by
   inspecting state after an injected failure.
2. **Tests that assert the implementation rather than the criterion** — asserting that a
   redaction function was called instead of that no log line contains the text. Condition C1
   exists specifically to stop that substitution.
3. **The database guarantees quietly reimplemented in code** — a service-level uniqueness
   check alongside the partial unique index, or an audit repository that would work without
   the revoked privileges. Both would pass the tests and both would remove the guarantee the
   next time someone refactors.
4. **Scope creep into deferred items**, most likely a confirmation notification on submit,
   which is a small, helpful-looking addition that belongs to another spec.
5. **N+1 queries in the status view** — stages and party references resolved per row. It will
   pass every functional test and fail under load.
