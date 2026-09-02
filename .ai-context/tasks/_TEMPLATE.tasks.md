# Tasks: <Feature Name>

<!--
  Copy to .ai-context/tasks/<feature-slug>.tasks.md. Generated from the plan's Sequencing
  section, then reviewed by the engineer — not hand-written from memory.

  Each task is independently generatable, independently reviewable and independently
  mergeable. The engineer runs the agent against ONE task at a time, referenced by ID.
  Never prompt the whole tasks file at once.

  Task IDs are stable: "implement <slug>.T03" points at the same thing after three
  revisions of this file; "implement the rate-limiting task" does not.
-->

## Derived From

`.ai-context/plans/<feature-slug>.plan.md`

## Task States

Checkbox state in this file is the task state:
`[ ]` Not Started · `[~]` In Progress · `[r]` In Review · `[x]` Merged

## Sequence

- [ ] `<slug>.T01` — <independently verifiable unit of work>
      — Acceptance: `<slug>.AC1`, `<slug>.AC3`
      — Tests first: `<slug>.UT01`
      — Touches: <module / path>
- [ ] `<slug>.T02` — <independently verifiable unit of work>
      — Acceptance: `<slug>.AC2`, `<slug>.API01`
      — Tests first: `<slug>.UT02`
      — Touches: <module / path>
      — Depends on: `<slug>.T01`
- [ ] `<slug>.T03` — <failure / boundary handling as its own task, never folded into the happy-path task>
      — Acceptance: `<slug>.AC3`
      — Tests first: `<slug>.UT03`
- [ ] `<slug>.T04` — <interface / surface>
      — Acceptance: `<slug>.AC1`, `<slug>.AC4`

## Traceability

<Every AC must be covered by at least one task, and every task must serve at least one AC.
A task serving no AC is scope creep; an AC served by no task is a build gap. Both are
caught here, before generation, not at Gate 2.>

| AC | Covered by | Test cases | Status |
|---|---|---|---|
| `<slug>.AC1` | T01, T04 | UT01 | <state> |
| `<slug>.AC2` | T02 | UT02 | <state> |
| `<slug>.AC3` | T01, T03 | UT03 | <state> |

## Execution Notes

| Task | Branch | PR | Red confirmed | Green confirmed | Gate 2 | Merged |
|---|---|---|---|---|---|---|
| `<slug>.T01` | `feature/<feature-slug>` | <#> | <date> | <date> | <reviewer, date> | <date> |
