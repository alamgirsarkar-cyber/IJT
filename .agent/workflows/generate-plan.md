# Workflow: /generate-plan

> Reusable prompt template. Use this instead of freehand instructions — freehand costs
> tokens re-explaining the same thing and produces inconsistent output run to run.

**Precondition:** the spec is `Approved` in `.ai-context/status.md`, reviewed by a named
peer who is not the author. If it is not, stop — there is no plan to write yet.

## Inputs to tag into the session

Tag exactly these. Do not let the agent scan the workspace.

- `.ai-context/specs/<feature-slug>.spec.md`
- `.ai-context/constitution.md`
- `.ai-context/architecture.md` (only the sections the spec's Context names)
- `.ai-context/plans/_TEMPLATE.plan.md`
- Any related plan the spec's Context links, plus ADRs it depends on
- The specific modules the feature will touch — not their parent trees

## Prompt

```
Draft the technical plan for <feature-slug>.

Source of truth: .ai-context/specs/<feature-slug>.spec.md (Approved, v<X.Y>).
Use .ai-context/plans/_TEMPLATE.plan.md as the structure — every section present, no
section left empty.

Requirements:
1. Decide the technical approach only. Do not restate the spec's intent or acceptance
   criteria, and do not introduce behaviour the spec does not define.
2. Name integration points and the data model explicitly. Anything left for
   implementation time to infer is a gap this plan must close.
3. Complete the Constitution Check line by line against
   .ai-context/constitution.md. Answer every rule, including the ones this feature
   appears not to touch — state "not touched, because ..." rather than omitting the line.
   Silence on a rule is a Gate 1 rejection.
4. Make the rate-limit decision explicit for every new or changed endpoint, even if the
   decision is "none" — give the reason.
5. Cover failure and boundary behaviour: timeouts, partial failure, duplicate
   submission, concurrent update. Map each to the AC it serves.
6. For every dependency you propose, state why a platform built-in will not do.
7. Flag ADR candidates: any decision whose reversal would cost more than a day of rework.
8. Fill Explicitly Deferred with the items the spec put out of scope, plus anything you
   are deliberately not building — with the reason and who deferred it.
9. Produce Sequencing as an ordered list where every step is independently generatable,
   reviewable and mergeable.

If any part of the spec is ambiguous enough that two competent engineers would plan
differently, stop and list the ambiguities instead of choosing one. Do not proceed on an
assumption.
```

## After generation — engineer review before Gate 1

- [ ] Every Constitution Check line is answered, not skipped
- [ ] Data model states ownership, retention, and what keys deliberately do not contain
- [ ] Failure paths are covered, and each maps to an AC
- [ ] No behaviour appears here that is absent from the spec (that is scope creep entering
      at the plan, where it is cheapest to remove)
- [ ] Sequencing steps are independently mergeable
- [ ] ADR candidates assessed against the day-of-rework test
- [ ] Documentation Impact filled in

## Next step

Plan goes to Gate 1 with the spec. Security or Architecture sign-off is **required**, not
optional, wherever the plan touches a Security Posture or Architectural Constraints rule.
On approval, status moves to `Plan Reviewed` and `/generate-tasks` can run from the
Sequencing section.
