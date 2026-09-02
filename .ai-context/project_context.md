# Project Context — One-Point Employee Portal

> One page. What you would hand a new hire on day one, before anything else — and what an
> agent reads to orient itself before touching a spec. Detail belongs in
> `architecture.md`, not here.

**Last updated:** 2026-09-01 · **Maintained by:** Alamgir Sarkar

## Objective

The One-Point Employee Portal is the single entry point through which employees access HR,
payroll, IT, learning and facilities services. Its purpose is to remove the burden of
knowing *which* function owns a task: the employee asks once, the portal orchestrates the
functions behind it, and the employee sees one view of progress.

The current programme increment adds the **Employee Internal Transfer Digital Journey**
(BRD-001) — today an employee moving internally has to coordinate their manager, HR,
Payroll, IT and Facilities themselves, with no shared record and no visibility.

## Scope

- **In scope:** employee-initiated service journeys that span more than one back-office
  function, and the orchestration and status visibility that makes them a single journey.
- **Out of scope:** being a system of record for employment data (that is the HRIS), payroll
  calculation, identity administration, and any manager- or HR-initiated process. The portal
  is the employee's front door and the orchestrator, not the master.

## Primary Users and Personas

| Persona | What they do here | What "good" looks like for them |
|---|---|---|
| Employee | Raises and tracks service requests across functions | Submits once; always knows the current state and who it is with |
| Line manager | Acts on requests raised by their reports | A clear ask with enough context to decide without a meeting |
| HR Business Partner | Validates policy and eligibility | Rules applied consistently; exceptions surfaced, not buried |
| Back-office functions (Payroll, IT, Facilities) | Fulfil their part of a journey | Told what changed and when it takes effect, in their own system |
| HR Operations / Audit | Oversee process integrity | A complete, immutable record per request |

## Architecture Summary

- **`employee-portal-web`** — React front end; the employee's single view.
- **`employee-services`** — Node/TypeScript domain service; owns portal request aggregates,
  their state machines and their APIs. The internal transfer journey is a bounded module
  inside it, not a new service.
- **SQLite** — system of record for everything the portal owns.
- **SQLite** — system of record for everything the portal owns, including the transactional
  outbox, reference-data cache, idempotency records and rate-limit counters.
- **Outbox relay** — polls SQLite and delivers events to downstream HTTPS webhook endpoints.
  No message broker.
- **HRIS** — system of record for employment and organisational data. The portal reads it;
  it does not write to it directly.

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Front end | React 18, TypeScript, Redux Toolkit | Portal design system; WCAG 2.1 AA mandatory |
| API / domain | Node.js 20, TypeScript, Express | Modular monolith per domain service |
| Data | SQLite 3 | Migrations forward-only; cache, idempotency and rate limits in SQLite |
| Integration | HTTPS webhooks via outbox relay | Transactional outbox pattern; event schemas are contracts |
| Test | Jest, Supertest, React Testing Library, Playwright | Real SQLite file in tests |
| Platform | AWS, API Gateway, Secrets Manager, corporate OIDC | Gateway owns coarse auth; services own fine-grained |

## Stakeholders and Decision Owners

Named people on this assessment:

| Role | Name |
|---|---|
| Owner / author | Alamgir Sarkar |
| Gate 1 reviewer | Abhijit Adhikary |
| Gate 2 reviewer | Tapas Dutta |

Functions that own decisions (no named incumbents):

| Area | Signs off on |
|---|---|
| Product | Scope, priority, acceptance |
| HR Policy | Eligibility and process rules |
| Data Privacy | What may be stored, shown, retained |
| Architecture | Plans touching Architectural Constraints |
| Security | Plans touching Security Posture |
| QA | Test strategy, UAT sign-off |

## Environments

| Environment | Purpose | Data | Access |
|---|---|---|---|
| local | Development | Synthetic fixtures only | Engineers |
| dev | Continuous integration | Synthetic | Engineers, QA |
| sit | Integration with downstream test instances | Masked, non-production | Engineers, QA, downstream teams |
| uat | Business acceptance | Masked | HR Ops, Product, QA |
| prod | Live | Real | Break-glass only, audited |

Production PII never leaves production, including into a test fixture or an agent prompt.

## Where Things Live

| Artefact | Location |
|---|---|
| **Agent session entry** | `AGENTS.md` |
| Non-negotiables | `.ai-context/constitution.md` |
| Living system design | `.ai-context/architecture.md` |
| Requirements source | `.ai-context/BRD.md` |
| Delivery state board | `.ai-context/status.md` |
| Feature artefact chain | `.ai-context/specs/`, `plans/`, `tasks/` |
| Test cases | `.ai-context/test_cases/` |
| Decisions | `.ai-context/decisions/` |
| Gate records | `.ai-context/reviews/` |
| Security assessments | `.ai-context/security/` |
| Task prompts | `.ai-context/prompts/` |
| Agent rules and workflows | `.agent/` |

## Glossary

| Term | Meaning |
|---|---|
| Internal transfer | An employee moving to a different department, location or position within the same legal entity |
| Requested effective date | The date the employee asks for. Not a commitment — HR sets the confirmed date at validation (BRD-001 OQ-05) |
| Stage | One step of a journey owned by a specific role, with its own status. A request's stage plan is fixed at submission |
| Pending with | The role, and sometimes the person, an incomplete stage is waiting on |
| Applicability | Whether a conditional stage (Payroll, IT, Facilities) applies to a given request |
| Position | A specific budgeted role in position management, distinct from a job title |
| Terminal state | A request state from which no further transition is possible: Completed, Rejected, Withdrawn, Cancelled |
