# One-Point Employee Portal — Employee Internal Transfer Digital Journey

The single portal through which employees access HR, payroll, IT, learning and facilities
services. This increment adds the **Employee Internal Transfer** journey: an employee raises a
transfer request once and sees one view of its progress, instead of coordinating their manager,
HR, Payroll, IT and Facilities themselves.

> Operational only — setup, run, deploy. Design rationale lives in
> `.ai-context/architecture.md`, decisions in `.ai-context/decisions/`, and the
> feature-by-feature history in `.ai-context/specs/`.

## Current state

**Specification complete; implementation not started.** The artefact chain for
`internal-transfer-request` runs from BRD-001 through spec (Approved v1.1), Gate 1, plan
(Plan Reviewed), plan review, and tasks T01–T10. No source code exists yet. See
[`docs/deliverable-index.md`](docs/deliverable-index.md) for the full map and
[`.ai-context/status.md`](.ai-context/status.md) for what is in flight.

## Prerequisites

- Node.js 20 LTS, npm 10
- Docker (PostgreSQL 15, Redis 7 and Kafka run as containers locally; tests use Testcontainers)
- Access to the corporate OIDC dev tenant and the HRIS read API test instance

## Setup

```bash
npm ci
docker compose up -d          # postgres, redis, kafka
npm run db:migrate
```

Configuration comes from environment-specific config plus AWS Secrets Manager at runtime.
Secrets never live in a committed `.env`, sanitised or not.

## Run

```bash
npm run start:dev -w employee-services      # API on :3000
npm run dev -w employee-portal-web          # portal on :5173
```

## Test

```bash
npm test                     # unit and integration (Testcontainers: real PostgreSQL and Redis)
npm run test:contract        # HTTP contract tests against the spec's exception tables
npm run test:e2e             # Playwright journeys
npm run test:a11y            # axe checks — does not replace the manual pass
npm run test:coverage        # floor: 85% for modules touching employee records, 70% elsewhere
```

## Build & Deploy

```bash
npm run build
```

| Environment | Trigger | Notes |
|---|---|---|
| dev | push to any branch | Synthetic data |
| sit | merge to `main` | Real HRIS test instance; downstream consumer doubles |
| uat | tagged release candidate | Masked data; HR Ops acceptance |
| prod | tagged release | Rolling deploy — migrations must be additive and backward-compatible with the previous version |

---

## How this repository is delivered

Specification-Driven Delivery. The specification, not the source code, is the primary
artefact; code, tests and documentation are generated from it by a human-directed agent, and a
named human is accountable for every merged line.

**Lifecycle:** Discovery → Constitution (once) → Spec → **Gate 1** (spec + plan peer review) →
Tasks → Test-first (Red) → Guided implementation (Green) → **Gate 2** (code review) → Merge →
Release → Production support → back into BRD/Spec.

### Where things live

| Path | Purpose |
|---|---|
| `.agent.md` | **Prompt-execution entry.** Open this first in every agent session |
| `.agent/rules/` | Always-on agent rules — `int-standards.node.md`, `int-standards.react.md`, `.agentignore`, `auto-log.md` |
| `.agent/workflows/` | Reusable prompts: spec creation, spec review, plan generation, test generation, code review |
| `.ai-context/constitution.md` | Project non-negotiables — checked line by line at Gate 1 |
| `.ai-context/project_context.md` | One-page orientation |
| `.ai-context/architecture.md` | Living system design |
| `.ai-context/BRD.md` | Where a requirement is first written down |
| `.ai-context/status.md` | Delivery state board and daily execution log |
| `.ai-context/specs/` | One spec per feature, named by slug |
| `.ai-context/plans/` | Technical approach per feature |
| `.ai-context/tasks/` | Ordered, independently verifiable build sequence |
| `.ai-context/test_cases/` | Per-feature cases plus `_integration.md` |
| `.ai-context/decisions/` | ADRs — project-global IDs |
| `.ai-context/reviews/` | Gate 1 and Gate 2 records per feature |
| `.ai-context/security/` | Per-feature security assessments |
| `.ai-context/prompts/` | Per-task prompt sets |
| `.ai-context/prompt_history.md` | Agent session audit trail |
| `docs/deliverable-index.md` | Artefact map and end-to-end traceability |
| `docs/sdd-checklists.md` | Gate, security, release, hotfix and triage checklists |

`reviews/`, `security/` and `prompts/` are project extensions to the standard `.ai-context/`
layout; everything else follows the INT SDD blueprint as published.

### Starting an agent session

Open [`.agent.md`](.agent.md). That file is the prompt-execution entry: next task ID, RED then
GREEN, what to tag, which workflow to use. Do not start from the spec or from `prompts.md`
as a whole.

### Starting a feature

1. Add the requirement to `.ai-context/BRD.md` and close discovery. A spec is never the first
   place a requirement is written down.
2. Choose a slug: kebab-case, 3–5 words, verb-free, unique for the life of the project, never
   reused. It threads the spec, plan, tasks, test cases, branch, PR title, status row and
   release note together.
3. Draft the spec: `.agent/workflows/generate-spec.md` (uses `_TEMPLATE.spec.md`).
4. Gate 1: `.agent/workflows/spec-review.md`. Reviewer is never the author.
5. Plan: `.agent/workflows/generate-plan.md` → tasks → Red tests → implementation, one task ID at a time.
6. Gate 2: `.agent/workflows/code-review.md`. Update `status.md` the same day.

### Conventions

- Branches: `feature/<feature-slug>`, `fix/<issue-slug>`, `hotfix/<incident-slug>`
- PR titles: `[<feature-slug>] <what changed>`
- Squash-merge to `main`
- Commit messages may reference a task ID (`Implements internal-transfer-request.T03`); they
  must never carry AI attribution
- If a PR cannot be reviewed against its spec's acceptance criteria in one sitting, the spec
  was scoped too large — split it
