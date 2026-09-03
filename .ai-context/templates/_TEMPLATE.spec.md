# Spec: <Feature Name>

<!--
  Copy to .ai-context/specs/<feature-slug>.spec.md and fill in. Delete these comments.

  Before writing, all three must be true:
  1. You can describe the feature in one unambiguous paragraph a zero-context engineer
     could build from.
  2. You have gathered every artefact the agent needs — modules touched, prior related
     spec, API contract, design tokens, constraints carried forward.
  3. The feature is aligned with whoever needs to sign off.
  If any answer is "not yet," do not open the agent.

  Authoring rules:
  - One feature, one spec. "The user module" is a project; "OTP-based 2FA for existing
    users" is a spec.
  - Intent and acceptance criteria before any technical detail.
  - Link context, do not restate it — reference .ai-context/ paths.
  - Name what is explicitly out of scope.
  - How belongs in the plan. Payload shape, status codes and exceptions are product
    decisions and belong here.

  Slug rules: kebab-case, 3–5 words, verb-free (names a thing, not an action), specific
  enough to stay unique for the life of the project, never reused — deprecated specs are
  archived, not deleted, and the slug retires with them.
-->

## Spec ID

<feature-slug>

## Status

<Draft v1.0 — bump the minor version on every Changes Requested revision, e.g. Draft v1.1,
so revision history is visible in the file itself and not only in git blame. Full state
machine in `.ai-context/status.md`.>

## Linked BRD

`.ai-context/BRD.md#BRD-NNN`

## Owner / Reviewer

| Role | Name | Date |
|---|---|---|
| Author | <name> | <date> |
| Gate 1 reviewer (never the author) | <name> | <date> |
| Security / Architecture sign-off (if the plan touches a constitution rule) | <name> | <date> |

## Intent

<One paragraph: what changes, for whom, under what condition. No adjectives that cannot
be tested. Two competent engineers reading this must build materially the same thing.>

## Context

- Builds on: `.ai-context/architecture.md` (<section>)
- Related: `.ai-context/specs/<related-spec>.spec.md` — <state: must be Approved or Released>
- API contract consumed (if any): <path or link>
- Design tokens / UX reference: <path or link>

## Business Rules

| Rule ID | Rule | Source | Business or technical decision |
|---|---|---|---|
| <slug>.BR1 | <rule as an unambiguous statement> | <BRD-NNN / policy owner> | <Business / Technical> |

## API Contract

<!-- Mandatory only when the feature exposes or consumes an API. A pure refactor or an
     internal batch job has no API Contract section, and reviewers should not demand one
     where there is nothing to contract. Delete this whole section if it does not apply. -->

### <slug>.API01 — <METHOD> <path>

**Purpose:** <one line>
**Auth:** <scheme, scopes, who may call it>
**Rate limit:** <explicit decision — "none, because ..." is a valid answer; silence is not>
**Idempotency:** <key, semantics on replay — or "not applicable, because ...">

**Request payload:**

```json
{ "field": "type" }
```

**Success response (<code>):**

```json
{ "field": "type" }
```

**Exceptions:**

| Code | Condition | Response body |
|---|---|---|
| 4xx | <condition> | <shape> |
| 4xx | <condition> | <shape> |
| 5xx | <condition> | <shape> |

<!-- Exhaustive, not happy path plus one error. Reviewers check this specifically. -->

## Acceptance Criteria

<!-- Every AC given/when/then, individually IDed, individually verifiable at Gate 2.
     Include the failure and boundary paths explicitly — agents nail the happy path and
     skip everything else unless an AC forces it. -->

1. `<slug>.AC1` — Given <state>, when <action>, then <observable outcome>.
2. `<slug>.AC2` — Given <state>, when <action>, then <observable outcome>.
3. `<slug>.AC3` — Given <failure or boundary state>, when <action>, then <outcome>.

## Unit Test Cases (spec-derived)

<!-- Acceptance-level cases derived directly from this spec's own AC — enough for QA and
     the agent to know the feature is correctly built. Broader QA sweeps (data volumes,
     device matrices, cross-feature regression) live in
     .ai-context/test_cases/<slug>.test_cases.md and reference back here. -->

| Test ID | Maps to AC | Scenario | Expected |
|---|---|---|---|
| `<slug>.UT01` | AC1 | <scenario> | <expected> |
| `<slug>.UT02` | AC2 | <scenario> | <expected> |
| `<slug>.UT03` | AC3 | <negative / boundary scenario> | <expected> |

## Explicitly Out of Scope

<!-- Name the things this feature will be tempted to also fix. Scope-creep check at
     Gate 1 reads this section against the intent. -->

- <item> — <where it is handled instead, or why it is deferred>

## Open Questions

| # | Question | Owner | Needed by | Resolution |
|---|---|---|---|---|
| 1 | <question> | <name> | <gate / date> | <answer, dated — or "open"> |

<!-- A spec cannot reach Approved with an open question that a plan would have to guess at. -->

## Assumptions

- <assumption> — <what breaks if it is false>

## Non-Functional Constraints (from constitution.md)

- <latency / availability / accessibility / compliance constraint, quoted from the
  constitution section it comes from>

## Revision History

| Version | Date | Change | Driver |
|---|---|---|---|
| v1.0 | <date> | Initial draft | BRD-NNN |
| v1.1 | <date> | <what changed> | Gate 1 feedback: <what the reviewer caught> |
