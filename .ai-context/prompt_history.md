# Prompt History — One-Point Employee Portal

> The session-level agent audit trail. Distinct from `status.md`, which is the human-curated
> daily summary, and from the spec/plan/ADR decision layer.
>
> Appended by the agent after every completed task, per `.agent/rules/auto-log.md`, so the
> trail exists without depending on anyone remembering to write it.
>
> **Never record secrets, credentials, tokens, PII, or client-confidential data here.** This
> file is committed; it is a greppable surface. Reference identifiers, not values. For the
> internal transfer feature that specifically includes transfer reason text — an entry logging
> a prompt that contained it would itself be the breach the feature is designed to prevent.

## Entry Format

```
### <YYYY-MM-DD HH:MM> — <slug>.T<NN>
**Engineer:** <name>            **Model:** <model / version>
**Task:** <slug>.T<NN> — <task title>
**Satisfies:** <slug>.AC<N>, <slug>.API<NN>
**Phase:** RED | GREEN | REVIEW
**Context supplied:** <files and artefacts tagged in — not "the repo">
**Workflow / prompt used:** <.agent/workflows/*.md or .ai-context/prompts/<slug>.prompts.md>
**Prompt:** <what was asked, referenced by identifier>
**Outcome:** <Accepted / Accepted with edits / Rejected and re-specced>
**Engineer review notes:** <what was corrected by hand, what the agent missed>
**Follow-up raised:** <spec revision, ADR candidate, task added — or "none">
```

## Standing Rules

- **Prompt by identity, not by description.** `Implement internal-transfer-request.T05 — must
  satisfy AC9 and AC10 and match the exception table in internal-transfer-request.API03`
  survives a spec edit; "implement the submit endpoint" does not.
- **One task, one prompt.** Decompose per `tasks.md` and review between steps.
- **RED and GREEN are separate prompts**, with an engineer-confirmed failing run between them.
  A single prompt that writes tests and implementation together writes tests that pass.
- **State the AC ID the agent should self-check against**, not just the action.
- **Match model to task.** Schema, DTOs and wiring → lighter model. Submit transaction,
  concurrency, security hardening → heavier model.
- **Do not iterate and hope.** If the first generation is significantly wrong, stop and fix
  the spec or plan. Repeated re-prompting against the same ambiguity is vibe coding with extra
  steps, and it gets recorded here as such.

## Planned Prompts

The prompt set for `internal-transfer-request` — RED and GREEN for each of T01–T10, plus the
review prompt — is in `.ai-context/prompts/internal-transfer-request.prompts.md`. This file
records what was actually run and what came of it.

## Log

**No task execution sessions have run yet.** `internal-transfer-request` is at
*Tasks Generated*; T01 has not started, so there is nothing to log. Entries begin with
`internal-transfer-request.T01` RED.

Pre-implementation artefact authoring — discovery, spec, plan, tasks, test cases — was
human-authored with review, and is recorded in `status.md`'s Daily Execution Log and in the
Gate 1 records rather than here. This file is scoped to agent sessions that generate or modify
code.

<!-- Newest entries appended below. -->
