# Test Cases: Employee Internal Transfer Request

> The QA-expanded view of the spec's own Unit Test Cases table — same IDs, more coverage.
> Cases derive from acceptance criteria, never from reading finished code.
>
> Cross-feature and end-to-end journeys are **not** here; they live in `_integration.md`.

## Derived From

`.ai-context/specs/internal-transfer-request.spec.md` (v1.1, In Peer Review)
**Owner:** Alamgir Sarkar · **Last updated:** 2026-09-01

## Coverage Summary

| AC | Spec-derived | QA-expanded | Non-functional | Status |
|---|---|---|---|---|
| AC1 | UT01, UT02 | UT01a, UT02a | — | Not Run |
| AC2 | UT03–UT05 | UT04a | — | Not Run |
| AC3 | UT06, UT07 | UT06a, UT07a | — | Not Run |
| AC4 | UT08–UT11 | UT08a–UT08d | — | Not Run |
| AC5 | UT12, UT13 | UT13a | — | Not Run |
| AC6 | UT14 | UT14a, UT14b | — | Not Run |
| AC7 | UT15–UT20 | UT16a–UT16c, UT18a | — | Not Run |
| AC8 | UT21–UT23 | UT22a | — | Not Run |
| AC9 | UT24–UT26 | UT25a, UT26a | — | Not Run |
| AC10 | UT27–UT29 | UT27a, UT27b | — | Not Run |
| AC11 | UT30–UT33 | UT30a, UT31a | — | Not Run |
| AC12 | UT34, UT35 | UT34a, UT34b | PT02 | Not Run |
| AC13 | UT36, UT37 | NT01–NT04 | ST01 | Not Run |
| AC14 | UT38–UT41 | UT38a, UT39a | — | Not Run |
| AC15 | UT42–UT45 | IT01–IT04 | — | Not Run |
| AC16 | UT46–UT48 | ST02–ST05 | — | Not Run |
| AC17 | UT49, UT50 | NT05 | PT03 | Not Run |
| AC18 | UT51, UT52 | UT51a | — | Not Run |
| AC19 | UT53–UT55 | AT01–AT05 | — | Not Run |

## Spec-Derived Cases

Carried forward from the spec unchanged in meaning and ID. See
`.ai-context/specs/internal-transfer-request.spec.md` → *Unit Test Cases (spec-derived)* for
the full table of `UT01`–`UT55`; they are not duplicated here, because a copy is a copy that
goes stale. QA owns the expansions below.

## QA-Expanded Cases

| Test ID | AC | Type | Scenario | Data | Expected |
|---|---|---|---|---|---|
| `UT01a` | AC1 | Unit | Reference sequence rolls into a new calendar year | Last reference `ITR-2026-000999`, clock at 01-Jan-2027 | New reference is `ITR-2027-000001`, not `ITR-2027-001000` |
| `UT02a` | AC1 | Unit | Employee whose service in position is exactly 0 months (started today) | Join date = today | Draft still creates; BR2 fails only at submit, not at draft |
| `UT04a` | AC2 | Integration | Two browser tabs both autosave the same draft | Tab A version 3, tab B version 3 | First 200, second 409 with `currentVersion: 4`; no field silently lost |
| `UT06a` | AC3 | Unit | Submit with a whitespace-only reason and all mandatory fields present | `reason: "   "` | 200 — reason is optional and whitespace is not a value |
| `UT07a` | AC3 | Unit | Submit with `reason` at exactly 2000 and at 2001 characters | Boundary | 200 and 422 respectively |
| `UT08a` | AC4 | Unit | Effective date on 29 February in a leap year | 2028-02-29 | Accepted; no date arithmetic error |
| `UT08b` | AC4 | Unit | Employee in UTC+13 submits at 23:30 local, date is day+14 locally but day+13 in UTC | Timezone boundary | Evaluated in UTC against the database clock; result is deterministic and the message states the window |
| `UT08c` | AC4 | Unit | Effective date falls on a public holiday | Holiday date | Accepted — no holiday rule exists, and QA confirms none is silently invented |
| `UT08d` | AC4 | Unit | Effective date supplied in the wrong format | `01/10/2026` | 422 `validation-failed` naming the field, not a 500 |
| `UT13a` | AC5 | Unit | Target position differs but resolves to the same department and location | Lateral move within a team | 200 — position alone satisfies BR5 |
| `UT14a` | AC6 | Integration | Position filled by another candidate between draft and submit | Position closed mid-flight | 422 citing BR6, with a message that does not imply the employee did something wrong |
| `UT14b` | AC6 | Integration | Position exists but is externally-only | `internallyFillable: false` | Not present in API07 output; 422 if submitted directly |
| `UT16a` | AC7 | Unit | Service length 12 months at effective date but 11 at submission date | Boundary straddling the two dates | 200 — BR2 is measured at the requested effective date, not at submission |
| `UT16b` | AC7 | Unit | Employee with a prior transfer in the same position | Two spells in one position | Service computed from the current spell's start, per HR Policy §4.2 |
| `UT16c` | AC7 | Unit | Employee returning from a long leave of absence | Break in service | Uses HRIS `continuousServiceDate`; QA raises a spec query if the HRIS field is ambiguous rather than guessing |
| `UT18a` | AC7 | Unit | Resignation submitted and then withdrawn before the transfer request | `exitStatus: WITHDRAWN` | 200 — only an *active* exit process blocks |
| `UT22a` | AC8 | Integration | Employee whose previous request was `REJECTED` | Terminal state | 201 — terminal states do not block a new request |
| `UT25a` | AC9 | Integration | Target differs in department, location, grade and cost centre | Maximal change | All eight stages `applicable: true` |
| `UT26a` | AC9 | Integration | Database connection lost mid-transaction | Fault injection | Request remains `DRAFT`; no orphan stage, audit or outbox rows |
| `UT27a` | AC10 | Integration | Two submits with the same key arriving genuinely concurrently | Parallel | One 200, one 200 with the identical body; exactly one outbox row |
| `UT27b` | AC10 | Integration | Same key replayed at 24 hours + 1 minute | TTL boundary | Treated as a new submission and refused with 409 `invalid-state-transition` — not silently re-submitted |
| `UT30a` | AC11 | Integration | Request where all conditional stages are inapplicable | Same department and location | All three still returned with `applicable: false` |
| `UT31a` | AC11 | Integration | Line manager leaves the organisation after submission | Party ref no longer resolves | Role shown, `assignedPartyName` null, no error |
| `UT34a` | AC12 | Integration | Employee with 26 requests, page 3 at size 10 | Pagination boundary | 6 items, `totalPages: 3` |
| `UT34b` | AC12 | Integration | `status` filter with a mix of valid and invalid values | `SUBMITTED,BANANA` | 400 `validation-failed`; no partial filtering |
| `UT38a` | AC14 | Integration | Withdrawal where some stages are already `COMPLETED` | Mixed stage states | Completed stages untouched; only incomplete ones become `CANCELLED` |
| `UT39a` | AC14 | Integration | Withdrawal racing a transition into `FULFILMENT` | Concurrent | Exactly one wins; the loser gets a coherent 409, never a 500 |
| `UT51a` | AC18 | Integration | Full lifecycle across three sessions | Multi-session | Each audit row carries the correlation ID of its own originating call, not the first one |

## Negative and Security Cases

| Test ID | AC | Scenario | Expected |
|---|---|---|---|
| `NT01` | AC13 | Employee A requests employee B's request by its real UUID | 404 `request-not-found`; response and logs contain no field of B's request |
| `NT02` | AC13 | Valid token, `employeeId` of another employee supplied in the body of API03 | Ignored; acts on the token subject's own request |
| `NT03` | AC13 | Expired token | 401; no service-side processing |
| `NT04` | AC13 | Token valid for a different tenant or a non-employee principal | 403 at the gateway; the service is never reached |
| `NT05` | AC17 | Rate limit exhausted, then a valid request after `Retry-After` elapses | 429 then 200; no state change during the blocked window |
| `NT06` | AC3 | SQL metacharacters in `reason` | Stored and returned verbatim; no query error, no injection |
| `NT07` | AC3 | Script payload in `reason` | Stored verbatim, escaped on render; no execution in the wizard or the status view |
| `NT08` | AC3 | 5 MB request body | Rejected at the gateway body-size limit before reaching the service |
| `NT09` | AC6 | `targetPositionId` referencing a position in another legal entity | 422 — out of scope for internal transfer, not a 500 |
| `ST01` | AC13 | Enumerate 1000 random UUIDs as one employee | Uniform 404s; no timing difference distinguishing existing from non-existing |
| `ST02` | AC16 | Capture every log line, span attribute and metric label across the full lifecycle | Reason text appears in none of them, at any level, including debug |
| `ST03` | AC16 | Inspect the emitted Kafka payloads | Allow-listed fields only; no reason, no names, no contact details |
| `ST04` | AC16 | Inspect the `reason_ciphertext` column directly | Ciphertext; plaintext not recoverable from the database alone |
| `ST05` | AC16 | Trigger a 500 with reason text present | Error response and stack trace contain no reason text |
| `ST06` | — | Dependency scan of anything added by this feature | No new dependency without a vetting note; no crypto-adjacent package added |

## Non-Functional Cases

| Test ID | Concern | Scenario | Threshold (from `constitution.md`) | Result |
|---|---|---|---|---|
| `PT01` | Performance | API03 submit under 50 concurrent employees | p95 < 700 ms at the gateway | Not Run |
| `PT02` | Performance | API04 and API05 under 200 concurrent employees | p95 < 400 ms | Not Run |
| `PT03` | Performance | API07 with a warm cache | p95 < 400 ms; HRIS call count stays flat as load rises | Not Run |
| `PT04` | Resilience | HRIS latency injected at 5 s | Circuit breaker opens; the transfer journey degrades and no other portal journey is affected | Not Run |
| `PT05` | Resilience | Kafka unavailable for 30 minutes | Submissions keep succeeding; outbox backlog drains on recovery; the age alert fires | Not Run |
| `PT06` | Resilience | Redis unavailable | Reference data falls through to the HRIS; submit refused (idempotency fails closed); reads unaffected | Not Run |
| `AT01` | Accessibility | Full wizard by keyboard only | Every control reachable and operable; focus order matches visual order | Not Run |
| `AT02` | Accessibility | NVDA and VoiceOver through submit with a validation error | Error announced and programmatically associated with its field | Not Run |
| `AT03` | Accessibility | Status timeline at 200% zoom and in greyscale | Stage status readable as text; no meaning carried by colour alone | Not Run |
| `AT04` | Accessibility | Automated axe scan of every screen | Zero serious or critical violations | Not Run |
| `AT05` | Accessibility | Wizard with `prefers-reduced-motion` | No motion-dependent state change | Not Run |

## Device and Browser Matrix

| Surface | Coverage |
|---|---|
| Desktop | Chrome, Edge, Safari, Firefox — current and current-1 |
| Tablet | Safari on iPadOS, Chrome on Android |
| Mobile web | Safari on iOS, Chrome on Android — 360 px minimum width |
| Assistive tech | NVDA on Windows, VoiceOver on macOS and iOS |

## Environment and Data

| Test type | Environment | Data | Notes |
|---|---|---|---|
| Unit | local, dev | Synthetic fixtures | Real PostgreSQL via Testcontainers — the database constraints are what UT23 and UT52 prove |
| Integration | dev, sit | Synthetic employees seeded with deliberate edge profiles: probation, 11.5 months in position, active exit, no line manager, manager who has left | Contract doubles for the HRIS in dev; real HRIS test instance in sit |
| Performance | sit | 10,000 synthetic employees, 2,000 positions | Run before release, not after |
| Accessibility | sit | Any | Automated plus a manual pass; automation alone does not satisfy AC19 |
| UAT | uat | Masked, non-production | **Never production PII**, including in a screenshot attached to a defect |

## UAT Traceability

UAT traces line by line to acceptance criteria by AC ID. A UAT failure with no matching AC
means the spec was incomplete or Gate 1 missed a gap — either way the spec is updated, not
just the code, and it is counted in the UAT-defect-to-spec-gap KPI.

| UAT scenario | AC | Business validator | Result | Defect | Spec gap? |
|---|---|---|---|---|---|
| Employee raises a transfer to another department and location | AC1, AC3, AC4, AC9 | HR Ops | Not Run | — | — |
| Employee on probation is refused with a reason they understand | AC7 | HR Policy | Not Run | — | — |
| Employee sees the journey and who it is with, without contacting anyone | AC11 | Product | Not Run | — | — |
| Employee changes their mind and withdraws | AC14 | HR Ops | Not Run | — | — |
| Employee cannot see, and is not told about, another employee's request | AC13 | Data Privacy | Not Run | — | — |
| Transfer reason is visible to HR and to nobody else | AC16 | Data Privacy | Not Run | — | — |
| Journey completes with keyboard and screen reader only | AC19 | Accessibility lead | Not Run | — | — |

## QA Notes and Open Queries

- `UT16c` (continuous service after a leave of absence) is a genuine ambiguity QA found while
  expanding AC7: BR2 says "12 months continuous service in current position" and the HRIS
  exposes both `positionStartDate` and `continuousServiceDate`. The spec does not say which
  governs when they differ. **Raised to the spec author on 2026-09-01; not guessed at.** If
  the answer changes behaviour, AC7 is revised and this file follows it — QA does not encode
  an interpretation the spec never made.
- `UT08c` deliberately asserts that *no* public-holiday rule exists. Absent rules need tests
  too, otherwise a helpful implementation invents one and nobody notices until UAT.
- Performance cases are scheduled before release, not after. A p95 discovered in production is
  an incident, not a measurement.
