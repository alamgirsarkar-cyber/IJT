# Security Assessment: `internal-transfer-request`

**Assessed by:** Alamgir Sarkar
**Date:** 2026-08-31 · **Reviewed against:** `.ai-context/constitution.md` — Security Posture
**Spec version:** v1.1 (In Peer Review) · **Plan status:** Plan Drafted
**Verdict:** **Draft** — pending Gate 1 spec/plan approval and Security sign-off. Three
conditions to carry into Gate 2 when build starts (C1–C3 below).

> Assessed against the constitution, not only the spec. A feature can satisfy every
> acceptance criterion and still breach a non-negotiable, because the spec describes what the
> feature does and the constitution describes what the project may never do.

## Data Classification

| Data | Classification | Where it lives | Handling |
|---|---|---|---|
| Employee ID | Pseudonymous internal identifier — **not PII on its own** | Database, logs, correlation IDs | Permitted in logs; support depends on it |
| Employee name, contact details | **PII** | Not stored by this feature; resolved at read time from the HRIS | Never logged, never in an event payload |
| Line manager name | **PII** | Not stored; resolved at read time for display | Disclosed to the employee only where the assignee is their own line manager (BRD-001 OQ-11) |
| Employment status, service dates | **PII (HR)** | Read at submit; `service_in_position_months` snapshotted | Snapshot is the minimum needed to explain a BR2 decision later |
| Department, location, position, grade, cost centre | Internal | Snapshotted at submit | Not sensitive individually; identifying in combination, so still not logged wholesale |
| **Transfer reason / withdrawal reason** | **PII — free-text employee narrative** | `reason_ciphertext`, `withdrawal_reason_ciphertext` | Field-level encrypted; readable by the employee and HR only; excluded from events, notifications, list responses, logs, traces, metrics and error messages |
| Audit records | Internal, immutable | `transfer_request_audit` | Actor employee ID and role only; no PII in `metadata` |

**The reason field is the single most sensitive thing this feature introduces.** An employee
may use it to describe a health circumstance, a family situation, or a problem with a named
manager. Before this assessment the constitution's PII list did not name free-text narrative,
so a literal reading permitted logging it — and an agent reads literally. The constitution was
amended on 2026-08-28 (proposed; **pending Gate 1 ratification**) so that every future feature inherits
the rule rather than rediscovering it.

## Threat Assessment

| # | Threat | Category | Vector | Mitigation | Verified by |
|---|---|---|---|---|---|
| T1 | An employee reads another employee's transfer request | Broken object-level authorisation — the most likely serious flaw in a feature shaped like this | Guessing or observing a request ID | Ownership enforced in the service on every read and write; identity from the token subject only; a caller-supplied employee ID is never trusted | AC13, UT36, UT37, NT01, NT02 |
| T2 | Request IDs enumerated to learn who has a transfer in flight | Information disclosure | 403-vs-404 distinction | Uniform 404 for both not-found and not-owned, with the reasoning written into AC13 so it is not "fixed" back later | AC13, ST01 |
| T3 | Reason text leaks through a log, trace, metric or error | Sensitive data exposure | Debug logging, an exception path, or an event payload | Field-level encryption; allow-list event mapper; redaction layer; a log-capture test across the whole submit path | AC16, UT46–UT48, ST02–ST05 |
| T4 | Reason text leaks to a manager through the status view | Sensitive data exposure | Over-broad response DTO | Reason returned only to the owning employee; absent from list responses entirely; no manager-facing endpoint exists in this spec | AC12, AC16, UT48 |
| T5 | Reason text reaches downstream systems that never needed it | Excessive data exposure | Serialising the aggregate into the event | Allow-list mapper naming every emitted field, so a future column cannot leak by default (plan finding P1) | ST03, UT46 |
| T6 | Duplicate transfer requests created by a double submit or a replay | Business-logic abuse | Double click, retry, replayed request | `Idempotency-Key` required on submit; partial unique index enforces one active request in the database, not only in code | AC8, AC10, UT23, UT27, UT27a |
| T7 | Submission flood exhausting HRIS quota or the database | Resource abuse | Scripted client | Per-endpoint rate limits with the submit path at 5/hour; counters keyed by a salted hash; gateway limit above it | AC17, UT49, UT50, NT05 |
| T8 | Eligibility bypassed by manipulating the request | Business-logic bypass | Submitting values never validated | Submit takes an empty body — every value comes from the persisted draft; rules re-evaluated at submit against live data, not against what was true when drafted | AC6, AC7, UT14, UT14a |
| T9 | Audit trail altered to hide an action | Repudiation | Application bug or a malicious change | `REVOKE UPDATE, DELETE` from the application role — a database guarantee, not a code convention (plan finding P3) | AC18, UT52, INT-REG-03 |
| T10 | Injection through free-text or reference IDs | Injection | `reason`, `targetPositionId` | Parameterised queries throughout; reference IDs validated against the governed list; output escaped on render | NT06, NT07, NT09 |
| T11 | Cached reference data serving positions an employee may not see | Authorisation via cache | Shared cache keys | Reference data is non-personal and identical for all employees; nothing employee-specific is cached; keys are explicitly versioned | AC15, UT42–UT44 |
| T12 | A stale eligibility read letting a leaver or a probationer transfer | Business-logic bypass through staleness | Caching employment data for speed | Employment data is read fresh and uncached at submit; a 503 is preferred to a stale decision ([ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md)) | AC15, UT45 |
| T13 | HRIS outage cascading into unrelated portal journeys | Availability | Shared connection pool or thread exhaustion | Circuit breaker with a 2 s timeout; bounded pool per integration; degradation confined to this journey | AC15, PT04, INT-FAIL-01, INT-FAIL-02 |
| T14 | Secrets or keys exposed | Credential exposure | Committed config, logs, CI output | AWS Secrets Manager at runtime; no `.env`; the encryption key is a managed key with rotation, never in application config | Gate 2 security checklist |
| T15 | An unvetted dependency entering the manifest | Supply chain | An agent suggesting a convenient package | No dependency added without a vetting note; crypto-adjacent packages rejected by default in favour of platform primitives | ST06, Gate 2 |
| T16 | Instructions embedded in employee free text executed by an agent or a downstream tool | Prompt injection through user content | An employee writing agent-directed text into `reason` | Reason text is data, never instruction; it is never fed to an agent, never rendered as markup, and is excluded from every automated summary | AC16, NT07 |

## Constitution Compliance

| Security Posture rule | Compliance | Evidence |
|---|---|---|
| No PII in logs at any level | Compliant by design | AC16; UT47 captures logs across the whole submit path rather than unit-testing a redaction function |
| Employee ID permitted in logs | Used deliberately in structured logs | Plan, Data Model |
| Free-text employee narrative protected | Compliant | AC16, T3–T5, T16 |
| OIDC on all employee-facing endpoints; authorisation enforced in the service | Compliant | AC13; gateway plus in-service ownership checks |
| Explicit rate-limit decision per endpoint | Compliant | Seven endpoints, seven decisions in the spec's API Contract |
| Secrets only from Secrets Manager | Compliant | T14 |
| TLS in transit; encryption at rest plus field-level for narrative | Compliant | Data Classification |
| Dependencies vetted before entering the manifest | Condition C3 | ST06 |
| External content treated as untrusted input | Compliant | T16 |
| Immutable audit of every state transition | Compliant | AC18, T9 |

## Conditions Carried to Gate 2

These are not advisory. Gate 2 fails if any is unmet.

- **C1 — Log-absence proof, not log-absence intention.** `UT47` must assert against captured
  output from a real submit path including an error path, not against a redaction utility in
  isolation. A redaction function that works is not evidence that nothing bypasses it.
- **C2 — Event payload allow-list.** The reviewer must confirm the mapper names its fields
  explicitly. A payload built by serialising the aggregate and deleting keys fails this
  condition even if the emitted payload is currently correct, because it is one added column
  away from being wrong.
- **C3 — Dependency diff.** Every dependency added across T01–T10 is listed with its vetting
  note. Any crypto-adjacent or auth-adjacent package is rejected unless a platform primitive
  genuinely cannot do the job.

## Residual Risks Accepted

| Risk | Why accepted | Owner | Revisit |
|---|---|---|---|
| HR can read reason text and HR access is role-based, not per-request | HR must read it to do the job; the alternative is a break-glass flow disproportionate to the sensitivity | Data Privacy | If reason text is ever used for analytics |
| Reason text purge at 24 months is specified but not built | Retention is a platform capability, not a feature-local job; raised as a separate backlog item | Data Privacy | Before the first records reach 24 months — **tracked, not forgotten** |
| Events are emitted with no consumers in v1 | Payloads carry no PII, so an unconsumed event on a topic is not an exposure | Security | When consumers are built |
| BR9 (disciplinary cases) is checked manually by HR | HR will not expose case data to the portal (BRD-001 OQ-04); the portal states it has not checked rather than implying it has | HR Policy | If HR ever exposes an eligibility API |
| Employee ID is treated as non-PII | A blanket ban on identifiers in logs is unworkable and gets ignored, which is worse than a precise rule that is followed | Security | If employee IDs ever become externally resolvable |

## Pipeline Requirements

SAST, DAST and dependency scanning run on this branch regardless of who or what wrote the
code. A clean scan is necessary and not sufficient — none of T1, T2, T6, T8 or T12 is
detectable by a scanner, because they are business-logic flaws, and they are exactly the class
of flaw an agent produces most readily: the happy path is correct and the authorisation or
staleness edge is absent.
