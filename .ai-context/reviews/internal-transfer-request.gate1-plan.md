# Gate 1 (continued) — Plan Review: `internal-transfer-request`

> Every plan is checked against `constitution.md` before task generation. A plan that
> violates a non-negotiable is a Gate 1 rejection, not a Gate 2 comment.

## Review Record

| Field | Value |
|---|---|
| Plan under review | `.ai-context/plans/internal-transfer-request.plan.md` |
| Derived from | `internal-transfer-request.spec.md` v1.1 (Approved) |
| Author | Alamgir Sarkar |
| **Reviewer (not the author)** | Abhijit Adhikary |
| Architecture / Security constitution check | Covered in Gate 1 by Abhijit Adhikary |
| Submitted | 2026-08-31 10:15 |
| Outcome round 1 | **Changes Requested** — 3 Blockers, 2 Should-fix |
| Revised and approved | 2026-08-31 16:50 |

---

## Findings

### P1 — Blocker — Security posture, event payloads

**Finding:** the draft plan built the outbox payload by serialising the request aggregate and
removing the reason field. That makes AC16 true on the day it is written and false the first
time someone adds a column. The spec's guarantee is that reason text never reaches an event;
a deny-list implementation cannot hold that guarantee over time.

**Required change:** build the payload from an explicit allow-list mapper that names every
field it emits.

**Resolution:** plan revised — payloads are constructed by a mapper listing emitted fields;
the field list is stated in the plan's Integration Points section, and UT46 asserts against
the emitted payload rather than against the mapper's implementation.

---

### P2 — Blocker — Correctness under concurrency, BR3

**Finding:** the draft plan enforced "one active request per employee" with a read-then-write
check in the service. AC8 explicitly requires that two concurrent creates result in exactly
one request. A read-then-write check cannot guarantee that, and the generated test would pass
because it would exercise the two calls sequentially — the failure would first appear in
production, as a duplicate request, and would look like a UI double-submit rather than a
missing constraint.

**Required change:** enforce BR3 in the database.

**Resolution:** partial unique index `uniq_active_request_per_employee` on `employee_id`
filtered to non-terminal statuses; the service maps the constraint violation to a 409 rather
than surfacing a database error. UT23 rewritten to fire genuinely concurrent requests.

---

### P3 — Blocker — Audit immutability

**Finding:** AC18 requires that no code path can update or delete an audit record. The draft
plan achieved this by "the repository exposes only an insert method," which is a convention a
future engineer can undo in one line without realising what it was protecting.

**Required change:** make it a database guarantee.

**Resolution:** `REVOKE UPDATE, DELETE` on `transfer_request_audit` from the application role,
applied in the migration. UT52 asserts the rejection comes from the database.

---

### P4 — Should-fix — Failure handling, Redis

**Finding:** the plan named Redis for three distinct purposes — cache, idempotency, rate
limiting — and said nothing about behaviour when Redis is unavailable. The three want
*different* answers, and leaving it unstated means the implementation gets one answer applied
to all three, most likely "fail open," which on the idempotency store means a duplicate
submitted transfer.

**Required change:** state the behaviour per purpose.

**Resolution:** row added to Failure and Boundary Handling — reference data falls through to
the HRIS; rate limiting fails closed on submit and open on reads; idempotency fails closed,
so a submit without a working idempotency store is refused rather than risking a duplicate.

---

### P5 — Should-fix — Architecture, justify the asymmetry

**Finding:** the plan caches reference data but reads employment data uncached, without
saying why. A later engineer looking to shave latency off submit would see an obvious
optimisation and take it, reintroducing the risk of evaluating eligibility against a stale
probation or resignation status.

**Required change:** write the reasoning into the plan, not just the code.

**Resolution:** stated in Architecture Approach and reinforced in
[ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md) — a 15-minute-old list
of open positions is harmless; a 15-minute-old probation status is not.

---

## Constitution Check — reviewer's verification

Each line of the plan's Constitution Check was verified independently rather than accepted as
ticked.

| Rule | Plan's claim | Reviewer's verification |
|---|---|---|
| No new datastore or service without an ADR | None introduced | Confirmed — new tables in an approved store; Redis used only in its approved roles, nothing authoritative |
| Testing discipline | Jest, Supertest, Testcontainers, RTL, Playwright; 85% floor | Confirmed; the real-PostgreSQL requirement matters here because P2 and P3 are database guarantees an in-memory substitute would not exercise |
| Security posture | Encryption, allow-list payloads, log redaction, token-derived authorisation | Confirmed after P1 was fixed |
| Rate-limit decision per endpoint | Seven endpoints, seven decisions | Confirmed against the spec's API Contract; the autosave reasoning on API02 is sound |
| Non-functional baselines | One uncached HRIS read in the submit path | Accepted, to be measured in SIT before release rather than asserted now |
| Versioning rules | Additive migration, `/api/v1/`, `.v1` event schemas | Confirmed rolling-deploy safe — no existing table altered |
| Accessibility | Task-level condition on T10 | Confirmed it is an acceptance condition, not a follow-up ticket |
| Audit | Append-only | Confirmed after P3 was fixed |

## ADR Assessment

The reviewer independently applied the day-of-rework test to each decision in the plan rather
than accepting the author's classification:

- **Outbox orchestration** — agreed significant. [ADR-0001](../decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md).
- **Request ownership vs the HRIS** — agreed significant, and it crosses an organisational
  boundary, which is a second reason to write it down. [ADR-0002](../decisions/ADR-0002-transfer-request-system-of-record.md).
- **Rules in code rather than a rules engine** — agreed not significant. Nine functions behind
  an interface; introducing an engine later is contained.
- **Optimistic concurrency on drafts** — agreed not significant; one endpoint.
- **Uncached eligibility reads** — the reviewer initially argued for an ADR. Settled as a
  plan-level decision because reversing it is a configuration change, but the *reasoning* had
  to be written down (P5). The distinction that mattered was cost-to-reverse, not
  importance — an important decision that is cheap to reverse still does not need an ADR.

## Deferred Items — carried to Gate 2

The reviewer records these so Gate 2 can check that implementation did not creep into them:

- No approval or stage-transition logic beyond creating stage rows
- No notification of any kind, including a confirmation message on submit
- Nothing writes `confirmed_effective_date`
- Nothing writes `sla_due_at`
- No delegation resolution
- No reason-text purge job

**Outcome: Approved.** Task generation authorised.
