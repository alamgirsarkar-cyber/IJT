# Plan: <Feature Name>

<!--
  Copy to .ai-context/plans/<feature-slug>.plan.md. Drafted only after the spec reaches
  Approved. Reviewed at Gate 1 alongside the spec.

  The plan answers "given the spec and the constitution, what is the technical approach."
  It names integration points and the data model explicitly — it does not leave them for
  the agent to infer at implementation time. A plan that violates a non-negotiable is a
  Gate 1 rejection, not a Gate 2 comment.

  No plan skips straight from spec to code, except the trivial-change tier (config bumps,
  formatting, no behaviour change).
-->

## Derived From

`.ai-context/specs/<feature-slug>.spec.md` (<version>, Approved <date>)

## Status

<Plan Drafted / Plan Reviewed> · **Author:** <name> · **Reviewer:** <name>

## Architecture Approach

<Components touched, new versus existing, and why. Where the reviewer's judgement extends
a constitution rule by analogy rather than by letter, say so explicitly — that is the
sentence a future reader needs.>

- <component> — <what is added or changed there, and why there and not elsewhere>
- <library / built-in chosen over an alternative> — <reason, including any supply-chain
  or security rationale>
- <sync vs. async choice> — <what it protects: latency, SLA, blast radius>

## Data Model

<Schema changes, new keys, migrations — or "no schema change," stated explicitly rather
than left silent.>

- <store>: <structure>, <TTL / retention>, <key design and what the key deliberately does
  NOT contain>
- Migration: <forward and rollback approach, or "none required">

## Integration Points

| System | Direction | Sync/Async | Failure behaviour | Timeout / retry | Owner |
|---|---|---|---|---|---|
| <system> | <in / out> | <sync / async> | <what the user sees when it fails> | <policy> | <team> |

## Failure and Boundary Handling

<The section agents skip unless it is written down. Partial failure, timeouts, duplicate
submissions, concurrent updates, and what state the system is left in for each.>

| Scenario | Behaviour | Maps to AC |
|---|---|---|
| <failure> | <handling> | <slug>.AC<N> |

## Constitution Check

<!-- Every line item answered. Silence on a rule is a gap, not a pass. Add a line for
     each section of this project's constitution.md. -->

- [ ] No new datastore or service introduced without an ADR — <state what is introduced, or "none">
- [ ] Testing discipline matches `constitution.md` — <framework, test-first scope, coverage floor>
- [ ] Security posture matches `constitution.md` — <PII handling, logging, secrets, auth>
- [ ] Rate-limit decision made explicit for every new or changed endpoint — <decision>
- [ ] Non-functional baselines respected — <latency / availability position>
- [ ] Versioning rules respected — <breaking change? ADR? deprecation window?>

## ADR Candidates

<A decision is significant if reversing it later costs more than a day of rework. Those
get an ADR, not just a line here.>

| Decision | Significant? | ADR |
|---|---|---|
| <decision> | <yes / no, with the reversal-cost reasoning> | <ADR-NNNN / not warranted> |

## Explicitly Deferred

<Verified at Gate 2 — implementation must not scope-creep into what the plan deferred.>

- <item> — <reason, and who deferred it>

## Sequencing

<High-level build order. Each step must be independently generatable, reviewable and
mergeable, because `tasks.md` is generated from this list.>

1. <foundation / scaffolding>
2. <core behaviour>
3. <failure and boundary handling>
4. <interface / surface>

## Documentation Impact

- [ ] `architecture.md` — <sections to update on merge, or "no change">
- [ ] `decisions/` — <ADRs to file, or "none">
- [ ] `README.md` — <operational change, or "none">
