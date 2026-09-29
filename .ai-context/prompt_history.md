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

Entries below are the agent sessions that ran after the task files existed. Gate 1 and Gate 2
are not a precondition for an entry. Checkboxes in `tasks.md` stay open until Gate 2.

Pre-implementation artefact authoring — discovery, spec, plan, tasks, test cases — was
human-authored with review, and is recorded in `status.md`'s Daily Execution Log and in the
Gate 1 records rather than here.

<!-- Newest entries appended below. -->

### 2026-09-25 15:10 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10 — Front end: transfer wizard and request detail; internal-transfer-approval-chain.T07 — manager inbox
**Satisfies:** internal-transfer-request.AC11, AC12, AC14, AC19, AC21; internal-transfer-approval-chain.AC12, AC14
**Phase:** GREEN
**Context supplied:** `.ai-context/tasks/internal-transfer-request.tasks.md`, `.ai-context/tasks/internal-transfer-approval-chain.tasks.md`, `.ai-context/tasks/internal-transfer-notifications.tasks.md`, `.ai-context/tasks/internal-transfer-downstream-orchestration.tasks.md`
**Workflow / prompt used:** freehand — the prompt named the four task files and said to implement them again after the task text was updated
**Prompt:** Implement the tasks once again since they are updated
**Outcome:** Accepted with edits
**Engineer review notes:** Portal detail and approval shell were updated to the revised task notes. The result was still unstyled. Backend tasks were not rebuilt.
**Follow-up raised:** Visual system added later the same week (Tailwind and shadcn/ui)

### 2026-09-27 21:45 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10 — Front end gap review
**Satisfies:** internal-transfer-request.AC19, AC21
**Phase:** REVIEW
**Context supplied:** `.ai-context/tasks/internal-transfer-request.tasks.md`, `employee-portal-web/src/App.tsx`
**Workflow / prompt used:** freehand — question, no code change
**Prompt:** Still the web portal is very basic. What need to be done?
**Outcome:** Accepted
**Engineer review notes:** none
**Follow-up raised:** Wireframes, then a plan and task update for Tailwind and shadcn/ui

### 2026-09-27 22:04 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10 — screen wireframes; internal-transfer-approval-chain.T07 and T08
**Satisfies:** internal-transfer-request.AC11, AC19; internal-transfer-approval-chain.AC7, AC12
**Phase:** REVIEW
**Context supplied:** request plan front-end section, request tasks T10–T11, approval tasks T07–T08
**Workflow / prompt used:** freehand
**Prompt:** Create wireframes
**Outcome:** Accepted
**Engineer review notes:** none
**Follow-up raised:** Canvas `internal-transfer-wireframes.canvas.tsx`

### 2026-09-27 22:07 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10–T11 and internal-transfer-approval-chain.T07–T08 — plan and task text
**Satisfies:** internal-transfer-request.AC19; internal-transfer-approval-chain.AC12, AC14
**Phase:** REVIEW
**Context supplied:** `.ai-context/plans/internal-transfer-request.plan.md`, `.ai-context/plans/internal-transfer-approval-chain.plan.md`, both task files, `.ai-context/status.md`
**Workflow / prompt used:** freehand — plans and tasks are not a Gate 1 review
**Prompt:** Based on these wireframes, update the plan and task to create these screens using Tailwind CSS and a modern design system
**Outcome:** Accepted
**Engineer review notes:** Specs were not edited. shadcn/ui was named as the design system.
**Follow-up raised:** none

### 2026-09-27 22:12 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10–T11 — list, wizard, detail; internal-transfer-approval-chain.T07–T08 — inbox and decision
**Satisfies:** internal-transfer-request.AC11, AC12, AC14, AC19, AC21; internal-transfer-approval-chain.AC7, AC12, AC14
**Phase:** GREEN
**Context supplied:** `.ai-context/tasks/internal-transfer-request.tasks.md`, `.ai-context/tasks/internal-transfer-approval-chain.tasks.md`, `employee-portal-web/`
**Workflow / prompt used:** freehand — both task files in one prompt, tests and screens together, not a separate RED prompt
**Prompt:** Implement the tasks in sequence
**Outcome:** Accepted with edits
**Engineer review notes:** Tailwind screens and shared `src/components/ui` components were added. RTK Query, MSW, Playwright, and axe were not added. Task checkboxes were not marked done.
**Follow-up raised:** Role split between employee create and approver inbox








