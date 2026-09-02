# `.agent/` — control plane

This folder is **not** the session entry. Start at **[`../AGENTS.md`](../AGENTS.md)** (repo
root).

| Path | Purpose |
|---|---|
| `rules/int-standards.node.md` | Always-on Node/NestJS rules |
| `rules/int-standards.react.md` | Always-on React rules |
| `rules/.agentignore` | Keep secrets, binaries and lockfiles out of context |
| `rules/auto-log.md` | Append to `prompt_history.md` after every task |
| `workflows/generate-spec.md` | Spec from a closed BRD entry |
| `workflows/spec-review.md` | Gate 1 |
| `workflows/generate-plan.md` | Plan from an Approved spec |
| `workflows/generate-tests.md` | RED phase |
| `workflows/code-review.md` | Gate 2 |
