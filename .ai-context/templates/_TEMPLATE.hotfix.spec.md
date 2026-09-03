# Spec: HOTFIX-<incident-slug>

<!--
  Copy to .ai-context/specs/hotfix-<YYYY-MMDD>-<incident-slug>.spec.md.

  Hotfixes get a compressed chain, never a skipped one. This file is written BEFORE the
  patch, even under pressure. One paragraph each: what broke, correct behaviour, 1–2 AC.

  Gate 1's reviewer-not-author rule may be waived only in a genuine production emergency.
  Gate 2 is never skipped — reviewed within 24 hours regardless.
-->

## Status

`Emergency-Merged → Retro-Documented` (same working day)

## Incident

| Field | Value |
|---|---|
| Hotfix ID | `HOTFIX-<incident-slug>` |
| Severity | <P1 / P2 / P3> |
| Detected | <date, time, how> |
| Responder | <name> |
| Gate 2 reviewer | <name>, reviewed <date within 24h> |

## Related

`.ai-context/specs/<original-feature-slug>.spec.md`

## What Was Broken

<One paragraph: the observable failure, who it affected, and the blast radius.>

## Root Cause

<One paragraph — the cause, not the symptom. Name the artefact where the gap originated:
a spec ambiguity, a plan decision, or an implementation defect. Patch only after this
section is written.>

**Classification:** <Spec gap / Implementation defect / Genuine new requirement>

## Correct Behaviour (Acceptance Criteria)

1. `<hotfix-slug>.AC1` — <the failing scenario now succeeds, given/when/then>.
2. `<hotfix-slug>.AC2` — <the existing regression suite still passes>.

## Fix Summary

<What changed, and why it respects `constitution.md` — name the rules it touches.>

## Upstream Correction

| Artefact | Action | Done |
|---|---|---|
| Original spec | <AC amended to remove the ambiguity, or "unchanged — implementation defect"> | <date> |
| `architecture.md` | <updated / not warranted> | <date> |
| `test_cases/<slug>.test_cases.md` | <regression case added> | <date> |
| `status.md` | Daily Execution Log entry added | <date> |

## Recurrence Check

| Question | Answer |
|---|---|
| Occurrence count for this incident class in this area | <N> |
| 3rd occurrence — ADR raised? | <ADR-NNNN / not applicable> |

<!-- 3rd occurrence in the same area triggers an ADR, not another silent patch. -->

## Release

Shipped as <patch version>, included in release notes as:
"Fixed: <plain-language description> (`hotfix-<incident-slug>`)."
