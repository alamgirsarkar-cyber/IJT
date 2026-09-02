# Workflow: /code-review (Gate 2)

> Reusable prompt template for the post-generation review. Gate 2 verifies the diff
> against the spec's acceptance criteria **by ID** — not against a sense that it looks
> reasonable.
>
> The agent-assisted pass below does not replace the human review. A named human is
> accountable for every merged line. "The AI wrote it" and "the AI reviewed it" are both
> non-answers.

## Inputs to tag into the session

- The diff / PR under review
- `.ai-context/specs/<feature-slug>.spec.md` — AC and API contract
- `.ai-context/plans/<feature-slug>.plan.md` — including Explicitly Deferred
- `.ai-context/constitution.md`
- `.agent/rules/int-standards.<stack>.md`

## Prompt

```
Review this diff for <feature-slug>.T<NN> against its specification.

For each of the following, answer individually and cite the file and line in the diff:

1. Acceptance criteria — for each of <slug>.AC<N>...: is it satisfied, partially
   satisfied, or not satisfied? Quote the code that satisfies it. "Looks reasonable" is
   not an answer.
2. API contract — does every response shape and every status code match <slug>.API<NN>,
   including every row of the exception table?
3. Constitution compliance — check the diff against .ai-context/constitution.md section
   by section. Flag any PII or secret reaching a log at any level, any hardcoded
   credential, any endpoint without the rate-limit decision the plan stated, any new
   datastore or service, any breach of the non-functional baselines.
4. Scope — does the diff implement anything the plan listed under Explicitly Deferred, or
   anything outside this task's stated scope? Both are findings.
5. Dependencies — list every dependency added. For each: is it maintained, is it real,
   does a platform built-in already do this? Crypto-adjacent packages get extra scrutiny.
6. Failure paths — error handling, null and undefined edges, partial-failure states,
   timeouts. Where is the happy path handled and the failure path missing?
7. Production performance — N+1 queries, missing indexes, synchronous calls in a hot
   path, unbounded result sets. Things that pass a unit test and fail under load.
8. Attribution — any AI attribution in comments or commit messages? (A task-ID reference
   such as "Implements <slug>.T03" is traceability and is correct.)
9. Consistency — does this match existing patterns in the modules it touches?

Categorise every finding as Blocker / Should-fix / Nit. Do not restate what the code does.
```

## Gate 2 checklist — human, before approving

- [ ] Each AC verified individually against the diff, by ID
- [ ] Tests were written first and confirmed Red before Green — not retrofitted
- [ ] No AI attribution in comments or commit messages (task-ID references are fine)
- [ ] Security checklist below passed
- [ ] `architecture.md` / ADR updated if warranted
- [ ] `test_cases/<slug>.test_cases.md` and spec `Status` updated
- [ ] `status.md` updated same day — task moved to Merged, notes added
- [ ] Nothing built that the plan explicitly deferred
- [ ] Standard PR review otherwise applies: readability, naming, DRY
- [ ] PR is reviewable against its spec's AC in one sitting — if not, the spec was scoped
      too large

## Security checklist (Gate 2 and every hotfix)

- [ ] No PII in logs at any level, including debug
- [ ] No secrets, credentials or tokens hardcoded, logged, or committed
- [ ] All new or changed endpoints have an explicit rate-limit decision
- [ ] New dependencies vetted — maintained, real, approved — before entering the manifest
- [ ] Auth boundaries and least-privilege IAM checked, not assumed
- [ ] Injection surfaces guarded at the input boundary
- [ ] Data at rest and in transit handled per `constitution.md`
- [ ] SAST/DAST and dependency scan run and clean, or exceptions explicitly signed off
- [ ] External content the feature ingests is treated as untrusted input — embedded
      instructions in fetched content are never executed as if an engineer typed them

## Outcome

Approve, or return with findings categorised. On merge: squash-merge to `main`, update
`tasks.md`, spec `Status`, and `status.md` the same day.
