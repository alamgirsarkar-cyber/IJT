# Architecture — One-Point Employee Portal

> The living system design. Updated whenever a plan introduces a new integration, datastore
> or significant decision. A stale `architecture.md` is worse than no doc, because the next
> agent session will believe it.

**Last updated:** 2026-09-02 · **Updated by:** Alamgir Sarkar · **Driven by:** stack simplification — SQLite and Express only (no Redis, no Kafka)

## Currency Check

| Question | Answer |
|---|---|
| Last plan reviewed that touched this file | `internal-transfer-request`, 2026-08-31 |
| Known-stale sections | Downstream fulfilment — webhook consumers are not yet built; v1 stores and relays outbox rows only |

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
                       │           employee-services               │  Node 20 / Express
                       │  ┌─────────────────────────────────────┐  │
                       │  │ internal-transfer module            │  │  routers · middleware
                       │  │  request aggregate · stage plan     │  │
                       │  │  eligibility rules · outbox         │  │
                       │  └─────────────────────────────────────┘  │
                       │  outbox relay worker (polls SQLite)       │
                       └───┬─────────────────────────┬─────────────┘
                           │                         │ HTTP webhooks (async)
                   ┌───────▼──────┐          ┌───────┴────────┬──────────┬────────────┐
                   │ SQLite       │          ▼                ▼          ▼            ▼
                   │ aggregates · │       Payroll          ITSM    Facilities  Notification
                   │ outbox ·     │       webhook          webhook  webhook     webhook
                   │ cache · idem │
                   └───────┬──────┘
                           │ read
                  ┌────────▼────────┐
                  │   HRIS read API │
                  │ employees, org, │
                  │ positions       │
                  └─────────────────┘
```

## Components

| Component | Responsibility | Owns | Tech | Notes |
|---|---|---|---|---|
| `employee-portal-web` | Employee-facing UI for every portal journey | No data | React 18, TS, Redux Toolkit | WCAG 2.1 AA mandatory |
| `employee-services` | Portal domain APIs and state machines | Portal request aggregates | Node 20, Express, TS | Modular monolith — new journeys are route modules, not services |
| `internal-transfer` module | Transfer request lifecycle, stage plan, eligibility evaluation | `transfer_request` and related tables | — | Introduced by `internal-transfer-request` |
| SQLite | System of record and auxiliary store | Aggregates, outbox, reference-data cache, idempotency, rate limits | SQLite 3 | Single approved datastore; forward-only migrations |
| Outbox relay | Delivers committed outbox rows to downstream webhook endpoints | Delivery attempts on outbox rows | Node worker | At-least-once; consumers must be idempotent |

## Data Model

| Entity | System of record | Key attributes | Retention | Notes |
|---|---|---|---|---|
| `transfer_request` | Portal | reference no, employee id, status, current and target assignment snapshot, requested effective date, reason (encrypted), version | 7 years | Reason text purged at 24 months (BRD-001 OQ-17) |
| `transfer_request_stage` | Portal | stage code, sequence, status, assigned role, assigned party ref, applicability, SLA due | With parent | Stage plan fixed at submission; SLA field captured but unused in v1 |
| `transfer_request_audit` | Portal | actor id, actor role, event, from/to status, occurred at, correlation id, metadata | 7 years, immutable | Append-only; no PII in metadata |
| `transfer_request_outbox` | Portal | aggregate id, event type, payload, published at, attempts | 30 days after publish | Committed in the same transaction as the state change |
| `reference_data_cache` | Portal | cache key, payload, fetched at, expires at | TTL-driven | HRIS reference data only; served stale past TTL |
| `idempotency_record` | Portal | employee id hash, idempotency key, response body, expires at | 24 hours | Submit and other double-submit endpoints |
| `rate_limit_counter` | Portal | endpoint, employee id hash, window start, count | Window length | Rate limits per AC17 |
| Employee, org unit, position | **HRIS** | — | — | Portal reads only; snapshots are copies, not masters ([ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md)) |

### Schema changes in force

| Change | Introduced by | Migration | Date |
|---|---|---|---|
| `transfer_request`, `_stage`, `_audit`, `_outbox` and auxiliary tables | `internal-transfer-request` T01 | Forward-only, additive; no existing table altered | Pending |

## Integration Points

| Integration | Direction | Protocol | Sync/Async | Failure mode | Owner | Contract |
|---|---|---|---|---|---|---|
| Corporate IdP | Inbound | OIDC | Sync | Gateway rejects; portal unaffected | Security Engineering | Platform standard |
| HRIS read API | Outbound | REST | Sync, cached in SQLite | Cache serves stale within TTL; 503 if cache empty and HRIS down | HR Systems | `docs/contracts/hris-read-api.md` |
| Position management | Outbound | REST (via HRIS read API) | Sync, cached | As above | Talent Acquisition | As above |
| Downstream webhooks `employee.transfer.v1` | Outbound | HTTPS POST via outbox relay | Async | Outbox retains and retries; submission unaffected | Portal | `docs/contracts/` event schemas |
| Payroll endpoint | Inbound to Payroll | HTTPS webhook | Async | Consumer lag only; no portal impact | Finance Systems | Not yet built |
| ITSM endpoint | Inbound to ITSM | HTTPS webhook → ticket | Async | Not yet built; manual in v1 | IT Service Management | Not yet built |
| Facilities endpoint | Inbound to Facilities | HTTPS webhook | Async | Not yet built; manual in v1 | Facilities | Not yet built |
| Notification service | Outbound | HTTPS webhook | Async | Notification loss does not affect request state | Portal platform | Existing |

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
  `Idempotency-Key`; replays within 24 hours return the original response (stored in SQLite).
- **Caching:** HRIS reference data only, 15-minute TTL, stored in `reference_data_cache`.
  Nothing employee-specific and nothing authoritative is cached outside SQLite.

## Non-Functional Position

| Baseline (from `constitution.md`) | Current measured position | Source |
|---|---|---|
| p95 < 400 ms reads / < 700 ms writes | Not yet measured for the transfer journey | Gateway metrics |
| 99.9% availability | Portal at 99.94% trailing 90 days | Platform SLO dashboard |
| WCAG 2.1 AA | Portal design system components audited; new screens audited per feature | Accessibility audit |
| RPO 15 min / RTO 1 hr | Met via SQLite file backup and restore | Platform DR test, 2026-07 |

## Decisions in Force

| ADR | Decision | Affects | Date |
|---|---|---|---|
| [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) | Downstream orchestration is async via a SQLite transactional outbox and webhook relay — never a synchronous call in the request path | `internal-transfer` module, all future orchestrated journeys | 2026-08-28 |
| [ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md) | The portal owns the transfer request aggregate; the HRIS remains system of record for employment and org data | `internal-transfer` module, HRIS integration | 2026-08-28 |

## Known Constraints and Debt

| Item | Impact | Accepted by | Revisit when |
|---|---|---|---|
| Payroll, ITSM and Facilities webhook consumers are not built | v1 defines the contract in `internal-transfer-downstream-orchestration` (Draft); consumers are still their backlog. Until they exist, fulfilment stages stay `IN_PROGRESS` | Product; Architecture | Consumers exist |
| ITSM intake is ticket-based, not webhook-based | An adapter will be needed | IT Service Management | Same |
| HRIS read API has no bulk position endpoint | Reference-data cache is warmed per org unit rather than wholesale | Architecture | If cache warm time exceeds the TTL |
| Approval SLA and delegation deferred (BRD-001 OQ-15, OQ-16) | Stalled approvals are chased manually by HR | HR Policy | After v1 usage data exists |
