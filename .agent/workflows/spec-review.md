# Workflow: /spec-review (Gate 1)

> The most consequential review in the lifecycle — more so than code review. An approved
> spec deterministically generates code, tests and documentation simultaneously, so a miss
> here does not cost one bad diff: it costs a bad diff, bad tests that pass because they
> were derived from the same bad premise, and documentation that faithfully records the
> wrong intent. A code-review miss is contained to its PR. A spec-review miss propagates.
>
> The agent pass below is a first sweep for the reviewer, never the reviewer. The named
> human peer signs off.

## Who reviews

- A named reviewer who is **not the author**.
- For features with an API Contract, at least one reviewer who will also touch Gate 2 for
  this feature, or a domain SME — someone reading for "does this contract make sense
  against what already exists," not just "is this readable."
- Security or Architecture sign-off is **required**, not optional, whenever the plan
  touches a Security Posture or Architectural Constraints rule in `constitution.md`.

## Turnaround

Same working day for a spec with five or fewer acceptance criteria. 48 hours is the outer
bound, past which it is an escalation, not a delay.

## Inputs to tag into the session

- `.ai-context/specs/<feature-slug>.spec.md`
- `.ai-context/plans/<feature-slug>.plan.md`, if the plan is attached to this review
- `.ai-context/constitution.md`
- `.ai-context/BRD.md` — the linked entry
- The specs listed under Context as "Builds on" / "Related"

## Prompt

```
Review .ai-context/specs/<feature-slug>.spec.md for Gate 1. Report findings only — do not
rewrite the spec.

Check each of these separately and cite the line:

1. Ambiguity — could two competent engineers build materially different things from this
   intent or from any acceptance criterion? For each ambiguity, state both readings.
2. Testability — is every AC phrased given/when/then with an observable outcome? Flag any
   adjective standing in for a criterion: secure, fast, robust, user-friendly.
3. Completeness of failure paths — which AC cover only the happy path? What happens on
   invalid input, unauthorised access, dependency timeout, duplicate submission,
   concurrent update? Silence here means the plan will guess.
4. Contract sanity — does the API Contract payload shape match existing conventions in
   this service? Is the exception table exhaustive, or is it the happy path plus one
   error? Are auth, rate limit and idempotency each decided explicitly?
5. Scope creep — does Explicitly Out of Scope actually name the things this feature will
   be tempted to also fix?
6. Constitution compliance — does the spec, or the attached plan, violate or stay silent
   on anything in .ai-context/constitution.md? Silence on a rule is a gap, not a pass.
7. Overlap — does an existing spec already cover part of this?
8. Dependencies — are the specs under "Builds on" and "Related" actually in Approved or
   Released state, or is this spec quietly depending on something that is not yet real?
9. Traceability — does every AC trace to the linked BRD entry, and does the BRD entry have
   requirements this spec silently drops?

Categorise each finding as Blocker / Should-fix / Nit.
```

## Gate 1 checklist — the human reviewer

- [ ] Reviewer ≠ author
- [ ] Intent is one unambiguous paragraph
- [ ] Every AC is given/when/then and individually IDed
- [ ] API Contract complete — payload, success shape, exception table — if applicable
- [ ] Out-of-scope items explicit
- [ ] Plan, if attached, checked line by line against `constitution.md`
- [ ] Related and Builds-on specs are actually in Approved or Released state
- [ ] No overlap with an existing spec
- [ ] Security / Architecture sign-off obtained where the constitution requires it
- [ ] Status updated to `Approved` or `Changes Requested` — never left ambiguous

## Outcome

Binary at the status level, even where the feedback is nuanced:

- **Approved** → status moves to `Approved`; plan drafting can start.
- **Changes Requested** → status stays `In Peer Review`; the spec is revised and its
  version marker bumped (`Draft v1.1`) so the revision history is visible in the file
  itself, not only in git blame.

Record the outcome in `.ai-context/status.md` the same day.
