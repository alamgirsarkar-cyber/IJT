# Integration & System Test Cases — One-Point Employee Portal

> The one master test-case file that remains after the per-feature split. Cross-feature and
> system-level scenarios that do not map cleanly to a single spec.
>
> Per-feature cases live in `.ai-context/test_cases/<feature-slug>.test_cases.md`. If a
> scenario fits inside one spec's scope, it does not belong here.

**Last updated:** 2026-09-01 · **Owner:** Alamgir Sarkar

## Status of the Internal Transfer Journey

Only `internal-transfer-request` is specced and planned. The approval chain, downstream
orchestration and notifications are not started, so the end-to-end journey cannot yet be
executed in full. The scenarios below are written now anyway, because they define what
"working" means for the journey as a whole and they are what each subsequent spec is measured
against — writing them after the fact would mean deriving them from whatever got built.

| Scenario set | Executable today? | Blocked on |
|---|---|---|
| Submission and visibility (`INT-E2E-01`) | Yes, once `internal-transfer-request` merges | — |
| Full transfer journey (`INT-E2E-02`) | No | `internal-transfer-approval-chain`, `internal-transfer-downstream-orchestration` |
| Notification journeys | No | `internal-transfer-notifications` |

## End-to-End Journeys

| Test ID | Journey | Specs spanned | Steps | Expected |
|---|---|---|---|---|
| `INT-E2E-01` | Employee submits and tracks a transfer | `internal-transfer-request` | Sign in → open the transfer wizard → select department, location, position → set an effective date → add a reason → review → submit → view status → view pending-with | Request is `SUBMITTED` with a reference number; all eight stages visible with correct applicability; `pendingWith` is the line manager release stage; one event published |
| `INT-E2E-02` | Transfer approved end to end | request → approval chain → downstream orchestration → notifications | Submit → line manager releases → receiving manager accepts → HR validates and confirms the effective date → HRIS org update → payroll, IT and facilities where applicable → employee confirmation | Status reaches `COMPLETED`; every applicable stage is `COMPLETED`; HRIS reflects the new assignment on the confirmed effective date; employee notified at each transition |
| `INT-E2E-03` | Transfer declined by the receiving manager | request → approval chain → notifications | Submit → line manager releases → receiving manager declines | Status `REJECTED` and terminal; remaining stages `CANCELLED`; no downstream event emitted; employee may raise a new request immediately |
| `INT-E2E-04` | Employee withdraws mid-approval | request → approval chain → notifications | Submit → line manager releases → employee withdraws | Status `WITHDRAWN`; incomplete stages `CANCELLED`; approvers told it is no longer with them; BR3 no longer blocks a new request |
| `INT-E2E-05` | Withdrawal attempted after fulfilment has begun | request → approval chain → downstream orchestration | Submit → all approvals → fulfilment starts → employee attempts to withdraw | 409 `withdrawal-window-closed` directing the employee to HR; no state change; the guidance matches what HR can actually do |

## Cross-Feature Interaction

| Test ID | Features | Interaction under test | Expected |
|---|---|---|---|
| `INT-X-01` | `internal-transfer-request` × `internal-transfer-approval-chain` | Both write to `transfer_request_stage` | Stage plan created by one and transitioned by the other; no lost update; ordering respected |
| `INT-X-02` | `internal-transfer-request` × `internal-transfer-approval-chain` | Employee withdraws at the same moment an approver acts | Exactly one outcome persists; both actors see a coherent result; no stage left `IN_PROGRESS` on a terminal request |
| `INT-X-03` | Internal transfer × portal leave journey | The same employee has an approved leave period spanning the transfer effective date | Both journeys remain independent; neither blocks the other; no shared-state contention |
| `INT-X-04` | Internal transfer × portal notification preferences | Employee has muted portal notifications | Transfer state still advances; visibility in the portal is unaffected by notification preference |
| `INT-X-05` | Internal transfer × HRIS nightly reference-data refresh | Refresh runs while a submission is in flight | Submission uses live employment data and is unaffected; reference-data cache repopulates without serving a partial list |

## Regression Suite

Runs on every release cut. Each entry names why it exists — a regression case with no
remembered origin gets deleted by the next person who sees it fail.

| Test ID | Scenario | Origin | Expected |
|---|---|---|---|
| `INT-REG-01` | Reason text absent from every log, event, notification and list response | AC16; proposed constitution amendment of 2026-08-28 | No occurrence anywhere across a full journey |
| `INT-REG-02` | Concurrent create attempts yield exactly one active request | Plan § concurrency / BR3 — a read-then-write check would have passed sequential tests | One row; one 409 |
| `INT-REG-03` | Audit rows cannot be updated or deleted by the application role | Plan § audit immutability | Database rejects the attempt |
| `INT-REG-04` | Another employee's request returns 404, not 403 | AC13 — guards against a well-meaning "usability fix" | Uniform 404 with no timing signal |
| `INT-REG-05` | Portal journeys other than internal transfer are unaffected while the HRIS is down | Constitution's no-cascade rule | Other journeys pass their own smoke suites |

## System-Level Failure Scenarios

| Test ID | Injected failure | Blast radius under test | Expected behaviour |
|---|---|---|---|
| `INT-FAIL-01` | HRIS fully unavailable | Whole portal | Transfer submission refused with 503; every other portal journey healthy |
| `INT-FAIL-02` | HRIS slow at 5 s | Transfer journey | Circuit breaker opens; fast 503 rather than a queue of held connections |
| `INT-FAIL-03` | Downstream webhook unreachable for 30 minutes | Transfer submission | Submissions succeed; outbox grows; age alert fires; backlog drains on recovery with no duplicates visible to the employee |
| `INT-FAIL-04` | Outbox relay killed between POST and marking published | Downstream consumers | Event republished on restart; consumers deduplicate on `requestId`; no duplicate downstream action |
| `INT-FAIL-05` | SQLite unavailable | Transfer journey | All endpoints return 503; no partial writes |
| `INT-FAIL-06` | SQLite database unavailable mid-submission | Transfer submission | In-flight transaction rolls back; the request remains `DRAFT`; no orphan rows; recovery within the RTO |
| `INT-FAIL-07` | Rolling deploy with the new migration applied and mixed application versions running | Whole portal | Both versions operate correctly against the new schema — the additive-migration rule proven, not assumed |

## Non-Functional (System)

| Test ID | Concern | Scenario | Threshold (from `constitution.md`) |
|---|---|---|---|
| `INT-NFR-01` | Load | Portal peak with the transfer journey at 5% of traffic | Portal p95 unchanged within noise |
| `INT-NFR-02` | Soak | 24 hours of steady transfer traffic | No connection, memory or outbox-row leak |
| `INT-NFR-03` | Failover | SQLite backup and restore drill | RPO ≤ 15 min, RTO ≤ 1 hr |
| `INT-NFR-04` | Availability | Trailing 30-day measurement post-release | ≥ 99.9% on transfer endpoints |

## Environment and Data

| Environment | Data strategy | Refresh | Owner |
|---|---|---|---|
| sit | Synthetic employees with deliberate edge profiles; HRIS test instance | Weekly | QA |
| uat | Masked, non-production | Per UAT cycle | HR Ops + QA |

Production PII never enters a test environment, a fixture, a defect attachment or an agent
prompt.
