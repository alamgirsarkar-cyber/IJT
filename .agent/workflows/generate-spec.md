# Workflow: /generate-spec

> Reusable prompt template. Use this instead of freehand instructions. A spec is never
> the first place a requirement is written down — discovery closes in `BRD.md` first.
>
> This workflow drafts `.ai-context/specs/<feature-slug>.spec.md`. It does not write the
> plan, tasks, or code. How belongs in `/generate-plan` after Gate 1 approves this spec.

**Precondition — stop if any of these is false:**

1. The BRD entry exists in `.ai-context/BRD.md` and "what problem, for whom, bounded how"
   fits in one paragraph.
2. Open questions that a plan would have to **guess** are either resolved or explicitly
   deferred (named, with owner and reason). Business decisions are not made by this prompt.
3. You can name the feature in one unambiguous paragraph a zero-context engineer could
   build from.
4. A slug is chosen: kebab-case, 3–5 words, verb-free, unique for the life of the project,
   never reused. Check existing files under `.ai-context/specs/` — collision is a stop.

If any answer is "not yet," do not open the agent. Go back to the BRD.

## Inputs to tag into the session

Tag exactly these. Do not let the agent scan the workspace.

- `.ai-context/BRD.md` — the linked entry only (`#BRD-NNN`)
- `.ai-context/constitution.md`
- `.ai-context/architecture.md` (only the sections the BRD depends on)
- `.ai-context/project_context.md`
- `.ai-context/templates/_TEMPLATE.spec.md`
- Related specs the BRD's spec map names — **Approved or Released only**; if this spec
  would depend on one that is Draft or Not started, stop and split or defer
- Existing API conventions in `architecture.md` (error shape, versioning, auth)

Do **not** tag `src/`, `prompts.md`, or an existing plan. Those are downstream.

## Prompt

```
Draft the specification for <feature-slug> from BRD-<NNN>.

Write .ai-context/specs/<feature-slug>.spec.md using
.ai-context/templates/_TEMPLATE.spec.md as the structure — every section present unless the
template itself says to delete it (API Contract only if this feature exposes or consumes
an API). Status is Draft v1.0. Author is the engineer running this session. Leave Gate 1
reviewer blank.

Source of truth: .ai-context/BRD.md#BRD-<NNN>. The spec pulls from the BRD; it does not
invent requirements the BRD never stated.

Requirements:
1. One feature, one spec. If the BRD is a programme (several independently releasable
   journeys), spec only the slice this slug owns and name the sibling slugs under
   Explicitly Out of Scope / Related. Do not absorb them.
2. Intent is one paragraph: what changes, for whom, under what condition. No untestable
   adjectives (secure, fast, robust, user-friendly). Two competent engineers reading it
   must build materially the same thing.
3. Intent and acceptance criteria before any implementation detail. How (datastores,
   frameworks, module layout) belongs in the plan, not here — except constraints copied
   from constitution.md into Non-Functional Constraints.
4. Link context; do not restate architecture.md or the BRD. Paths, not pasted blocks.
5. Business rules from the BRD, each IDed <slug>.BR#. Label each as Business or Technical.
   Do not turn an open business question into a rule.
6. If the feature has an API surface, write the API Contract: payload, success shape, and
   an exception table that is exhaustive — not happy path plus one error. Auth, rate-limit
   decision, and idempotency are explicit on every endpoint ("none, because ..." is valid;
   silence is not). Error bodies match the constitution (RFC 7807). Identity from the
   token subject; never from a caller-supplied employee id.
7. If the feature has an employee-facing UI, add a Surfaces table (backend APIs + frontend
   screens) so both layers are in scope of this spec, not implied. Screens are named;
   layout and component structure are not.
8. Every acceptance criterion is given/when/then, individually IDed <slug>.AC#, and
   independently verifiable at Gate 2. Cover failure and boundary paths explicitly —
   invalid input, unauthorised access, dependency timeout, duplicate submission,
   concurrent update — wherever they apply. Agents skip these unless an AC forces them.
9. Spec-derived unit test table: at least one <slug>.UT# per AC, same IDs that QA will
   expand later. Inclusive boundaries have their own rows.
10. Explicitly Out of Scope names the things this feature will be tempted to also fix,
    and where they live instead.
11. Open Questions: any remaining item a plan would have to guess. A spec cannot be
    submitted to Gate 1 with an open question that changes behaviour. If you find one the
    BRD did not close, list it and stop — do not resolve a business decision in the spec.
12. Assumptions: each names what breaks if it is false.
13. Non-Functional Constraints: quote from constitution.md (latency, availability, WCAG,
    PII/logging, rate limits). Do not invent new baselines.
14. No secrets, PII, real employee names, or client-confidential data anywhere in the spec.
    Example payloads use types or placeholders, not people.
15. Revision History: v1.0, dated, driver BRD-<NNN>.

If two competent engineers would still build different things from any AC or from the
intent, stop and list the ambiguities instead of choosing one.
```

## After generation — engineer review before Gate 1

Do not send to review until every box is ticked.

- [ ] Slug is kebab-case, 3–5 words, verb-free, unique, and matches the filename
- [ ] Intent is one unambiguous paragraph
- [ ] Every AC is given/when/then and IDed `<slug>.AC#`
- [ ] API Contract present and complete **if** there is an API; absent **if** there is not
- [ ] Exception tables cover more than happy path plus one error
- [ ] Rate-limit and auth decided per endpoint
- [ ] Surfaces named if there is a UI (wizard/list/status or equivalent)
- [ ] Every AC has at least one spec-derived UT
- [ ] Out of scope is explicit
- [ ] No open question remains that a plan would have to guess
- [ ] No PII, secrets, or invented personal names in examples
- [ ] Related / Builds-on specs are Approved or Released, or this spec does not depend on them
- [ ] Status is `Draft v1.0`
- [ ] `.ai-context/status.md` has a row for this slug (In Peer Review once submitted)

## Next step

Submit to Gate 1: `.agent/workflows/spec-review.md`. Reviewer is never the author.

- **Approved** → `/generate-plan` may run.
- **Changes Requested** → revise this file, bump to `Draft v1.1` (history in the file, not
  only in git), resubmit. Do not start the plan.

Do not generate tasks or code from a Draft spec.
