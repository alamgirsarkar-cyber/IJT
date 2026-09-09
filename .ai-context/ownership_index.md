# Ownership index — shared facts

> Facts more than one spec depends on. A spec either **points here** or defines the fact
> locally. Silently redefining a shared fact in a second spec is a Gate 1 miss
> (`.agent/rules/governance.md` DoR).

**Maintained with** the spec that first recorded the fact. Later specs cite the row ID.

| ID | Fact | Owner spec | Cited by |
| --- | --- | --- | --- |
| OWN-01 | Token **subject** is the portal employee id (`employee_id`, `assigned_party_ref`). A caller-supplied employee id in body, query or path is never used for authorisation. | `internal-transfer-request` (AC13, AC20); architecture AuthN/AuthZ | approval-chain BR6/AC6; notifications BR5 |
| OWN-02 | Unauthorised access to another principal's request returns **404** `request-not-found`, not 403. | `internal-transfer-request` AC13 | approval-chain AC6 |
| OWN-03 | Current line manager acts on `MANAGER_RELEASE`; receiving manager on `MANAGER_ACCEPT`; order is release then accept then HR. | BRD-001 OQ-01, OQ-02 | request stage plan; approval-chain BR1 |
| OWN-04 | HR validation is authorised by IdP role `HR_BUSINESS_PARTNER`, not by a named assignee (v1). | BRD-001 BR13; approval-chain BR6 A2/A3 | notifications HR fan-out |
| OWN-05 | Transfer reason text is visible to the owning employee and HR Business Partner only — not to either manager. Never in logs, events or notification payloads. | BRD-001 OQ-12 / BRD AC16 | approval-chain BR5/AC7; notifications matrix |
| OWN-06 | Downstream fulfilment callbacks authenticate with HMAC, not an employee OIDC token. | BRD-001 BR14 | downstream AC8, AC11 |
| OWN-07 | Portal existing SSO/OIDC is reused. This programme does not add login, registration or identity administration. | BRD-001 KD-07 | all four transfer specs |
