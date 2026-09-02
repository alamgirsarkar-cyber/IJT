# Agent entry point — One-Point Employee Portal

This file is the **start of every agent session**. Do not scan the repository. Do not
prompt from the spec, the plan, or `prompts.md` as a whole.

`.agent/` is the control plane (rules + workflows). `.ai-context/` is the knowledge base.
This file is how you enter both.

## Before anything else

1. Read `.ai-context/constitution.md` — it overrides every other instruction if they conflict.
2. Read `.ai-context/status.md` — the next piece of work is the first spec that is not Released.
3. Respect `.agent/rules/.agentignore` — do not pull ignored paths into context.

## If you are implementing (code)

**Entry is a task ID, not a feature description.**

1. Open `.ai-context/tasks/<feature-slug>.tasks.md`.
2. Take the first `[ ]` task. One task only.
3. Load **only** that task’s prompt pair from `.ai-context/prompts/<feature-slug>.prompts.md`.
4. Tag only the files that task names (spec ACs, plan section, stack rules, module paths).
5. Run **RED** first (`.agent/workflows/generate-tests.md`, or the RED block in `prompts.md`).
6. Stop. The engineer confirms the new tests fail for missing behaviour, not for import errors.
7. Run **GREEN** (the GREEN block for the same task ID).
8. Gate 2: `.agent/workflows/code-review.md`.
9. Append `.ai-context/prompt_history.md` per `.agent/rules/auto-log.md`. Update `tasks.md`
   and `status.md` the same day.

Stack rules (always-on for the files you touch):

- Backend (`employee-services/**`): `.agent/rules/int-standards.node.md`
- Frontend (`employee-portal-web/**`): `.agent/rules/int-standards.react.md`

Prompt by identity: `Implement internal-transfer-request.T01 — must satisfy AC1, AC8, AC18.`
Never: “build the transfer feature.”

## If you are not implementing

| Job | Workflow |
|---|---|
| Draft a spec (BRD entry must be closed enough) | `.agent/workflows/generate-spec.md` |
| Gate 1 spec review | `.agent/workflows/spec-review.md` |
| Draft a plan (spec must be Approved) | `.agent/workflows/generate-plan.md` |
| Generate failing tests | `.agent/workflows/generate-tests.md` |
| Gate 2 code review | `.agent/workflows/code-review.md` |

Discovery still starts in `.ai-context/BRD.md`. A spec is never the first place a
requirement is written down.

## Current work

| Field | Value |
|---|---|
| Feature | `internal-transfer-request` |
| Spec | `.ai-context/specs/internal-transfer-request.spec.md` |
| Plan | `.ai-context/plans/internal-transfer-request.plan.md` |
| Tasks | `.ai-context/tasks/internal-transfer-request.tasks.md` |
| Prompts | `.ai-context/prompts/internal-transfer-request.prompts.md` |
| **Next prompt** | **Blocked — complete Gate 1 spec review first** (`internal-transfer-request.gate1.md`) |

## Standing constraints (append to every prompt)

- No AI attribution in comments or commit messages. Task-ID references are required.
- No new dependency without saying why a platform built-in will not do.
- No secrets, PII, or transfer reason text in logs, fixtures, prompts, or `prompt_history.md`.
- Do not implement anything under *Deferred* in that feature’s `tasks.md`.
- If the spec is ambiguous, stop and say so. Do not choose an interpretation.

## Do not

- Mega-prompt the whole `tasks.md` or `prompts.md`.
- Write implementation before Red is confirmed.
- Dump the repo into context.
- Skip Gate 1 or Gate 2.
- Treat a stale `architecture.md` as current without checking its currency section.
