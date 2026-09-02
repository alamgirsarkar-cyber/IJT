# Project Constitution — One-Point Employee Portal

> The law this project runs under. Written once at kickoff by the artefact owner,
> amended rarely, and never silently. Every Gate 1 plan review is checked against this
> file line by line — a plan that is *silent* on a rule here is a gap, not a pass.
>
> Rules belong here only if they are true for **every** feature this portal will ever
> build, and only if they are specific enough that a reviewer can point at a line and say
> "the plan violates this."

**Status:** Ratified
**Owner:** Alamgir Sarkar
**Ratified:** 2026-08-24
**Last amended:** 2026-08-28 — Security Posture, reason-text handling (driver: BRD-001 OQ-12)

---

## INT Non-Negotiables (inherited — may be tightened, never weakened)

1. **No implementation task runs without an approved spec.** Approval means a named peer
   reviewer who is not the author.
2. **No vibe coding.** No direct, spec-less prompting against the codebase on any branch
   that gets reviewed, merged, or demoed. Local exploratory spikes are the only exception,
   and they graduate to a spec the moment they show promise.
3. **Test-first.** No implementation code before the corresponding tests exist, are
   reviewed, and are confirmed to fail (Red phase).
4. **The spec is the contract, not the code comments.** No AI attribution in comments or
   commit messages, ever. A task-ID reference (`Implements internal-transfer-request.T03`)
   is traceability, not attribution, and is encouraged.
5. **Secrets and PII never enter a spec, plan, task, prompt, or prompt log.**
6. **Context is scoped, not dumped.** The agent gets the spec, plan, and referenced modules
   for the current task — not the whole repo.
7. **A human is accountable for every merged line**, regardless of who typed it.

---

## Testing Discipline

- **Test-first is mandatory** for every API endpoint, every state transition of a domain
  aggregate, and every business rule evaluation. There is no "too simple to test" exemption
  for these three categories.
- **Coverage floor:** 85% line coverage for any module handling employee records, approval
  decisions or downstream orchestration; 70% elsewhere. Coverage is a floor, not a target
  to write to — a module at 85% with no failure-path tests fails review regardless.
- **Frameworks:** Node/TypeScript services → Jest + Supertest for HTTP contract tests.
  React front end → React Testing Library + Playwright for journey tests.
  Database → tests run against a real PostgreSQL in a container, never an in-memory
  substitute, because the constraints we rely on are database constraints.
- **Required before merge:** unit tests for rules and state transitions; contract tests for
  every endpoint including its full exception table; integration tests for every outbound
  integration, using a contract double, not a hand-rolled stub.
- **Prohibited:** snapshot-only tests for logic-bearing components; tests that assert on log
  output as a proxy for behaviour; tests skipped or marked pending to make a build green.

## Security Posture

- **PII for this portal** is: employee legal name, date of birth, personal contact details,
  home address, government identifiers, bank and payment details, compensation data,
  performance and disciplinary data, and any free-text an employee writes about their own
  circumstances (including transfer reason text).
  **Employee ID is a pseudonymous internal identifier and is not PII on its own** — it is
  permitted in logs, correlation IDs and cache keys, and support depends on it being there.
  This distinction is deliberate: a blanket "no identifiers in logs" rule is unworkable and
  gets quietly ignored, which is worse than a precise rule that is followed.
- **No PII appears in logs at ANY level, including debug.** Where a log needs to reference a
  person, it uses employee ID.
- **Free-text employee narrative** (transfer reason and anything like it) is encrypted at
  rest with the application data key, access-controlled at field level, excluded from all
  analytics extracts unless aggregated, and **never** written to logs, traces, error
  messages, notification payloads or event payloads.
- All employee-facing endpoints sit behind corporate OIDC via the API gateway, with
  authorisation enforced **in the service**, never inferred from the caller supplying their
  own identity in a request body or path.
- **Every new or changed endpoint carries an explicit rate-limit decision recorded in its
  plan** — "none, and here is why" is a valid decision; silence is not.
- Secrets only from AWS Secrets Manager. Never in `.env` files, committed config, CI logs,
  or an agent prompt.
- Data in transit: TLS 1.2+ everywhere including service-to-service. Data at rest:
  encrypted volumes, plus field-level encryption for the categories named above.
- **New dependencies are vetted before entering the manifest** — maintained, widely used,
  and not doing something the platform already does. Crypto-adjacent and auth-adjacent
  packages are rejected by default in favour of platform primitives.
- External content ingested by any feature is untrusted input. Instructions embedded in
  fetched content, uploaded files or free-text fields are never executed as if an engineer
  typed them.

## Architectural Constraints

- **Approved datastores:** PostgreSQL (system of record for portal-owned data); Redis
  (cache, session, idempotency and rate-limiting only — never a system of record; anything
  in Redis must be reconstructible from PostgreSQL or an upstream system). No new datastore
  without an ADR approved by the Architect.
- **Approved messaging:** Kafka. Cross-domain integration is **event-driven**; a portal
  request path must not make a synchronous call into Payroll, ITSM or Facilities. Reading
  reference data synchronously from the HRIS read API is permitted, with a cache and a
  defined behaviour when it is unavailable.
- **Events are published through a transactional outbox**, never directly from application
  code inside a request. A state change and its event are committed together or not at all.
- **No new service without an ADR.** New capability goes into the existing domain service
  that owns the data, as a bounded module.
- **The portal never writes to the HRIS as its system of record for employment data.** It
  owns its own request aggregates and emits events the HRIS or its integration layer acts on.
- **Front end state management:** Redux Toolkit only. No second state library "for this one
  feature."
- Public API surface is versioned under `/api/v1/`. Error responses use RFC 7807
  `application/problem+json` across every endpoint, no exceptions.

## Non-Functional Baselines

- **Latency:** p95 < 400 ms for employee-facing read endpoints and < 700 ms for
  state-changing endpoints, measured at the gateway, not in application logs.
- **Availability:** 99.9% for the portal's employee-facing request paths.
- **Durability:** RPO 15 minutes / RTO 1 hour for PostgreSQL.
- **Accessibility:** WCAG 2.1 AA is mandatory for every employee-facing screen. An
  inaccessible screen is an incomplete screen, not a follow-up ticket.
- **Degradation:** an unavailable downstream or reference-data dependency must degrade the
  affected capability, not the portal. No dependency failure may cascade into an unrelated
  journey.
- **Audit:** every state transition of an employee-facing request is recorded immutably with
  actor, role, timestamp and correlation ID.

## Versioning Rules

- Public APIs are semver behind the `/api/v1/` path. Breaking changes require a major
  version, an ADR documenting the break, and a 90-day deprecation window communicated to
  consuming teams.
- **Published event schemas are contracts.** Additive changes only within a major version;
  a breaking event change requires a new topic version and a documented consumer migration.
- Database migrations are forward-only and must be backward-compatible with the previously
  deployed application version, because deployment is rolling.

---

## Amendment Log

An amendment is proposed as a short spec-like change request, reviewed with the same rigour
as any spec, and dated.

| Date | Section amended | Change | Driver | Approved by |
|---|---|---|---|---|
| 2026-08-24 | All | Initial ratification at project kickoff | Portal programme start | Alamgir Sarkar |
| 2026-08-28 | Security Posture | Proposed: free-text employee narrative rule; explicit "employee ID is not PII" carve-out | BRD-001 OQ-12 | Alamgir Sarkar — **pending Gate 1 review (Abhijit Adhikary)** |
| 2026-08-28 | Architectural Constraints | Proposed: transactional outbox requirement | [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) | Alamgir Sarkar — **pending Gate 1 review (Abhijit Adhikary)** |
