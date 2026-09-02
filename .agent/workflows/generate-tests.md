# Workflow: /generate-tests

> Reusable prompt template for the Red phase. Tests are generated from the spec's own
> test-case table **before** any implementation task runs.
>
> Retrofitting tests after implementation is prohibited: it inverts the Red-phase check
> that catches wrong-behaviour-by-design. A test written against finished code proves the
> code does what it does, not what the spec required.

**Precondition:** `tasks.md` exists and is reviewed; the task you are generating tests for
names the AC and test-case IDs it must satisfy.

## Inputs to tag into the session

- `.ai-context/specs/<feature-slug>.spec.md` — the AC and Unit Test Cases table
- `.ai-context/test_cases/<feature-slug>.test_cases.md`, if QA has expanded it
- `.ai-context/tasks/<feature-slug>.tasks.md` — the single task in scope
- `.agent/rules/int-standards.<stack>.md` — framework, structure, mocking policy
- The module under test and its existing test file, if one exists — nothing wider

## Prompt

```
Generate the failing tests for <feature-slug>.T<NN>.

Derive them strictly from these IDs and nothing else:
- Acceptance criteria: <slug>.AC<N>, <slug>.AC<N>
- Test cases: <slug>.UT<NN>, <slug>.UT<NN>
- API contract, including the full exception table: <slug>.API<NN>

Rules:
1. One test per test-case ID. Name each test so the ID appears in the test name, so a
   failing run points straight back at the spec.
2. Assert the behaviour the AC states — not the implementation you expect someone to
   write. Do not assert on internal call order or private structure.
3. Cover every row of the exception table, not the happy path plus one error.
4. Cover the boundary and failure cases explicitly: invalid input, unauthorised caller,
   dependency timeout, duplicate submission, concurrent update — wherever an AC names one.
5. Use <framework> per .agent/rules/int-standards.<stack>.md, and follow its structure,
   naming and mocking policy.
6. Use synthetic test data only. Never real customer data, never production identifiers,
   never a real secret or token — including in fixtures.
7. Write no implementation code and no stub bodies beyond what is needed for the test
   file to compile and fail. The tests must fail for the right reason: absent behaviour,
   not a syntax or import error.
8. If a test case cannot be written because the AC does not say what should happen, stop
   and list it. That is a spec gap and it goes back to the author, not into a guess.
```

## Red-phase confirmation — the engineer does this, not the agent

- [ ] Test suite runs and the new tests **fail**
- [ ] Each failure is for absent behaviour, not a compile, import or fixture error
- [ ] Every AC in the task has at least one failing test
- [ ] Every exception-table row has a test
- [ ] No implementation code was added
- [ ] Red state recorded in `tasks.md` Execution Notes with the date

Only then does the implementation prompt run. If the tests pass before implementation,
either the behaviour already exists — in which case the task is wrong — or the test is
asserting nothing.

## Note on ownership

Generated tests are a starting point QA validates, not a substitute for QA judgement.
Data volumes, device and browser matrices, accessibility, and the grey-area calls the
spec did not resolve remain QA's, and land in
`.ai-context/test_cases/<feature-slug>.test_cases.md`.
