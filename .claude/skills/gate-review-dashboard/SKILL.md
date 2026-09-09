---
name: gate-review-dashboard
description: >-
  Render the Gate 1 or Gate 2 Review Dashboard for Abhijit Adhikari or Tapas Dutta.
  Use when they choose Artifact, or when they ask for the review dashboard. Follow
  .agent/workflows/gate-review-dashboard.md and reuse
  gate-review-dashboard-design.html verbatim. Write-back only per
  .agent/rules/governance.md.
---

# Gate Review Dashboard

1. Read `.agent/rules/governance.md` § Reviewer self-identification.
2. Confirm gate and slug. Ask Artifact vs Manual if not already chosen.
3. Run `.agent/workflows/gate-review-dashboard.md` steps 1–5.
4. Do not restyle the HTML. Do not let the reviewer edit `.ai-context/` files.
5. After a spoken verdict, write it back exactly as `governance.md` step 3 specifies.
