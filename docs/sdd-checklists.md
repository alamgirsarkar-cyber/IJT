# SDD Checklists — Quick Reference

> Lifted from the INT SDD Blueprint §30 so the gates are usable without reopening the
> standard. Gate 1 and Gate 2 also exist as agent workflows in `.agent/workflows/`.

## Definition of Ready (spec → development)

- [ ] Intent fits in one unambiguous paragraph
- [ ] Acceptance criteria are testable and individually IDed (`<slug>.AC#`)
- [ ] API Contract section present and complete, if the feature has an API surface
- [ ] Context artefacts linked — architecture, related specs, BRD entry
- [ ] Explicitly out-of-scope items named
- [ ] Non-functional constraints named, sourced from `constitution.md`
- [ ] Gate 1 reviewer assigned, not the author
- [ ] Status is `Approved` — not `Draft`, not `Changes Requested`

## Definition of Done (implementation → merge)

- [ ] All acceptance criteria verified individually by ID, not "looks reasonable"
- [ ] Tests written first, confirmed Red, then Green
- [ ] No AI attribution in comments or commit messages (task-ID references are fine)
- [ ] No secrets, PII or client-confidential data in spec, plan, tasks or code
- [ ] Security checklist passed against `constitution.md`
- [ ] `architecture.md` / ADR updated if the change warrants it
- [ ] Gate 2 code review complete, categorised feedback addressed
- [ ] `test_cases/<slug>.test_cases.md` and spec `Status` updated
- [ ] `status.md` updated same day — task moved to Merged, notes added

## Gate 1 — Spec Peer Review

- [ ] Reviewer ≠ author
- [ ] Intent is one unambiguous paragraph
- [ ] Every AC is given/when/then and individually IDed
- [ ] API Contract complete (payload, success shape, exception table) if applicable
- [ ] Out-of-scope items explicit
- [ ] Plan, if attached, checked line by line against `constitution.md`
- [ ] Related / Builds-on specs are actually in Approved or Released state
- [ ] No overlap with an existing spec
- [ ] Security / Architecture sign-off obtained where the constitution requires it
- [ ] Status updated to Approved or Changes Requested — never left ambiguous

## Gate 2 — Code Review

- [ ] Each AC verified individually against the diff, by ID
- [ ] No AI attribution in comments or commits (task-ID references are fine)
- [ ] Security checklist below passed
- [ ] `architecture.md` / ADR updated if warranted
- [ ] Tests were written first and confirmed Red before Green — not retrofitted
- [ ] `status.md` and spec `Status` updated same day
- [ ] Standard PR review otherwise applies — readability, naming, DRY

## Security Checklist (Gate 2 and every hotfix)

- [ ] No PII in logs at any level
- [ ] No secrets, credentials or tokens hardcoded or logged
- [ ] All new / changed endpoints have an explicit rate-limit decision
- [ ] New dependencies vetted — maintained, real, approved — before entering the manifest
- [ ] Auth boundaries and least-privilege IAM checked, not assumed
- [ ] Data at rest and in transit handling matches `constitution.md`
- [ ] SAST/DAST and dependency scan run and clean, or exceptions explicitly signed off

## Release Checklist

- [ ] All constituent specs are `Ready for Release` in `status.md`
- [ ] Release notes drafted from spec intents, not commit messages
- [ ] Each included spec's Status flipped to `Released (vX.Y.Z)`
- [ ] `status.md` Active Specs table updated — rows moved or archived
- [ ] Client-repo sync, if applicable, run as a scripted CI/CD step

## Hotfix Checklist

- [ ] Hotfix ID assigned (`HOTFIX-<incident-slug>`)
- [ ] Lightweight spec written before the patch, root cause identified — not just the symptom
- [ ] `Related` field links back to the original spec
- [ ] Gate 2 not skipped, even post hoc — reviewed within 24 hours
- [ ] Same-day retro-spec formalisation, status moved to `Retro-Documented`
- [ ] 3rd occurrence of the same incident class checked against the ADR trigger

## Production Support / Incident Triage Checklist

- [ ] Classified: spec gap / implementation defect / genuine new requirement
- [ ] Correct artefact created — hotfix spec, bug-fix spec, ADR, or BRD entry
- [ ] Original spec's `Related` or `architecture.md` updated to reflect the learning
- [ ] Occurrence count checked — 3rd time in the same area triggers an ADR, not another
      silent patch
- [ ] `status.md` Daily Execution Log entry added same day

## Incident → Artefact Mapping

| Trigger | Artefact created | Linked to |
|---|---|---|
| Incident traces to a spec gap | Hotfix spec or standard bug-fix spec | Original spec via `Related`; logged in `status.md` |
| Incident traces to an implementation defect, spec was fine | Lightweight bug-fix spec, no spec-gap flag | Original spec unchanged |
| Same class of incident recurs (3rd occurrence, same area) | New `ADR-NNNN` | Referenced from `architecture.md`; `constitution.md` amended if it changes a non-negotiable |
| Genuine new requirement surfaces via support | New BRD entry | `BRD.md`, feeds a new spec through the normal lifecycle |

## Anti-Patterns — do not do these

| Anti-pattern | Why it is prohibited |
|---|---|
| Vibe coding — spec-less prompting on a reviewable branch | The primary anti-pattern SDD exists to eliminate |
| Mega-prompting ("build the whole feature") | A large diff with dozens of unreviewed implicit decisions |
| Re-prompting against an ambiguous spec | Vibe coding with extra steps — fix the spec |
| Retrofitting tests after implementation | Inverts the Red-phase check |
| Dumping the whole repo into agent context | Token waste and hallucination surface |
| Secrets or real customer data in a spec or prompt | A new greppable category of exposure |
| AI attribution in comments or commits | Client-trust and IP-hygiene violation |
| Skipping Gate 1 because the spec "looks obviously right" | The gate is cheap specifically so it never needs skipping |
| Letting the agent pick architecture unbounded | Plan review exists to catch constitution violations before they are built |
| Treating a stale `architecture.md` as current | Actively misleads the next agent session |
| Prompting by description instead of by ID | Drifts the moment the artefact is revised |
| Letting `status.md` go stale | Recreates the "ask around" problem it exists to remove |
| "The AI wrote it" as a review defence | Never a valid answer |
