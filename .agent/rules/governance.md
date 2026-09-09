# Governance — Gate 1 / Gate 2

This is the **canonical** governance file. The six thin entry files (`AGENTS.md`, `CLAUDE.md`,
`GEMINI.md`, `.cursor/rules/gate-review.mdc`, `.windsurf/rules/gate-review.md`,
`.github/copilot-instructions.md`) each carry only a tripwire pointing here — never duplicate
these rules into them, so there is exactly one place this can drift out of date.

Session operating procedure (constitution, task-ID entry, current work) lives in
`.agent/rules/agent-role.md`. It does not restate Gate 1 / Gate 2 sign-off rules.

## Artefact locations in this repo

Governance names `specs/`, `plans/`, `tasks/`. In this workspace those files live under
`.ai-context/`:

| Governance name | Path in this repo |
| --- | --- |
| `specs/<slug>.spec.md` | `.ai-context/specs/<slug>.spec.md` |
| `plans/<slug>.plan.md` | `.ai-context/plans/<slug>.plan.md` |
| `tasks/<slug>.tasks.md` | `.ai-context/tasks/<slug>.tasks.md` |
| `ownership_index.md` | `.ai-context/ownership_index.md` |
| `completed.md` | `.ai-context/state/completed.md` |
| `state-tracking.md` | `.ai-context/state/state-tracking.md` |

Findings worksheets may still exist at `.ai-context/reviews/<slug>.gate1.md`. They are
**not** the Gate 1 sign-off. Sign-off is the dated `## Gate 1 Review` block on the spec.

`.ai-context/constitution.md` still overrides every other instruction if they conflict.

## Project timing

This repo's Gate 1/Gate 2 timing lines up with the SDD assessment's own milestone schedule
(`source/Requirement for SDD.docx` §6–7):

**Gate 1 = Milestone 2 (Day 3)**
**Gate 2 = inside Milestone 4 (Days 6–8)**

## Roles

| Role | Assignee |
|---|---|
| Author of record | Alamgir Sarkar |
| Gate 1 reviewer | Abhijit Adhikari |
| Gate 2 reviewer | Tapas Dutta |

A session whose git identity matches neither reviewer nor the author of record is treated
as that session's author of record instead (see self-identification below).

## Gate 1 — Spec/Plan review (before implementation starts)

**Definition of Ready (DoR)** — a feature may enter Gate 1 only once:

- `.ai-context/specs/<slug>.spec.md` exists with intent, acceptance criteria, API contract,
  and edge cases separated out of the BRD entry it came from.
- Every fact the spec depends on that's shared across multiple features (e.g. "which role
  counts as manager") is either defined locally or points at an
  `.ai-context/ownership_index.md` entry — never silently redefined.
- Open questions the spec can't resolve itself are listed explicitly, not left implicit.

**Definition of Done (DoD) for Gate 1**:

- `.ai-context/plans/<slug>.plan.md` exists: architecture approach, data model, sequencing,
  and explicit call-outs of anything the plan defers to a non-existent NFR/coverage-floor
  value (per `constitution.md`) rather than inventing one.
- Gate 1 reviewer has signed off in the slug's own `.ai-context/specs/<slug>.spec.md` (a
  dated approval line), not just in chat.

## Gate 2 — Code review (before merge)

**DoR**: implementation matches the Gate-1-approved plan; test-first scope from
`constitution.md` has actual tests, not placeholders; `.ai-context/tasks/<slug>.tasks.md`
shows every task completed; OpenAPI updated in the same change for any API surface touched.

**DoD**: Gate 2 reviewer has run through the four-bucket Gate Review Dashboard (see
`.agent/workflows/gate-review-dashboard.md`) and recorded the result. Only the assigned
Gate 2 reviewer may move a feature from "in review" to "merged" — this permission boundary
is not delegable within an agent session.

## Reviewer self-identification & Review Dashboard automation

**Trigger:** the moment Abhijit Adhikari or Tapas Dutta identifies themselves in a session —
by name in chat ("I'm Abhijit Adhikari, ready to review," or similar), or via the session's
git identity (`git config user.name`, self-declared and unauthenticated — a convenience, not
an access-control mechanism):

1. Welcome them by name and confirm which gate (Gate 1 for Abhijit Adhikari, Gate 2 for
   Tapas Dutta) and whether they're here to review now.
2. If yes, ask them to choose — every time, never defaulted or inferred — **Artifact** (a
   rendered dashboard) or **Manual** (they read the spec/plan/diff themselves). Both paths
   run the identical scan in `.agent/workflows/gate-review-dashboard.md` (steps 1–3);
   Artifact continues into that workflow's step 4 (every case card carries the slug's full
   real spec/plan sections — Acceptance Criteria, API Contract, API Workflow, Edge Cases
   Covered, Error Handling, Unit Test Cases, Architecture Approach, Sequencing, etc. —
   never a summarized subset) and step 5 (the rendering); Manual skips straight to a plain
   slug/bucket/file-path reply. **Artifact means the same rendered page regardless of which
   tool is running this session** — reuse
   `.agent/workflows/gate-review-dashboard-design.html`'s CSS, layout, and copy-to-clipboard
   script verbatim, never a freshly designed page; publish it where the session's tool
   supports publishing a shareable link, otherwise write the rendered HTML to a local file
   and give the reviewer its path. Neither reviewer edits `.agent/` / `.ai-context/` files
   directly — their entire input is a spoken/chat verdict (Approve / Reject / Changes
   requested, optionally with a comment); the agent alone is responsible for writing that
   verdict into the real file.
3. Write the outcome back:
   - **Gate 1**: append a `## Gate 1 Review` section to the slug's
     `.ai-context/specs/<slug>.spec.md` (create it if the spec doesn't have one yet):

     ```markdown
     ## Gate 1 Review

     > Reviewed by: Abhijit Adhikari, <date>, <verdict> — <comment, if Rejected/Changes requested>
     ```

     Also update that spec's Status, `.ai-context/status.md`, and (if findings were
     categorised) `.ai-context/reviews/<slug>.gate1.md` the same day. Chat findings that
     are not written into those files are not captured.
   - **Gate 2**: append `Gate 2 reviewed by: Tapas Dutta, <date>, <verdict>` (plus comment,
     if any) to that slug's line in `.ai-context/state/completed.md`.
   - A verdict changing after it was already recorded (a re-review) gets a new dated line
     rather than an edit to the old one — `completed.md` is append-only per
     `state-tracking.md`, and a spec's Gate 1 Review section should keep the same history,
     consistent with the Re-review convention below.
4. If the session's git identity matches neither reviewer nor the author of record
   (Alamgir Sarkar), treat that name as this session's author of record instead —
   any spec/plan/diff produced at their instruction is attributed to them, and they cannot
   also be their own Gate 1 or Gate 2 reviewer for that same work.

**Automation for Claude Code:** `.claude/hooks/session-start.js` (wired via
`.claude/settings.json`) runs this check automatically at session start by reading
`git config user.name`. This mechanism is Claude Code-specific and, like any hook, can fail
to fire silently — it is a convenience layered on top of the convention above, not a
replacement for it. Any tool session — automated or not — that has a reviewer or the
author of record self-identify by name in chat should follow the same four steps regardless
of whether the hook ran. This is why the procedure lives here, in the one file every
tripwire file already mandates reading in full before doing anything — no tool-specific
duplication of this section is needed as long as that read-governance-first tripwire holds.
Each of those six files does carry one short pointer sentence naming this section, purely
for discoverability, not as a duplicate of the procedure itself.

`.claude/skills/gate-review-dashboard/SKILL.md` is the same kind of Claude Code-only
convenience — it exists only so Claude Code's Skill system can auto-invoke the Artifact
path by name. A session in another tool (Cursor, Windsurf, Copilot Chat, Gemini CLI, or an
AGENTS.md-reading agent) has no skill system and, typically, no built-in mechanism to
publish a page to a shareable link the way Claude Code's Artifact tool does — for those
sessions, "Artifact" means rendering `gate-review-dashboard-design.html`'s design verbatim
to a local HTML file and telling the reviewer its path to open in a browser, per
`gate-review-dashboard.md` step 5. The scan logic, bucket definitions, design system, and
write-back convention are identical across every tool regardless — only the
publish-vs-local-file delivery mechanism and the automatic-detection convenience differ.

## Re-review / supersede convention

A spec/plan that changes after Gate 1 approval needs a **new** Gate 1 pass, not a silent
edit — bump a `Superseded-by:` note into the old approval line pointing at the new one.

Same convention for Gate 2: a post-merge fix big enough to need its own plan re-enters at
Gate 1 for that increment, not straight to Gate 2.

## Tripwire pattern (why six thin files exist)

Different tools look for project instructions under different filenames
(`AGENTS.md`, `CLAUDE.md`, `GEMINI.md`, `.cursor/rules/*.mdc`, `.windsurf/rules/*.md`,
`.github/copilot-instructions.md`). Each one is intentionally minimal: it says "read
`.agent/rules/agent-role.md` and `.agent/rules/governance.md` first, then proceed" and
nothing else. This guarantees no tool can silently operate ungoverned just because it looks
in a different place than the others — and guarantees there is exactly one `governance.md`
to update when the rules change.
