# Architecture — One-Point Employee Portal

> The living system design. Updated whenever a plan introduces a new integration, datastore
> or significant decision. A stale `architecture.md` is worse than no doc, because the next
> agent session will believe it.

**Last updated:** 2026-09-01 · **Updated by:** Alamgir Sarkar · **Driven by:** `internal-transfer-request` plan review

## Currency Check

| Question | Answer |
|---|---|
| Last plan reviewed that touched this file | `internal-transfer-request`, 2026-08-31 |
| Known-stale sections | Downstream Fulfilment — describes the target state agreed in [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md); consumers are not yet built |

---

## System Overview

```
                       ┌───────────────────────────┐
   Employee ──OIDC──▶  │   employee-portal-web     │  React 18 / Redux Toolkit
                       └─────────────┬─────────────┘
                                     │ HTTPS  /api/v1
                       ┌─────────────▼─────────────┐
                       │      API Gateway          │  OIDC validation, global rate limit
                       └─────────────┬─────────────┘
                                     │
                       ┌─────────────▼─────────────────────────────┐
                       │           employee-services               │  Node 20 / NestJS
                       │  ┌─────────────────────────────────────┐  │
                       │  │ internal-transfer module            │  │
                       │  │  request aggregate · stage plan     │  │
                       │  │  eligibility rules · outbox         │  │
                       │  └─────────────────────────────────────┘  │
                       └───┬──────────────┬───────────────┬────────┘
                           │              │               │
                   ┌───────▼──────┐ ┌─────▼─────┐  ┌──────▼───────┐
                   │ PostgreSQL   │ │  Redis    │  │   Kafka      │
                   │ system of    │ │ cache /   │  │  outbox      │
                   │ record       │ │ idem / RL │  │  relay       │
                   └──────────────┘ └───────────┘  └──────┬───────┘
                           ▲                              │
                    read   │                     events   │
                  ┌────────┴────────┐      ┌──────────────┼──────────────┬─────────────┐
                  │   HRIS read API │      ▼              ▼              ▼             ▼
                  │ employees, org, │  Payroll         ITSM         Facilities   Notification
                  │ positions       │  consumer       consumer       consumer      service
                  └─────────────────┘
```

## Components

| Component | Responsibility | Owns | Tech | Notes |
|---|---|---|---|---|
| `employee-portal-web` | Employee-facing UI for every portal journey | No data | React 18, TS, Redux Toolkit | WCAG 2.1 AA mandatory |
| `employee-services` | Portal domain APIs and state machines | Portal request aggregates | Node 20, NestJS, TS | Modular monolith — new journeys are modules, not services |
| `internal-transfer` module | Transfer request lifecycle, stage plan, eligibility evaluation | `transfer_request` and related tables | — | Introduced by `internal-transfer-request` |
| PostgreSQL | System of record for portal-owned data | All portal aggregates | PostgreSQL 15 | Forward-only, rolling-safe migrations |
| Redis | Reference-data cache, idempotency, rate limiting | Nothing authoritative | Redis 7 | Everything reconstructible from PostgreSQL or HRIS |
| Outbox relay | Publishes committed outbox rows to Kafka | Delivery state | Node worker | At-least-once; consumers must be idempotent |

## Data Model

| Entity | System of record | Key attributes | Retention | Notes |
|---|---|---|---|---|
| `transfer_request` | Portal | reference no, employee id, status, current and target assignment snapshot, requested effective date, reason (encrypted), version | 7 years | Reason text purged at 24 months (BRD-001 OQ-17) |
| `transfer_request_stage` | Portal | stage code, sequence, status, assigned role, assigned party ref, applicability, SLA due | With parent | Stage plan fixed at submission; SLA field captured but unused in v1 |
| `transfer_request_audit` | Portal | actor id, actor role, event, from/to status, occurred at, correlation id, metadata | 7 years, immutable | Append-only; no PII in metadata |
| `transfer_request_outbox` | Portal | aggregate id, event type, payload, published at, attempts | 30 days after publish | Committed in the same transaction as the state change |
| Employee, org unit, position | **HRIS** | — | — | Portal reads only; snapshots are copies, not masters ([ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md)) |

### Schema changes in force

| Change | Introduced by | Migration | Date |
|---|---|---|---|
| `transfer_request`, `_stage`, `_audit`, `_outbox` tables | `internal-transfer-request` T01 | Forward-only, additive; no existing table altered | Pending |

## Integration Points

| Integration | Direction | Protocol | Sync/Async | Failure mode | Owner | Contract |
|---|---|---|---|---|---|---|
| Corporate IdP | Inbound | OIDC | Sync | Gateway rejects; portal unaffected | Security Engineering | Platform standard |
| HRIS read API | Outbound | REST | Sync, cached | Cache serves stale within TTL; beyond TTL the transfer journey returns 503 and degrades alone | HR Systems | `docs/contracts/hris-read-api.md` |
| Position management | Outbound | REST (via HRIS read API) | Sync, cached | As above | Talent Acquisition | As above |
| Kafka `employee.transfer.v1` | Outbound | Kafka | Async | Outbox retains and retries; submission unaffected | Portal | Event schema registry |
| Payroll consumer | Inbound to Payroll | Kafka | Async | Consumer lag only; no portal impact | Finance Systems | Not yet built |
| ITSM consumer | Inbound to ITSM | Kafka → ticket | Async | Not yet built; manual in v1 | IT Service Management | Not yet built |
| Facilities consumer | Inbound to Facilities | Kafka | Async | Not yet built; manual in v1 | Facilities | Not yet built |
| Notification service | Outbound | Kafka | Async | Notification loss does not affect request state | Portal platform | Existing |

## Cross-Cutting Concerns

- **Authentication / authorisation:** the gateway validates the OIDC token; `employee-services`
  derives employee identity from the token subject only. A caller-supplied employee ID in a
  body, query or path is never trusted for authorisation. Resource ownership is enforced in
  the service on every read and write.
- **Logging and tracing:** structured JSON, correlation ID propagated from the gateway.
  Employee ID is permitted; PII as defined in the constitution is not, at any level. A
  redaction layer strips known sensitive field names before emission — a safety net, not a
  licence to log them.
- **Configuration and secrets:** AWS Secrets Manager at runtime; nothing sensitive in
  committed config.
- **Error handling:** RFC 7807 `application/problem+json` for every endpoint. Business rule
  violations return a machine-readable `violations` array carrying rule IDs, so the front
  end never re-implements rule text.
- **Idempotency:** every state-changing endpoint that a user can double-submit requires an
  `Idempotency-Key`; replays within 24 hours return the original response.
- **Caching:** HRIS reference data only, 15-minute TTL, explicitly versioned key prefixes.
  Nothing employee-specific and nothing authoritative is cached.

## Non-Functional Position

| Baseline (from `constitution.md`) | Current measured position | Source |
|---|---|---|
| p95 < 400 ms reads / < 700 ms writes | Not yet measured for the transfer journey | Gateway metrics |
| 99.9% availability | Portal at 99.94% trailing 90 days | Platform SLO dashboard |
| WCAG 2.1 AA | Portal design system components audited; new screens audited per feature | Accessibility audit |
| RPO 15 min / RTO 1 hr | Met | Platform DR test, 2026-07 |

## Decisions in Force

| ADR | Decision | Affects | Date |
|---|---|---|---|
| [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) | Downstream orchestration is event-driven via a transactional outbox, never a synchronous call in the request path | `internal-transfer` module, all future orchestrated journeys | 2026-08-28 |
| [ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md) | The portal owns the transfer request aggregate; the HRIS remains system of record for employment and org data | `internal-transfer` module, HRIS integration | 2026-08-28 |

## Known Constraints and Debt

| Item | Impact | Accepted by | Revisit when |
|---|---|---|---|
| Payroll, ITSM and Facilities consumers are not built | v1 emits events nobody consumes; those stages stay manual and are marked as such to the employee | Product; Architecture | `internal-transfer-downstream-orchestration` is specced |
| ITSM intake is ticket-based, not event-based | An adapter will be needed; event contract may need a synchronous shim | IT Service Management | Same |
| HRIS read API has no bulk position endpoint | Reference-data cache is warmed per org unit rather than wholesale | Architecture | If cache warm time exceeds the TTL |
| Approval SLA and delegation deferred (BRD-001 OQ-15, OQ-16) | Stalled approvals are chased manually by HR | HR Policy | After v1 usage data exists |
