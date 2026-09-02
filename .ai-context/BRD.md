# Business Requirements — One-Point Employee Portal

> Where a requirement is **first** written down. A spec is never the first place a
> requirement appears. Discovery closes out here: business need confirmed, decided vs.
> open separated, sign-off obtained from whoever owns the decision — *before* spec
> drafting starts.
>
> Discovery is a gate, not a formality. If "what problem, for whom, bounded how" does
> not fit in one paragraph, the spec is not ready to write.

## Index

| BRD ID | Title | Priority | Sponsor | Status | Spec slug |
|---|---|---|---|---|---|
| BRD-001 | Employee Internal Transfer Digital Journey | High | HR | Spec Drafting | `internal-transfer-request` (v1), see spec map |

---

## BRD-001: Employee Internal Transfer Digital Journey

**Raised by:** HR Operations (from the assessment brief). Trigger: internal
transfer cycle time and the volume of coordination email between employees, managers, HR,
Payroll, IT and Facilities.

**Business need:** An employee who wants to move internally today has to drive the process
themselves across several teams and systems — talk to the manager, chase HR for
eligibility, then wait without visibility while organisational data, payroll, IT access and
workplace arrangements are handled by different functions with no shared record. The need
is not "a transfer form." It is a **single digital journey with a single view of progress**,
and an auditable record of who decided what and when.

**Business objective:**

| Objective | Measured by |
|---|---|
| Reduce end-to-end internal transfer cycle time | Median days from submission to effective date |
| Remove manual coordination between functions | Volume of transfer-related email/tickets outside the portal |
| Give the employee visibility without chasing | % of requests where the employee raised a "where is my transfer" query |
| Produce an auditable transfer record | % of completed transfers with a complete, immutable stage history |

**Sponsor:** HR (outcome); One-Point Employee Portal (delivery)
**Priority:** High
**Target:** v1 into production within the current programme increment

### Primary users

| User | Role in the journey | Primary need |
|---|---|---|
| Employee | Initiates the request, tracks it | Submit once, see where it is, know who it is with |
| Line manager (current) | Confirms release of the employee | Clear ask, enough context to decide |
| Receiving manager (target) | Accepts the employee into the target role | Confirm the role and start date are real |
| HR Business Partner | Validates eligibility and policy | Rules applied consistently, exceptions visible |
| Payroll analyst | Updates payroll assignment | Correct effective date, no rework |
| IT service desk | Provisions/removes access | Knows what changed and when it takes effect |
| Facilities coordinator | Arranges the new location | Location and date, only when location actually changes |
| HR Operations / Audit | Oversees the process | Complete, immutable record per request |

### Journey stages (as-is understanding, confirmed with HR Ops)

1. **Initiation** — employee proposes department/business unit, location, role, effective date, optional reason.
2. **Manager confirmation** — the manager confirms the transfer.
3. **HR eligibility validation** — HR validates the employee against transfer policy.
4. **Organisational data update** — the employee's org assignment is updated in the HRIS.
5. **Payroll update** — payroll assignment updated, *where applicable*.
6. **IT access change** — access provisioned or removed, *where applicable*.
7. **Facilities arrangement** — workplace/seating arranged, *where applicable*.
8. **Confirmation** — employee is told the transfer is complete.

Stages 5–7 are conditional in the as-is process, and the conditions are not written down
anywhere. See OQ-08.

### Known decisions (given — not reopened during spec drafting)

| # | Decision | Type |
|---|---|---|
| KD-01 | The journey is delivered through the One-Point Employee Portal as a single digital journey | Business |
| KD-02 | The request is **employee-initiated** | Business |
| KD-03 | The employee captures: target department/business unit, target location, target role/position, effective date, optional reason | Business |
| KD-04 | The portal **orchestrates** downstream activities rather than the employee chasing each function | Business |
| KD-05 | The employee can view current status and which actions are pending with which stakeholders | Business |
| KD-06 | The transfer touches HRIS, Payroll, IT and Facilities as downstream consumers | Business |

### Open questions

> These are the questions the brief does not answer. Each has an owner and a decision
> type. **A spec must not resolve a business question by guessing** — items marked
> Business are answered by the owner or deferred out of v1 explicitly.

| # | Question | Type | Owner | Status / Resolution |
|---|---|---|---|---|
| OQ-01 | "Manager confirms the transfer" — *which* manager? The current line manager releasing the employee, the receiving manager accepting them, or both? In what order? | **Business** | HR Ops + Product | **Resolved 2026-08-26:** both, sequentially — current line manager first (release), then receiving manager (accept). Modelled as two stages. Out of scope for v1 spec; owned by `internal-transfer-approval-chain`. |
| OQ-02 | Does HR validation run before or after manager confirmation, or in parallel? | **Business** | HR Ops | **Resolved 2026-08-26:** after both manager stages. HR validates last so it does not spend effort on transfers the managers will decline. |
| OQ-03 | What exactly are the eligibility rules? Probation, minimum tenure in role, notice period, open disciplinary cases? | **Business** | HR Policy | **Partially resolved** — see Business Rules table. Disciplinary-case check deferred (OQ-04). |
| OQ-04 | Can the portal read disciplinary/PIP status to gate eligibility automatically? | Business + Technical | HR Policy + Security | **Deferred out of v1:** HR will not expose case data to the portal. HR validates this manually at the HR stage. The portal must not imply it has checked. |
| OQ-05 | Is the effective date the employee provides a **request** or a **commitment**? Who can change it, and at which stage? | **Business** | HR Ops | **Resolved 2026-08-26:** it is a *requested* date. The *confirmed* date is set at HR validation. The portal must label it as requested until confirmed. |
| OQ-06 | Can the employee withdraw after submitting? Until which stage? | **Business** | HR Ops | **Resolved 2026-08-27:** yes, until organisational data update begins. After that, cancellation is an HR action, not an employee action. |
| OQ-07 | On rejection — is the request terminal, or returned to the employee for edit and resubmission? | **Business** | HR Ops | **Resolved 2026-08-27:** terminal for v1. The employee raises a new request. Return-for-edit deferred to a later spec. |
| OQ-08 | Are Payroll / IT / Facilities always triggered, or conditionally? What determines it? | **Business** rule, technically implemented | HR Ops + Payroll + IT + Facilities | **Resolved 2026-08-27:** conditional — Payroll when cost centre or grade changes; IT when department changes; Facilities when location changes. Owned by `internal-transfer-downstream-orchestration`. v1 records stage applicability at submission. |
| OQ-09 | Is the portal or the HRIS the system of record for the transfer request itself? | **Technical** | Architecture | **Resolved 2026-08-28:** portal owns the *request*; HRIS remains system of record for *employment and org data*. See [ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md). |
| OQ-10 | Are downstream systems called synchronously, or event-driven with confirmation back? | **Technical** | Architecture | **Resolved 2026-08-28:** event-driven via the existing Kafka estate, with a transactional outbox. See [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md). |
| OQ-11 | In "pending with", does the employee see a named person or only a role? | **Business** (privacy) | HR Ops + Data Privacy | **Proposed in spec v1.1 (AC11) — pending Gate 1 / business owner confirmation:** named person only where that person is the employee's own line manager. All other stages show role only. |
| OQ-12 | Who can read the free-text **reason**? It may name a manager or describe a grievance. | **Business** (privacy) | Data Privacy + HR | **Proposed in spec v1.1 (AC16) — pending Gate 1 / business owner confirmation:** visible to HR Business Partner and the employee only. **Not** visible to either manager. Encrypted at rest, never logged, never in analytics extracts without aggregation. |
| OQ-13 | Can an employee hold more than one active transfer request? | **Business** | HR Ops | **Resolved 2026-08-26:** no. One non-terminal request per employee. |
| OQ-14 | Where do department / location / role options come from, and who governs what an employee may select? | Business ownership, **Technical** delivery | HRIS Data Owner + Architecture | **Resolved 2026-08-27:** from HRIS org master and position management, read-only, cached. Only positions flagged open and internally fillable are selectable. |
| OQ-15 | Is there an SLA per approval stage, with escalation? | **Business** | HR Ops | **Deferred out of v1.** Stage SLA fields are captured in the data model so escalation can be added without migration, but no escalation behaviour is built. |
| OQ-16 | Is manager delegation supported when an approver is on leave? | **Business** | HR Ops | **Deferred out of v1.** Raised as a known gap; HR handles manually. |
| OQ-17 | Retention period for transfer requests, including declined ones and reason text? | **Business** (compliance) | Data Privacy | **Resolved 2026-08-28:** 7 years for the request record; reason text purged at 24 months. |
| OQ-18 | Accessibility and localisation obligations? | **Business** | Product | **Resolved 2026-08-26:** WCAG 2.1 AA mandatory. Localisation deferred — English only for v1. |
| OQ-19 | Mobile app, or web portal only? | **Business** | Product | **Resolved 2026-08-26:** responsive web only for v1. |

### Business rules (confirmed with HR Policy, 2026-08-27)

| Rule ID | Rule | Type | Source |
|---|---|---|---|
| BR1 | The employee's employment status must be Active and confirmed — employees serving probation may not request a transfer | Business | HR Policy §4.1 |
| BR2 | The employee must have at least 12 months continuous service in their current position, measured as at the requested effective date | Business | HR Policy §4.2 |
| BR3 | An employee may hold only one transfer request in a non-terminal state at a time | Business | OQ-13 |
| BR4 | An employee with an active resignation or exit process may not request a transfer | Business | HR Policy §4.4 |
| BR5 | The target must differ from the current assignment in at least one of department, location or position | Business | Derived — a no-op transfer is not a transfer |
| BR6 | Selectable target positions are limited to positions marked open and internally fillable in position management | Business, technically enforced | OQ-14 |
| BR7 | The requested effective date must be at least 14 calendar days ahead and no more than 180 days ahead | Business | HR Policy §4.6 (handover minimum) |
| BR8 | Effective dates that do not align to a payroll cycle boundary are permitted but flagged to the employee as likely to be moved by HR | Business | Payroll |
| BR9 | Open disciplinary or performance cases block a transfer — **validated manually by HR**, not by the portal | Business | OQ-04 |

### Business decisions vs technical decisions

> Deliberately separated. A business decision made by an engineer inside a spec is the
> failure mode this section exists to prevent; a technical decision escalated to a
> business owner wastes their time and gets rubber-stamped.

| Business decisions (owned by HR / Product / Data Privacy) | Technical decisions (owned by Engineering / Architecture) |
|---|---|
| Who approves, in what order (OQ-01, OQ-02) | Whether approvals are modelled as a state machine or a workflow engine |
| Eligibility rules BR1–BR9 and their thresholds | Whether rules are evaluated in code, in a rules table, or in a rules engine |
| Whether the effective date is requested or committed (OQ-05) | How the date is stored, validated and time-zone normalised |
| Withdrawal cut-off point (OQ-06) | How the cut-off is enforced concurrently and idempotently |
| Rejection is terminal (OQ-07) | How terminal states are enforced in the aggregate |
| Which downstream functions are involved and when (OQ-08) | Sync vs. async, outbox, retry and compensation ([ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md)) |
| Who may read the reason text (OQ-12) | Encryption at rest, field-level access control, log redaction |
| What "pending with" may disclose (OQ-11) | How the projection is built and cached |
| Retention periods (OQ-17) | Purge implementation and its scheduling |
| WCAG 2.1 AA obligation (OQ-18) | Component library, testing tooling, audit approach |
| That the portal is the employee's single view (KD-04, KD-05) | That the portal owns the request aggregate and the HRIS does not ([ADR-0002](decisions/ADR-0002-transfer-request-system-of-record.md)) |

### Assumptions

> Recorded because the brief does not state them. Each names what breaks if it is false.

| # | Assumption | If false |
|---|---|---|
| AS-01 | The One-Point Employee Portal already exists with SSO/OIDC authentication and an established API gateway; this journey is a new module within it, not a new product | Scope grows to include platform work not estimated here |
| AS-02 | A read API exists over the HRIS for employee master, org units and positions | T02 becomes an integration build, not a consumption task |
| AS-03 | The Kafka estate and the notification service used elsewhere in the portal are available for reuse | [ADR-0001](decisions/ADR-0001-outbox-event-driven-transfer-orchestration.md) is invalidated and orchestration must be redesigned |
| AS-04 | Payroll, ITSM and Facilities can consume events; each owns its own fulfilment and reports completion back | Downstream stages cannot be tracked and KD-05 is not deliverable |
| AS-05 | Employee ID is an internal pseudonymous identifier, not PII in itself — it is safe in logs and cache keys, unlike name, contact details or reason text | The logging and cache-key design in the plan needs revision |
| AS-06 | Stack is the portal's existing estate: Node.js/TypeScript services, React front end, PostgreSQL, Redis, Kafka | The constitution's approved-technology section changes and the plan is re-cut |

### Dependencies

| Dependency | Provides | Owner | Risk |
|---|---|---|---|
| HRIS | Employee master, employment status, service dates, org units, positions | HR Systems | Read availability at submission time; reference-data freshness |
| Position management | Open, internally fillable positions (BR6) | Talent Acquisition | Data quality — positions not kept current |
| Corporate IdP (OIDC) | Authentication, employee identity | Security Engineering | None expected — already in use |
| Payroll system | Payroll assignment update | Finance Systems | Event consumption not yet built (their backlog) |
| ITSM | Access provisioning/deprovisioning | IT Service Management | Their intake contract is ticket-based, not event-based |
| Facilities / workplace management | Seating and location arrangement | Facilities | Lowest digital maturity of the four — may stay manual in v1 |
| Notification service | Employee and approver notifications | Portal platform team | Reuse only |

### Out of scope for BRD-001

- Manager-initiated and HR-initiated transfers — only employee-initiated (KD-02)
- Promotions, grade changes and any compensation change approval
- International transfers, relocation, immigration or visa handling
- Contractor, intern and non-employee worker transfers
- Bulk transfers and organisational restructures
- Return-for-edit after rejection (OQ-07)
- Approval SLA escalation (OQ-15) and approver delegation (OQ-16)
- Automated disciplinary/performance gating (OQ-04, BR9)
- Localisation beyond English (OQ-18); native mobile applications (OQ-19)

### Spec map — how BRD-001 decomposes

> One feature, one spec. The full journey is a programme, not a spec. It is delivered as
> four specs with a strict dependency direction, so each is independently reviewable,
> buildable and releasable.

| Spec slug | Owns | Depends on | Status |
|---|---|---|---|
| `internal-transfer-request` | Employee-facing request: draft, validate, submit, withdraw, and the employee's view of status and pending actions. Owns the request aggregate and its stage plan. | — | **In Peer Review (Gate 1)** — Draft v1.1 |
| `internal-transfer-approval-chain` | Line manager release, receiving manager acceptance, HR eligibility validation; decisions and terminal rejection. Transitions stages this spec creates. | `internal-transfer-request` | Not started |
| `internal-transfer-downstream-orchestration` | Conditional fan-out to HRIS org update, Payroll, IT and Facilities; completion tracking and compensation on failure. | `internal-transfer-approval-chain` | Not started |
| `internal-transfer-notifications` | Notifications to employee and approvers on every state transition. | `internal-transfer-request` | Not started |

**Scoping note (recorded because a reviewer will ask):** status visibility is kept inside
`internal-transfer-request` rather than split into its own spec, because it reads the same
aggregate and the same API resource that spec already owns, and separating it would produce
a spec that cannot be demonstrated as a journey. The dependency direction is deliberate —
v1 creates the stage records at submission and renders them; the approval chain spec later
transitions them. That way `internal-transfer-request` depends on nothing unbuilt, which is
what allows it to pass the Gate 1 dependency check.

**Accountable functions** (no named signatories beyond the assessment participants):

| Function | Decision covered |
|---|---|
| Product | Scope, KD-01…KD-06, v1 boundary |
| HR Policy | BR1–BR9, OQ-03, OQ-05, OQ-06, OQ-07, OQ-13 |
| Data Privacy | OQ-11, OQ-12, OQ-17 |
| Architecture | OQ-09, OQ-10, OQ-14, AS-06 |
| Security | OQ-04 deferral, reason-text handling |

**Artefact owner:** Alamgir Sarkar
