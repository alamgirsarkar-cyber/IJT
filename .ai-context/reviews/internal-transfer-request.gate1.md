# Gate 1 — Spec Peer Review: `internal-transfer-request`

> The most consequential review in the lifecycle. An approved spec deterministically
> generates code, tests and documentation simultaneously, so a miss here does not cost one
> bad diff — it costs a bad diff, bad tests that pass because they were derived from the
> same bad premise, and documentation that faithfully records the wrong intent.

## Review Record

| Field | Value |
|---|---|
| Spec under review | `.ai-context/specs/internal-transfer-request.spec.md` |
| Version reviewed | v1.0 |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikary |
| Security / Architecture (constitution check) | Covered in Gate 1 by Abhijit Adhikary |
| Submitted | 2026-08-27 16:10 |
| First response | 2026-08-28 09:40 |
| Outcome round 1 | **Changes Requested** — 5 Blockers, 4 Should-fix, 1 Nit |
| Revised version | v1.1 submitted 2026-08-28 14:05 |
| Outcome round 2 | **Approved** 2026-08-28 17:20 |
| Turnaround | 1 working day. SLA is same day for ≤ 5 AC; this spec has 19, so the 48-hour outer bound applied and was met |

Plan review (Gate 1 continued, §13) is recorded separately in
`.ai-context/reviews/internal-transfer-request.gate1-plan.md`.

---

## Findings — Round 1

### G1-F01 — Blocker — Testability

**Where:** v1.0 AC6, "Given an employee who is not eligible, when they submit, then the
request is rejected with a clear message."

**Finding:** "Not eligible" is an adjective standing in for a criterion, and "a clear
message" is not verifiable. Four separate business rules (BR1, BR2, BR4, and the manual
BR9) are collapsed into one AC, so a generated implementation could satisfy this AC while
checking only one of them, and a generated test would pass. It also gives the agent no way
to know that failures must be reported *together* rather than one at a time — an employee
who fails two rules should not have to submit twice to discover the second.

**Required change:** enumerate each rule by ID; specify that every failed rule produces its
own `violations` entry in a single response; state which rules the portal evaluates and
which it does not.

**Resolution (v1.1):** AC7 rewritten citing BR1, BR2 and BR4 individually with per-rule
violations; UT19 added specifically to prove two failures are reported together.

---

### G1-F02 — Blocker — Ambiguity

**Where:** v1.0 AC11, "The employee can withdraw the request before it reaches fulfilment."

**Finding:** silent on three things a plan would have to guess at, and would guess at
differently on different days: what happens to the stage records on withdrawal; what
happens when the employee withdraws twice, which the UI makes easy with a double click; and
whether a `DRAFT` is "withdrawn" or "discarded". Withdrawal being idempotent or not is a
user-visible behaviour, not an implementation detail.

**Required change:** specify stage handling, the repeat-withdrawal response and the draft
case explicitly.

**Resolution (v1.1):** AC14 rewritten — incomplete stages become `CANCELLED`; a repeat
withdrawal returns 200 with the unchanged resource and writes no second audit record; a
`DRAFT` returns 409 `invalid-state-transition` because a draft is discarded, not withdrawn.
UT38–UT41 added.

---

### G1-F03 — Blocker — Contract sanity

**Where:** v1.0 `internal-transfer-request.API03` exception table.

**Finding:** the table covers the happy path plus two errors. Missing: the case where the
employee acquires a second active request between drafting and submitting (BR3 is checked
on create in v1.0 but not on submit, which leaves a real race open); `Idempotency-Key`
reuse against a different request; and what happens when the HRIS is unavailable and
eligibility therefore cannot be evaluated at all. That last one matters most — without it
stated, the likely generated behaviour is to submit anyway with unevaluated rules, which is
worse than refusing.

**Required change:** complete the exception table; state explicitly that a 503 leaves the
request in `DRAFT` with nothing partially written.

**Resolution (v1.1):** three rows added to the API03 table; AC15 extended to cover submit
under HRIS unavailability; UT45 added asserting no stage, audit or outbox rows exist after
a 503.

---

### G1-F04 — Blocker — Constitution compliance (Security Posture)

**Where:** v1.0 spec generally — the `reason` field is defined in the payload and never
mentioned again.

**Finding:** the reason field is free text in which an employee may describe a grievance,
a health circumstance or a problem with a named manager. The constitution's PII list at the
time did not name free-text employee narrative, so a literal reading permitted logging it
and putting it in an event payload — and an agent reading the constitution literally is
exactly what we should expect. The spec is silent, and silence on a Security Posture rule
is a gap, not a pass. Additionally, the business question of *who may read it* was still
open (BRD-001 OQ-12) and cannot be resolved by an engineer inside a spec.

**Required change:** get OQ-12 answered by Data Privacy; then state handling end to end —
storage, visibility, events, notifications, logs, error messages.

**Resolution (v1.1):** OQ-12 closed as a Data Privacy decision — visible to the
employee and HR Business Partner only, never to either manager. `constitution.md` amended
the same day to name free-text employee narrative as a protected category, so every future
spec inherits the rule instead of rediscovering it. AC16 added; UT46–UT48 added, including
a log-capture assertion across the whole submit path.

---

### G1-F05 — Blocker — Ambiguity

**Where:** v1.0 AC4, "the effective date must be a valid future date."

**Finding:** "future date" permits tomorrow, which no handover can accommodate, and permits
a date five years out. It is also silent on payroll alignment, which Payroll raised during
discovery. Two competent engineers would implement two different validations, and both
would look correct.

**Required change:** state the window numerically; state whether payroll misalignment blocks
or warns — that is a business decision, not an engineering one.

**Resolution (v1.1):** BR7 window (14–180 days) and BR8 (advisory, non-blocking) confirmed
with HR Policy. AC4 rewritten with both. UT08–UT11 added, including both inclusive boundaries.

---

### G1-F06 — Blocker — Constitution compliance (Security Posture) + Ambiguity

**Where:** v1.0 AC9, "the employee can see who the request is pending with."

**Finding:** ambiguous between a role and a named person, and the two have materially
different privacy consequences. Naming the receiving manager discloses that a specific
person is handling a specific employee's transfer, which is information the employee's own
department could infer things from. This is a business and privacy decision (OQ-11), not one
the spec author can settle.

**Required change:** resolve OQ-11, then state exactly which stages may carry a name.

**Resolution (v1.1):** OQ-11 answered — a name appears only where the assignee is the
employee's own line manager, whom the employee already knows. All other stages show role
only. AC11 rewritten; UT31 and UT32 added to assert both sides.

---

### G1-F07 — Should-fix — Dependency check

**Where:** v1.0 Context and AC11.

**Finding:** the spec references states (`MANAGER_REVIEW`, `HR_VALIDATION`, `FULFILMENT`)
that are transitioned by `internal-transfer-approval-chain`, which is **Not started**. Read
literally, this spec depends on an unbuilt spec, which would fail the Gate 1 dependency
check and block approval.

**Assessment on review:** it is a *definition* dependency, not a *build* dependency — this
spec owns the aggregate and therefore owns the state machine; the other spec drives some of
the transitions. That is the correct direction. But it is not written down, so the next
reader has to re-derive it, and a Gate 2 reviewer would reasonably ask why tests set states
directly in fixtures.

**Required change:** state it in Context.

**Resolution (v1.1):** note added to Context explaining which transitions this spec drives,
which it only defines, and how the AC covering them is verified.

---

### G1-F08 — Should-fix — Constitution compliance (Security Posture)

**Where:** v1.0 API Contract, all endpoints.

**Finding:** the constitution requires an explicit rate-limit decision per endpoint, and the
spec makes none for any of the seven. Two are worth thinking about rather than defaulting:
API02 is called by wizard autosave, so a low limit would break normal use, and API03 is the
expensive one and needs a genuinely low limit.

**Required change:** a stated limit per endpoint, with the autosave pattern accounted for.

**Resolution (v1.1):** per-endpoint limits added to the API Contract; AC17 added covering
the 429 behaviour and requiring the counter to be keyed by a salted hash rather than a raw
identifier; UT49 and UT50 added.

---

### G1-F09 — Should-fix — Scope-creep check

**Where:** v1.0 Explicitly Out of Scope.

**Finding:** the list names the approval chain and downstream orchestration but not the
things this feature will actually be tempted to absorb during implementation: editing a
request after submission (a reviewer will ask for it the first time someone typos a date),
HR cancellation past the withdrawal window (AC14 mentions HR without saying the mechanism is
elsewhere), and manager-initiated transfers.

**Required change:** name them.

**Resolution (v1.1):** all three added, plus localisation and native mobile.

---

### G1-F10 — Should-fix — Contract sanity

**Where:** v1.0 API02/API04, 403 on another employee's request.

**Finding:** returning 403 for a request that exists and 404 for one that does not turns the
endpoint into an existence oracle for transfer request IDs. IDs are UUIDs so the practical
risk is low, but the pattern is wrong and it will be copied into the next feature, where the
identifier may be guessable.

**Required change:** return 404 in both cases, and write down *why*, so the next engineer
does not "fix" it back to 403 as a usability improvement.

**Resolution (v1.1):** AC13 rewritten with the rationale stated inline; UT36 added.

---

### G1-F11 — Nit — Contract sanity

**Where:** v1.0 API01 success response.

**Finding:** `referenceNo` is described as "a human-readable reference" with no format, so
the format would be invented at implementation time and become impossible to change once
employees start quoting it to HR.

**Resolution (v1.1):** format fixed as `ITR-<year>-<6-digit sequence>` in AC1, asserted by
UT01.

---

## Checks Performed

| Check | Result |
|---|---|
| **Reviewer ≠ author** | Pass — Abhijit Adhikary; author Alamgir Sarkar |
| **Intent is one unambiguous paragraph** | Pass — reviewer confirmed a zero-context engineer could scope from it |
| **Every AC given/when/then and individually IDed** | Fail in v1.0 (G1-F01, G1-F02, G1-F05, G1-F06) → Pass in v1.1 |
| **API Contract complete — payload, success shape, exception table** | Fail in v1.0 (G1-F03, G1-F10, G1-F11) → Pass in v1.1 |
| **Out-of-scope items explicit** | Fail in v1.0 (G1-F09) → Pass in v1.1 |
| **Ambiguity — could two engineers build materially different things?** | Yes in v1.0 on eligibility, effective date, withdrawal and pending-with → resolved |
| **Constitution compliance** | Fail in v1.0 — silent on employee narrative handling (G1-F04) and on rate limits (G1-F08) → Pass in v1.1, and the constitution itself was amended so the gap does not recur |
| **Overlap with an existing spec** | Pass — no other spec touches the transfer request aggregate; checked against the BRD-001 spec map |
| **Dependency check — Builds-on/Related specs in Approved or Released state** | Pass with clarification (G1-F07) — the three related specs are Not started, and this spec depends on none of them being built |
| **Security / Architecture constitution check** | Pass — Gate 1 reviewer Abhijit Adhikary checked Security Posture and Architectural Constraints on v1.1 |
| **Status updated, never left ambiguous** | Pass — `Changes Requested` on 2026-08-28 09:40, `Approved` on 2026-08-28 17:20 |

## Reviewer's Closing Note

The five Blockers were all in the same class: an acceptance criterion that reads as
reasonable prose but does not constrain an implementation. AC6 ("not eligible"), AC4
("valid future date") and AC9 ("pending with") would each have generated working-looking
code, and — the expensive part — tests derived from the same words, which would have
passed. None of these would have been caught by code review, because the diff would have
matched the spec.

Two of the ten findings turned out not to be spec defects at all but unanswered *business*
questions the author had absorbed into the spec (G1-F04 reason visibility, G1-F06 pending-with
naming). Both went back to their owners and were answered within the day. That is the
discovery gate leaking rather than the spec being poor, and it is worth noting in the retro:
BRD-001 marked both as open, and spec drafting started anyway.

One finding produced a change outside this feature entirely — G1-F04 amended
`constitution.md` so every future spec inherits the free-text rule. That is the outcome
worth having: the gate did not just fix this spec, it removed a category of future defect.

**Outcome: Approved (v1.1).** Plan drafting authorised.
