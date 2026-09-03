# ADR-NNNN: <Decision Title>

<!--
  Copy to .ai-context/decisions/ADR-NNNN-<slug>.md.

  ADRs are the one exception to slug-scoped identifiers — they get project-global
  sequential IDs, because a decision can outlive and apply across more than one feature.

  File an ADR when:
  - Reversing the decision later would cost more than a day of rework.
  - The same class of incident recurs a third time in the same area.
  - A plan needs to depart from, or extend, a rule in constitution.md.

  A line in a plan is not an ADR. If the decision constrains future features, it belongs
  here, referenced from architecture.md.
-->

## Status

<Proposed / Accepted / Superseded by ADR-NNNN / Deprecated>

**Date:** <date> · **Deciders:** <names / roles> · **Consulted:** <security, architecture, product>

## Related

- Plan: `.ai-context/plans/<feature-slug>.plan.md`
- Supersedes: <decision made in <slug>.plan.md, or ADR-NNNN, or "nothing">
- Incidents that drove this: <refs, with occurrence count>

## Context

<The forces and constraints driving the decision — what is true today that makes this a
decision rather than an obvious choice. If it was triggered by recurring incidents, give
the count, the window, and what each was traced to.>

## Options Considered

| Option | Pros | Cons | Rejected because |
|---|---|---|---|
| <option> | <pros> | <cons> | <reason> |

## Decision

<What was decided, stated so specifically that a reviewer can check a future plan against
it.>

## Consequences

**Positive:** <what improves, and how it will be observed>

**Negative / accepted trade-offs:** <what gets worse, who agreed to accept it>

**Does not solve:** <the residual problem this decision leaves in place, and what process
covers it instead — the section most often omitted and most often needed>

## Downstream Updates

- [ ] `architecture.md` — <section updated to reference this ADR>
- [ ] `constitution.md` — <new or amended non-negotiable, if this decision changes one;
      otherwise "not warranted">
- [ ] Affected specs / plans notified: <slugs>
