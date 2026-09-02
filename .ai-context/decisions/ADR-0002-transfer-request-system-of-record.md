# ADR-0002: The portal owns the transfer request; the HRIS remains the system of record for employment data

## Status

**Accepted**

**Date:** 2026-08-28 · **Author:** Alamgir Sarkar · **Gate 1 sign-off:** _Pending — Abhijit Adhikary_
**Consulted functions:** HR Systems, HR Policy, Data Privacy, Product

## Related

- Plan: `.ai-context/plans/internal-transfer-request.plan.md`
- Answers: BRD-001 OQ-09 ("is the portal or the HRIS the system of record for the transfer
  request itself?")
- Related decision: [ADR-0001](ADR-0001-outbox-event-driven-transfer-orchestration.md)

## Context

An internal transfer request contains two kinds of data that are easy to conflate:

1. **The request** — what the employee asked for, when, why, who has acted on it, what stage
   it is at. This exists only because the portal exists. Before this journey, it existed as
   email.
2. **The employment facts** — the employee's department, location, position, grade, cost
   centre, service dates, employment status. These exist independently of any request, are
   used by payroll, compliance and statutory reporting, and are mastered in the HRIS.

The question is which system owns which, and it has to be answered before the data model is
written, because the answer determines whether the portal is allowed to write employment data
and whether the request survives if the HRIS is unavailable.

Two forces:

- HR Systems' position is that the HRIS is the authoritative record of employment and any
  second copy is a compliance and reconciliation risk. This is correct and non-negotiable.
- The portal cannot function as the employee's single view if the record of what they asked
  for lives in a system they cannot see, whose availability the portal does not control, and
  whose data model has no concept of an in-flight, not-yet-approved intention.

The HRIS has no representation of a *proposed* transfer that may never happen. Modelling one
inside it would mean either adding a custom object — HR Systems' change cadence is quarterly
— or writing speculative future-dated assignments, which would be visible to payroll and
statutory reporting as though they were real.

## Options Considered

| Option | Pros | Cons | Rejected because |
|---|---|---|---|
| HRIS owns the request as a custom object; the portal is a thin UI | Single record; no duplication; HR Systems own the whole thing | Quarterly change cadence blocks portal delivery; portal availability becomes HRIS availability; the HRIS has no in-flight-intention model; the employee's view depends on a system they cannot reach directly | Delivery cadence and availability coupling, and the model does not fit |
| Portal owns both the request **and** a mastered copy of employment data | Fully autonomous; no runtime HRIS dependency | Creates a second source of truth for regulated employment data; reconciliation and compliance risk; explicitly rejected by HR Systems | Compliance — a second master for employment data is not acceptable |
| **Portal owns the request; HRIS remains master for employment data; the portal reads and snapshots** | Clean ownership boundary; portal delivers on its own cadence; no second master; snapshots are honestly labelled as point-in-time copies | Snapshot can diverge from the HRIS between submit and effective date; two systems to look at when investigating | **Chosen** |
| Portal owns the request and reads employment data live on every access, never storing it | No divergence | Every status view becomes an HRIS call; view unavailable when the HRIS is; and the record of *what was true when the decision was made* is lost, which audit needs | Availability, and the loss of decision-time context |

## Decision

**The One-Point Employee Portal is the system of record for the transfer request aggregate** —
`transfer_request`, its stages, its audit trail and its outbox. The request's lifecycle,
state and history are authoritative in PostgreSQL and nowhere else.

**The HRIS remains the system of record for all employment and organisational data.** The
portal reads it and never writes to it. When a transfer completes, the HRIS is updated by its
own integration layer consuming the portal's events — the portal does not write the employee's
new assignment itself.

Where the portal stores employment data, it stores it explicitly as a **point-in-time
snapshot taken at submission**, not as a copy kept in sync:

- The snapshot is frozen at submit and never refreshed, so the record shows what was true
  when the decision was made. Audit needs this: a BR2 service-length decision has to remain
  explicable in two years, when the underlying dates may have been corrected.
- Snapshot fields are never presented as current employment data anywhere in the portal
  outside the context of the request they belong to.
- Eligibility (BR1, BR2, BR4) is evaluated against a **fresh, uncached** HRIS read at submit,
  never against the snapshot or a cache. Reference data for the dropdowns is cached because
  a 15-minute-old list of open positions is harmless; a 15-minute-old probation status is not.

## Consequences

**Positive:**
- Ownership is unambiguous, which is what makes the failure behaviour in the plan derivable
  rather than debatable: the request survives HRIS unavailability because the portal owns it;
  a submit is refused during HRIS unavailability because the portal does not own the facts
  eligibility depends on.
- No second master for regulated employment data; HR Systems' compliance position is intact.
- The portal delivers on its own cadence, with no dependency on the HRIS change calendar.
- The audit record explains itself years later, because it holds decision-time values.

**Negative / accepted trade-offs:**
- A snapshot can diverge from the HRIS between submission and effective date — for example if
  the employee's position is corrected mid-flight. Accepted: HR revalidates at the HR
  validation stage, which is where a human is looking anyway. The divergence is visible
  rather than hidden, because both values exist.
- Investigating a transfer means looking at two systems.
- The portal is unavailable *for new submissions* when the HRIS is down, by design (AC15).
  Accepted in preference to submitting requests whose eligibility was never evaluated.

**Does not solve:**
- **What happens if the HRIS org update fails after all approvals have been given.** The
  request would be `FULFILMENT` with an HRIS that never changed. Detection and compensation
  belong to `internal-transfer-downstream-orchestration`; this decision only establishes that
  the portal must not paper over it by writing to the HRIS itself.
- **Reconciliation reporting** between portal requests and realised HRIS assignments. Needed
  eventually; not built, and not owned by this decision.
- **Historical transfers that predate the portal.** They stay in the HRIS and in email; there
  is no backfill.

## Downstream Updates

- [x] `architecture.md` — Data Model states system-of-record per entity and references this ADR
- [ ] `constitution.md` — not warranted; the existing "the portal never writes to the HRIS as
      its system of record for employment data" rule already covers the general case, and this
      ADR is the specific reasoning behind it
- [x] Affected specs notified: `internal-transfer-request` (snapshots),
      `internal-transfer-downstream-orchestration` (owns the HRIS update path, not yet started)
