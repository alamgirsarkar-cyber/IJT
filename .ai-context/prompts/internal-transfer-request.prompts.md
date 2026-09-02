# AI Prompts: `internal-transfer-request`

> Prompt by **identity**, not by description. Every artefact carries a stable ID, so a prompt
> that references the ID survives the spec being edited; a prompt that re-describes the
> feature from memory drifts the moment the spec does.
>
> - Bad: *"Implement the transfer submission endpoint, make sure it validates eligibility."*
> - Good: *"Implement `internal-transfer-request.T05` — must satisfy AC9 and AC10 and match
>   the exception table in `internal-transfer-request.API03`. Do not touch T01–T04, already
>   merged."*
>
> These are the **planned** prompts. What was actually run, with what model and what outcome,
> is appended to `.ai-context/prompt_history.md` by `.agent/rules/auto-log.md`.

## Rules that apply to every prompt below

1. **One task, one prompt.** Never the tasks file in one go.
2. **Two prompts per task, in order:** RED (generate failing tests) then GREEN (implement).
   The engineer confirms Red between them. There is no combined prompt, because a single
   prompt that writes tests and implementation together writes tests that pass.
3. **Context is tagged explicitly** — the spec, the plan section, the task, the stack rules,
   the module under change. Never the repository.
4. **Standing constraint appended to every prompt**, so it does not depend on the agent
   remembering it from the rules file:

   > Do not add AI attribution to any comment or commit message. Do not add a dependency
   > without stating why a platform built-in will not do. Do not log, echo or place in a
   > fixture any value classified as PII in `constitution.md`, including transfer reason text.
   > Do not implement anything listed under *Deferred — must NOT appear in any of these tasks*
   > in `internal-transfer-request.tasks.md`. If the spec is ambiguous, stop and say so rather
   > than choosing an interpretation.

5. **Model choice is a tool decision.** Schema, DTOs and wiring go to the lighter model;
   the submit transaction, concurrency and the security hardening go to the heavier one.

---

## T01 — Schema, migrations and the audit immutability guarantee

**Context tagged:** spec *Request State Machine*, *Stage Plan*, AC1/AC8/AC18; plan *Data
Model*; task T01; `int-standards.node.md`; `migrations/`.
**Model:** lighter — this is structure, not judgement.

**RED**

```
Generate the failing tests for internal-transfer-request.T01.

Derive them strictly from: AC1 (reference number format ITR-<year>-<6 digits> and the
snapshot columns), AC8 (only one request per employee in a non-terminal state), AC18
(audit records cannot be updated or deleted).

Write these tests, one per ID, with the ID in the test name:
- UT01: a created request's reference matches /^ITR-\d{4}-\d{6}$/
- UT23: two genuinely concurrent inserts for the same employee produce exactly one row —
  use two real connections, not two sequential calls
- UT52: an UPDATE against transfer_request_audit as the application role is rejected by the
  database, not by application code

Tests run against a real PostgreSQL via Testcontainers. The point of UT23 and UT52 is that
these are database guarantees; an in-memory substitute would prove nothing.

Write no implementation and no migration. The tests must fail because the schema does not
exist, not because of an import or syntax error.
```

**GREEN**

```
Implement internal-transfer-request.T01 to make UT01, UT23 and UT52 pass.

Deliver, per the Data Model section of internal-transfer-request.plan.md:
- transfer_request, transfer_request_stage, transfer_request_audit, transfer_request_outbox
- transfer_reference_seq and the ITR-<year>-<6 digits> formatting, generated in the database
  so concurrent submissions cannot collide
- partial unique index uniq_active_request_per_employee on employee_id filtered to
  DRAFT, SUBMITTED, MANAGER_REVIEW, HR_VALIDATION, FULFILMENT
- REVOKE UPDATE, DELETE on transfer_request_audit from the application role

Constraints:
- Forward-only and additive. Do not alter an existing table. The migration must be safe under
  a rolling deploy where the previous application version is still running.
- Include confirmed_effective_date and sla_due_at as nullable columns. Nothing writes to them
  in this feature; they exist so the approval-chain spec and BRD-001 OQ-15 need no migration.
- Do not add an ORM-level uniqueness check as a substitute for the index.
```

---

## T02 — HRIS client, reference-data cache and reference-data endpoint

**Context tagged:** spec API07, AC15, AC6; plan *Architecture Approach*, *Integration Points*;
task T02; `docs/contracts/hris-read-api.md`.
**Model:** lighter.

**RED**

```
Generate the failing tests for internal-transfer-request.T02.

From AC15 and internal-transfer-request.API07:
- UT42: HRIS unreachable, cache within TTL → 200 with stale: false
- UT43: HRIS unreachable, cache past TTL → 200 with stale: true
- UT44: HRIS unreachable, cache empty → 503 reference-data-unavailable with Retry-After

Also assert, from AC6, that positions which are not open or not internally fillable never
appear in the response.

Use a contract double for the HRIS built from docs/contracts/hris-read-api.md, not a
hand-rolled stub shaped like the code you expect. No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T02 to make UT42, UT43, UT44 and the AC6 filter pass.

Two read paths with deliberately different caching:
- Reference data (departments, locations, positions): Redis, 900 s TTL, served stale past TTL
  with the stale flag set, keys itr:refdata:*:v1
- Employment data used for eligibility: NOT cached, read fresh

That asymmetry is the design, not an oversight — see plan finding P5 and ADR-0002. Do not
"optimise" the employment read by caching it.

HRIS client: 2 s timeout, 1 retry, circuit breaker at 50% over 20 calls. A breaker-open state
returns the same 503 shape as an outage, so callers have one path to handle.
```

---

## T03 — Draft creation and update

**Context tagged:** spec API01, API02, AC1, AC2, AC8, AC13; task T03; module from T01/T02.
**Model:** lighter.

**RED**

```
Generate the failing tests for internal-transfer-request.T03.

From AC1, AC2, AC8, AC13 and the exception tables of API01 and API02:
- UT01, UT02: creation, reference format, current-assignment snapshot
- UT03, UT04, UT05: If-Match matching, stale and absent
- UT21, UT22, UT23: BR3 blocks on a non-terminal request, does not block on a terminal one,
  and holds under concurrency
- UT36: another employee's request returns 404, and no field of it appears in the body or in
  any log line
- UT37: an employeeId supplied in the request body is ignored for authorisation

Cover every row of both exception tables, not the happy path plus one error. No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T03 to make UT01–UT05, UT21–UT23, UT36 and UT37 pass.

- Identity comes from the token subject only. No endpoint reads an employee identifier from a
  body, query or path for authorisation.
- Not-found and not-owned both return 404 request-not-found. This is deliberate: a 403 would
  confirm the identifier exists (AC13, Gate 1 finding G1-F10). Do not "improve" it to 403.
- If-Match is required on update; a mismatch is 409 carrying currentVersion.
- Map the unique-index violation from T01 to 409 active-request-exists carrying the existing
  request's ID and reference. Do not surface a database error.
```

---

## T04 — Business rule set

**Context tagged:** spec *Business Rules Applied*, AC3–AC7; BRD-001 BR1–BR9; task T04.
**Model:** heavier — this is where a wrong interpretation is most expensive.

**RED**

```
Generate the failing tests for internal-transfer-request.T04.

One test per ID from the spec: UT06 through UT20.

Points the tests must pin down, because they are the ones an implementation gets wrong:
- UT09 and UT17 are inclusive boundaries — exactly 14 days and exactly 12 months both pass
- UT16 measures BR2 at the requested effective date, not at the submission date
- UT11 asserts that a payroll-misaligned date SUCCEEDS with an advisory (BR8 warns, it does
  not block)
- UT19 asserts that two failed rules produce two violations in ONE response, not one violation
  or two round trips
- UT20 asserts that a successful evaluation still returns the BR9 advisory, so a successful
  submission is never presented as full eligibility clearance

Each violation carries its own ruleId. Assert on ruleId, not on message text. No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T04 to make UT06–UT20 pass.

- One function per business rule, named for its rule ID, each returning a violation carrying
  that ID. Not a rules engine — see the plan's ADR Candidates table for why.
- The evaluator runs every rule and collects all violations. It must not short-circuit on the
  first failure; an employee who fails two rules learns both at once (Gate 1 finding G1-F01).
- All date arithmetic in UTC against the database clock, not the application clock (UT08b).
- Implement no rule that is not in the spec's Business Rules Applied table. In particular do
  not add a public-holiday rule for effective dates — UT08c asserts that no such rule exists.
- BR9 is not evaluated. It emits an advisory saying HR checks further. Do not attempt to
  infer disciplinary status from any available field.
```

---

## T05 — Submit transaction

**Context tagged:** spec API03, AC9, AC10, AC15; plan *Failure and Boundary Handling*; task
T05; T03 and T04 output.
**Model:** heavier.

**RED**

```
Generate the failing tests for internal-transfer-request.T05.

From AC9, AC10, AC15 and the full API03 exception table:
- UT24: successful submit → SUBMITTED, 8 stage rows, 1 audit row, 1 outbox row
- UT25: stage applicability — same department and location → PAYROLL_UPDATE, IT_ACCESS and
  FACILITIES persisted with applicable: false, not omitted
- UT26: outbox insert fails → the whole transaction rolls back; status still DRAFT; no stage
  or audit rows. Inject the failure; do not mock the transaction boundary away
- UT27, UT28, UT29: idempotent replay, key reused on a different request, key absent
- UT45: HRIS unavailable → 503, status still DRAFT, no stage, audit or outbox rows

UT26 and UT45 are the point of this task. Assert on persisted state after the failure, not on
the thrown error. No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T05 to make UT24–UT29 and UT45 pass.

One database transaction containing: status change, snapshot freeze, stage-plan insert, audit
insert, outbox insert. All of it commits or none of it does.

- The endpoint takes an empty body. Every value comes from the persisted draft, so a submit
  cannot introduce a value that was never validated (security assessment T8).
- Re-evaluate the T04 rules at submit against live data — a position open at draft time may be
  closed now (AC6, UT14).
- Idempotency-Key required; store the response for 24 h keyed by
  itr:idem:{sha256(employeeId+salt)}:{key}. The idempotency store fails CLOSED: if Redis is
  unavailable, refuse with 503 rather than risk a duplicate submitted transfer (plan finding P4).
- Stage applicability: PAYROLL_UPDATE if target cost centre or grade differs; IT_ACCESS if
  department differs; FACILITIES if location differs. Persist non-applicable stages with
  applicable: false — the employee sees the step was considered.
- Do not transition any stage beyond creating it. Do not send a notification, including a
  confirmation. Both are explicitly deferred.
```

---

## T06 — Outbox relay and event publication

**Context tagged:** ADR-0001; plan *Integration Points*; task T06.
**Model:** heavier.

**RED**

```
Generate the failing tests for internal-transfer-request.T06.

- UT46: the emitted employee.transfer.requested.v1 payload contains no reason field, no names
  and no contact details. Assert against the payload actually published, not against the
  mapper's internals
- Relay: unpublished rows are published in creation order; a crash between publishing and
  marking published republishes on restart (at-least-once, per ADR-0001); backoff is
  exponential; unpublished age beyond 15 minutes raises the alert signal

No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T06.

- Build payloads with an explicit allow-list mapper that names every emitted field. Do NOT
  serialise the aggregate and delete keys — that is one added column away from leaking reason
  text, and it fails Gate 2 security condition C2 even if today's output is correct
  (plan finding P1).
- Partition key is requestId, so events for one request stay ordered.
- Register the schema under docs/contracts/ and state at-least-once delivery and the
  requestId dedupe key in the contract, so consuming teams are not left to discover it.
```

---

## T07 — Status detail and list read model

**Context tagged:** spec API04, API05, AC11, AC12, AC13, AC16; task T07.
**Model:** lighter.

**RED**

```
Generate the failing tests for internal-transfer-request.T07 from AC11, AC12, AC13, AC16.

- UT30: all stages returned in sequence, including applicable: false ones
- UT31: stage assigned to the caller's own line manager → assignedPartyName populated
- UT32: stage assigned to HR or the receiving manager → assignedPartyName null, role present
- UT33: no confirmed date → effectiveDateStatus REQUESTED
- UT34, UT35: only the caller's requests; no reason key on any list item
- UT48: reason present in detail for the owner, absent from the list

UT32 is a privacy assertion, not a formatting one (BRD-001 OQ-11). No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T07.

- assignedPartyName is populated ONLY where the assignee is the caller's own line manager.
  Every other stage returns role only.
- If the snapshotted party reference no longer resolves — the manager has left — show the role
  and no name. Do not error (UT31a).
- The list DTO has no reason field at all. Not null, not omitted at runtime: absent from the
  type, so it cannot be reintroduced by an unrelated change.
```

---

## T08 — Withdrawal

**Context tagged:** spec API06, AC14, AC16; task T08.
**Model:** lighter.

**RED**

```
Generate the failing tests for internal-transfer-request.T08 from AC14 and the API06
exception table: UT38 (withdraw a SUBMITTED request; incomplete stages CANCELLED; audit and
outbox rows written), UT39 (FULFILMENT → 409 withdrawal-window-closed directing the employee
to HR), UT40 (already WITHDRAWN → 200, unchanged, no second audit row), UT41 (DRAFT → 409
invalid-state-transition, because a draft is discarded, not withdrawn).

No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T08.

- Take a row-level lock on the aggregate for the status check and the write, so a withdrawal
  racing a stage transition into FULFILMENT resolves to exactly one outcome with a coherent
  409 for the loser, never a 500 (UT39a).
- Cancel only incomplete stages; leave COMPLETED stages untouched (UT38a).
- withdrawalReason carries the same handling as reason: encrypted, never logged, never in the
  event payload.
```

---

## T09 — Cross-cutting hardening

**Context tagged:** security assessment T3, T7, T9; spec AC16, AC17, AC18; task T09.
**Model:** heavier.

**RED**

```
Generate the failing tests for internal-transfer-request.T09 from AC16, AC17, AC18.

- UT47: capture EVERY log line, span attribute and metric label emitted during a full submit
  — success path and error path — and assert the reason text appears in none of them at any
  level, including debug. Assert against captured output from the real path, not against a
  redaction utility in isolation. This is Gate 2 security condition C1
- UT49: the sixth submit within an hour → 429 with Retry-After, no state change
- UT50: the rate-limit key contains a salted hash, not a raw employee identifier
- UT51: create, update, submit, withdraw → four audit rows, correct from/to statuses, each
  carrying the correlation ID of its OWN originating call

No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T09.

- Field-level encryption for reason and withdrawal reason, using the platform's managed key.
  Do not add a crypto package — the platform primitive does this, and crypto-adjacent
  dependencies are rejected by default under the constitution.
- Redaction layer over the logger as a safety net, not as the primary control. The primary
  control is that the text is never passed to anything that logs.
- Rate limits per the spec's API Contract. Counters keyed itr:rl:{endpoint}:{sha256(employeeId+salt)}.
  Fails closed on submit; open on reads (plan finding P4).
- Correlation ID propagated from the gateway header into every audit row and every log line.
```

---

## T10 — Front end: transfer wizard and status timeline

**Context tagged:** spec AC11, AC12, AC14, AC19; `int-standards.react.md`; design `OPP/ITR/v1`.
**Model:** lighter for components, heavier for the accessibility pass.

**RED**

```
Generate the failing tests for internal-transfer-request.T10 from AC19, plus the front-end
surfacing of AC11, AC12 and AC14.

- UT53: the whole wizard is operable by keyboard alone; focus order matches visual order
- UT54: a submit validation error is announced and is programmatically associated with its
  field
- UT55: in greyscale, every stage status is still distinguishable as text
- A Playwright journey: draft → submit → view status → withdraw

React Testing Library queried by accessible role and name, never by test ID — a component
findable only by test ID is a component a screen reader cannot find either. No implementation.
```

**GREEN**

```
Implement internal-transfer-request.T10.

- Four-step wizard: target → date → reason → review. Autosave to API02 with If-Match; on 409
  tell the employee the request changed elsewhere rather than silently overwriting (UT04a).
- Status timeline renders every stage including applicable: false ones, labelled "Not
  required" — the employee sees the step was considered, not skipped by mistake.
- Label the requested effective date as requested until a confirmed date exists (BRD-001 OQ-05).
- Show the reference-data freshness notice when stale is true.
- Redux Toolkit and RTK Query only; no second state library.
- Externalise all copy into resource files. Do not add a localisation library — localisation
  is explicitly out of scope; only the copy structure is being prepared.
- Accessibility is an acceptance condition of this task, not a follow-up.
```

---

## Review prompt — run before every Gate 2 submission

Uses `.agent/workflows/code-review.md` with the feature's IDs substituted:

```
Review this diff for internal-transfer-request.T<NN> against its specification.

Answer each individually, citing file and line:
1. For each AC named in the task — satisfied, partially satisfied, or not? Quote the code.
2. Does every response shape and status code match the endpoint's exception table in full?
3. Check the diff against constitution.md section by section. Flag any PII or reason text
   reaching a log at any level, any hardcoded credential, any endpoint without its stated
   rate limit.
4. Does the diff implement anything under "Deferred — must NOT appear in any of these tasks"
   in internal-transfer-request.tasks.md?
5. List every dependency added, with whether a platform built-in already does it.
6. Failure paths: partial failure, timeouts, concurrent updates. Where is the happy path
   handled and the failure path missing?
7. Production performance: N+1 queries, missing indexes, unbounded result sets.
8. Any AI attribution in comments or commit messages?

Categorise every finding as Blocker / Should-fix / Nit. Do not restate what the code does.
```

## Anti-patterns this prompt set deliberately avoids

| Anti-pattern | How it is avoided here |
|---|---|
| Mega-prompting | Ten task prompts, never the tasks file at once |
| Retrofitting tests | RED prompt and GREEN prompt are separate, with an engineer-confirmed Red between them |
| Prompting by description | Every prompt names AC, API, UT and task IDs |
| Re-prompting against ambiguity | The standing constraint tells the agent to stop and report rather than choose; a second wrong generation means the spec gets fixed, not the prompt |
| Dumping the repo into context | Each prompt lists exactly what is tagged in |
| Letting the agent pick architecture | The GREEN prompts state the decision and the reason, so the agent implements a decision rather than making one |
| Unvetted dependencies | The standing constraint requires a justification before any package is added |
