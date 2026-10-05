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

### 2026-09-28 10:20 — internal-transfer-request.T10
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T10; internal-transfer-approval-chain.T07–T08 — restyle to the Stitch application chrome
**Satisfies:** internal-transfer-request.AC11, AC12, AC19; internal-transfer-approval-chain.AC7, AC12
**Phase:** GREEN
**Context supplied:** `docs/designs/internal-transfer-ui/` (nine Stitch screens, png and html), request and approval task files, `employee-portal-web/`
**Workflow / prompt used:** freehand — plans and tasks already pointed at the design folder
**Prompt:** Pull the nine Stitch screens, then implement the tasks in sequence so the screens match
**Outcome:** Accepted with edits
**Engineer review notes:** List API extended with pendingWith, requestedEffectiveDate, effectiveDateStatus. Spec constraints kept over mock extras (no PDF, destination image, global search, extra nav). Vite build passed.
**Follow-up raised:** RBAC gap — every session saw New request

### 2026-09-28 16:05 — internal-transfer-request.T03
**Engineer:** Alamgir Sarkar            **Model:** Grok 4.7
**Task:** internal-transfer-request.T03, T10; internal-transfer-approval-chain.T01 — role-specific screens and actions
**Satisfies:** internal-transfer-request.AC13, AC20; internal-transfer-approval-chain.AC6, AC13
**Phase:** GREEN
**Context supplied:** `employee-services/src/internal-transfer/api/app.ts`, `.../approval/api/routes.ts`, `employee-portal-web/src/App.tsx`
**Workflow / prompt used:** freehand
**Prompt:** Implement RBAC; the screen and actions must be specific to the role
**Outcome:** Accepted with edits
**Engineer review notes:** Employee routes 403 approver roles; employee sees only My Transfer Requests, approvers only Approvals Inbox. At this point the role was still read from the bearer token suffix — later corrected under G2-F02.
**Follow-up raised:** Token-trusted role is an auth gap (became Gate 2 G2-F02)

### 2026-10-05 13:10 — internal-transfer-request.T01
**Engineer:** Alamgir Sarkar            **Model:** Claude Opus 4.8
**Task:** Gate 2 remediation across all four slugs — G2-F01–G2-F12
**Satisfies:** internal-transfer-request.AC13, AC17, AC18, AC20, AC21; and the cross-cutting Gate 2 findings
**Phase:** REVIEW
**Context supplied:** `.ai-context/reviews/internal-transfer-request.gate2.md`, the four task files, `employee-services/src/internal-transfer/**`, `employee-portal-web/src/**`, `.claude/hooks/session-start.js`
**Workflow / prompt used:** `.cursor/plans/gate_2_remediation_*.plan.md` (approved plan)
**Prompt:** Implement the Gate 2 remediation plan — resolve G2-F01 through G2-F12
**Outcome:** Accepted with edits
**Engineer review notes:** Server-side identity/role with a test seam; SQLite rate-limit table on all seven request endpoints plus approval and webhook, with 429 tests; relay stores the error class not the message; `/me` endpoint and identity-only portal tokens; frontend logic extracted and unit-tested; coverage scripts (backend 94.26% line); OpenAPI; migrations README; session-start hook fixed to Subhajit Mukherjee; dependency vetting note. No transfer reason text, secret, or Stitch key recorded here. Backend 79 tests / portal 9 tests pass; portal build clean. Not merged; pending Gate 2 re-review by Subhajit Mukherjee.
**Follow-up raised:** G2-F04 is a plan-wording correction (`REVOKE` → abort triggers) with spec AC18 unchanged, so it is a plan amendment, not a Gate 1 re-entry; field-level encryption of reason, and Playwright/MSW/axe (T09/T10), remain open and are recorded as such in the Gate 2 evidence

### 2026-10-05 15:40 — internal-transfer-request.T10 / downstream-orchestration webhook
**Engineer:** Alamgir Sarkar            **Model:** Claude Opus 4.8
**Task:** Close the remaining G2-F07 coverage gap and extend G2-F10 frontend testing; clarify G2-F05
**Satisfies:** internal-transfer-request.AC19; downstream webhook route coverage; Gate 2 findings G2-F05, G2-F07, G2-F10
**Phase:** REVIEW
**Context supplied:** `.ai-context/reviews/internal-transfer-request.gate2.md`, `employee-services/src/internal-transfer/fulfilment/**`, `employee-portal-web/src/features/internal-transfer/**`, `employee-portal-web/src/components/ui/**`
**Workflow / prompt used:** freehand remediation follow-up (same approved Gate 2 plan)
**Prompt:** Fix G2-F05, G2-F07 and G2-F10 — webhook coverage, frontend component/a11y tests, RED-first disclosure
**Outcome:** Accepted
**Engineer review notes:** Added four route-level webhook failure-path tests (429 with Retry-After, validly-signed non-JSON → 422, signed success → 200, applyReport error → 409) — `webhook.ts` 60% → 100% line; backend 95.16% line across 83 tests. Stood up Vitest + jsdom + Testing Library + jest-axe for the portal; added `screens.test.tsx` with render/interaction and automated axe (zero violations); `npm test` now runs node:test logic + Vitest components (9 + 9). New test deps are dev-only and vetted in the C3 record. G2-F05 evidence split into genuinely RED-first new-code tests vs disclosed characterisation/coverage tests. No reason text, secret, or Stitch key recorded here. Portal build clean.
**Follow-up raised:** RTK Query/MSW and Playwright E2E, a human screen-reader walkthrough (AC19), reason encryption (AC16), Secrets Manager, and notification wiring remain open and are listed in the Gate 2 evidence Known gaps. Still pending Gate 2 re-review by Subhajit Mukherjee.








