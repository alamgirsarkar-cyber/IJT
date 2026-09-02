# ADR-0001: Event-driven downstream orchestration via a transactional outbox

## Status

**Accepted**

**Date:** 2026-08-28 · **Author:** Alamgir Sarkar · **Gate 1 sign-off:** _Pending — Abhijit Adhikary_
**Consulted functions:** Security, Finance Systems, IT Service Management, Facilities

## Related

- Plan: `.ai-context/plans/internal-transfer-request.plan.md`
- Answers: BRD-001 OQ-10 ("are downstream systems called synchronously or event-driven?")
- Supersedes: nothing
- Constrains: `internal-transfer-downstream-orchestration`, and every future portal journey
  that fans out to back-office functions

## Context

The internal transfer journey ends in work carried out by four organisations the portal does
not own — HR Operations updating the HRIS, Payroll updating a payroll assignment, IT changing
access, Facilities arranging a workplace. Two forces pull in opposite directions:

1. **The employee must see one journey** (BRD-001 KD-04, KD-05). Something has to track
   whether each downstream step has happened.
2. **None of those four systems is under portal control or portal SLA.** Their availability,
   latency and change cadence are independent. Payroll's event consumer does not exist yet;
   ITSM's intake is ticket-based; Facilities has the lowest digital maturity of the four and
   may stay partly manual for some time.

A synchronous approach — the submit request calling each downstream system in turn — makes
the portal's availability the product of four other systems' availability, puts a
multi-second worst case into a request path with a 700 ms p95 budget, and creates a partial-
failure problem with no clean answer: if Payroll succeeds and IT times out, the request is in
a state the data model cannot honestly represent.

Publishing events from application code *after* the database commit has a subtler failure: a
crash between the commit and the publish leaves a submitted request no downstream system ever
hears about. That failure is silent, rare, and only discovered when an employee asks why
nothing happened — the worst possible combination for a journey whose entire value
proposition is visibility.

The constitution requires async cross-domain integration and forbids synchronous calls from
a request path into these systems. What it did not state, and what this decision adds, is
*how* the event gets published and delivered without a message broker.

## Options Considered

| Option | Pros | Cons | Rejected because |
|---|---|---|---|
| Synchronous calls to each downstream system inside the submit request | Simplest to reason about; immediate confirmation | Portal availability becomes the product of four dependencies; latency budget blown; partial failure unrepresentable; violates the constitution | Availability and latency, before the constitution is even considered |
| Publish directly to a downstream webhook from application code after commit | Simple; no extra table | Dual-write problem — a crash between commit and publish silently loses the event, with no way to detect it later | Silent, undetectable data loss on the journey's critical path |
| Publish to a downstream webhook first, then commit | Removes the lost-event case | Introduces the opposite one: downstream acts on a transfer that does not exist | Worse than the problem it solves |
| **Transactional outbox — write the state change and an outbox row in one transaction; a relay POSTs to webhooks** | State change and intent to publish are atomic; the relay can crash and resume; unpublished rows are queryable and alertable | One more table; one more moving part; at-least-once delivery pushes idempotency onto consumers | **Chosen** |
| Change data capture from the WAL instead of an outbox table | No application-side outbox logic | New infrastructure component to run and operate; couples event schemas to table schemas, which is precisely what we do not want given the field-level encryption and the payload allow-list | Operational cost and schema coupling not justified at this scale |

## Decision

Downstream orchestration is **event-driven**. A state change that downstream systems care
about writes an `transfer_request_outbox` row **in the same database transaction** as the
state change itself. A separate relay process polls unpublished rows, POSTs them to the
configured downstream HTTPS webhook endpoints, and marks them published.

Consequences of that choice which are themselves part of the decision:

- **Delivery is at-least-once.** A crash between publishing and marking published republishes.
  Consumers must be idempotent, keyed on `requestId` plus event type. This is stated in the
  event contract, not left for each consuming team to discover.
- **Event payloads are built by an explicit allow-list mapper**, never by serialising the
  aggregate. A future column cannot leak into an event by default — which is what keeps
  AC16's exclusion of reason text true over time rather than only on the day it was written.
- **Unpublished outbox age is a monitored signal**, alerting at 15 minutes. The failure mode
  this design cannot prevent — the relay being down — is therefore visible rather than silent.
- **No request path may call Payroll, ITSM or Facilities synchronously**, now or later,
  including "just to check status."

## Consequences

**Positive:**
- Submission latency is bounded by the portal's own database and one HRIS read; it is
  unaffected by any downstream system's health. Measured at the gateway against the 700 ms
  p95 budget.
- A submitted transfer is never lost. If the relay is down, events are late and the lateness
  is alerted on; the request itself is correct and durable.
- Downstream teams integrate on their own timeline. v1 can ship with zero consumers built,
  which is exactly the position we are in, without that being a hidden compromise.
- The same pattern is reusable by every future orchestrated journey in the portal, which is
  why the constitution was amended to require it generally rather than leaving it as a
  feature-local choice.

**Negative / accepted trade-offs:**
- The employee sees eventual, not immediate, downstream progress. Accepted by Product: the
  stages take days in the real world, so seconds of propagation are immaterial.
- Every consumer carries idempotency logic it would not need under exactly-once delivery.
  Accepted — it is a well-understood cost and the alternative does not exist in practice.
- One additional table and one additional process to operate.
- Delivery order is best-effort per relay poll; consumers deduplicate on `requestId` plus event type.

**Does not solve:**
- **A downstream system that consumes an event and then fails to act on it.** The portal will
  believe the message was delivered. Detecting that requires completion events back from each
  consumer, which is `internal-transfer-downstream-orchestration`'s problem, not this one.
- **Compensation.** If IT provisions access and HR then cancels the transfer, nothing here
  reverses it. Compensation is deferred to the downstream orchestration spec.
- **ITSM's ticket-based intake.** An adapter is still needed; this decision only guarantees
  the event reaches whatever adapter is built.
- **Consumers that are not built.** v1 emits events nobody consumes. That is recorded as
  known debt in `architecture.md`, not solved here.

## Downstream Updates

- [x] `architecture.md` — Integration Points and Decisions in Force reference this ADR
- [x] `constitution.md` — Architectural Constraints gained "events are published through a
      transactional outbox, never directly from application code inside a request," so the
      rule is inherited by every future spec rather than rediscovered
- [x] Affected specs notified: `internal-transfer-request` (emits),
      `internal-transfer-downstream-orchestration` (consumes, not yet started)
