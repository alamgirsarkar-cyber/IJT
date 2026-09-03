# Test Cases: <Feature Name>

<!--
  Copy to .ai-context/test_cases/<feature-slug>.test_cases.md. Owned and updated
  alongside the spec of the same slug.

  This is the QA-expanded version of the spec's own Unit Test Cases table — same IDs,
  more scenario coverage: data variations, negative paths the AC did not spell out,
  device and browser matrices, accessibility.

  Test cases derive from acceptance criteria, never from reading finished code.
  Generated tests are a starting point QA validates, not a substitute for QA judgement.

  Cross-feature and system-level journeys do NOT belong here — they live in
  .ai-context/test_cases/_integration.md.
-->

## Derived From

`.ai-context/specs/<feature-slug>.spec.md` (<version>)

## Coverage Summary

| AC | Spec-derived cases | QA-expanded cases | Automated | Status |
|---|---|---|---|---|
| `<slug>.AC1` | UT01 | UT01a, UT01b | <yes / no> | <Not Run / Pass / Fail> |

## Spec-Derived Cases

<Carried forward from the spec, same IDs, unchanged in meaning.>

| Test ID | Maps to AC | Type | Scenario | Expected | Automated |
|---|---|---|---|---|---|
| `<slug>.UT01` | AC1 | Unit | <scenario> | <expected> | <yes / no> |

## QA-Expanded Cases

<Negative paths, data variations, and boundaries the AC implied but did not enumerate.
Where a case has no matching AC, that is a spec gap — raise it rather than silently
testing behaviour nobody specified.>

| Test ID | Maps to AC | Type | Scenario | Data | Expected | Automated |
|---|---|---|---|---|---|---|
| `<slug>.UT01a` | AC1 | Unit | <boundary variation> | <data> | <expected> | <yes / no> |
| `<slug>.IT01` | AC2 | Integration | <scenario across a real dependency> | <data> | <expected> | <yes / no> |
| `<slug>.NT01` | AC3 | Negative | <invalid input / unauthorised / dependency down> | <data> | <expected> | <yes / no> |

## Non-Functional Cases

| Test ID | Concern | Scenario | Threshold (from constitution.md) | Result |
|---|---|---|---|---|
| `<slug>.PT01` | Performance | <load profile> | <p95 target> | <result> |
| `<slug>.AT01` | Accessibility | <journey> | <standard, level> | <result> |
| `<slug>.ST01` | Security | <auth boundary / injection / PII in logs> | <rule> | <result> |

## Environment and Data

| Test type | Environment | Data | Notes |
|---|---|---|---|
| <type> | <env> | <synthetic / masked — never production PII> | <setup> |

## UAT Traceability

<UAT traces line by line to acceptance criteria, by AC ID. A UAT failure with no matching
AC means the spec was incomplete or Gate 1 missed a gap — either way the spec is updated,
not just the code.>

| UAT scenario | AC | Result | Defect | Spec gap? |
|---|---|---|---|---|
| <scenario> | `<slug>.AC1` | <Pass / Fail> | <ref> | <yes → spec revised to vX.Y / no> |
