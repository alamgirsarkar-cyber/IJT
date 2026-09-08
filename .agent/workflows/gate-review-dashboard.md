# Workflow: Gate Review Dashboard

> Used when Abhijit Adhikari (Gate 1) or Tapas Dutta (Gate 2) is reviewing. Canonical
> roles, Artifact vs Manual choice, and write-back live in `.agent/rules/governance.md`.
> This file is the scan and render procedure only.

**Slug** means the feature under review, e.g. `internal-transfer-request`.
**Paths** are under `.ai-context/` as mapped in `governance.md`.

## Four buckets

Every case lands in exactly one bucket. Do not invent a fifth.

| # | Bucket | Gate 1 looks at | Gate 2 looks at |
| --- | --- | --- | --- |
| 1 | Spec contract | Intent, AC, API contract, edges, errors, out of scope | Each AC by ID against the diff |
| 2 | Constitution & security | Silence or conflict with `constitution.md`; AuthN/AuthZ; PII | Same, plus the diff (logs, secrets, rate limits) |
| 3 | Plan & sequencing | Architecture approach, data model, sequencing, deferrals | Diff matches the Gate-1-approved plan; nothing deferred was built |
| 4 | Tests & traceability | Spec-derived UTs exist per AC; open questions listed | Tests existed first (Red then Green); `tasks.md` complete |

## Step 1 — Identify slug and gate

Confirm with the reviewer. Do not infer. Load only:

- `.ai-context/specs/<slug>.spec.md`
- `.ai-context/plans/<slug>.plan.md` (required for Gate 1 DoD; required for Gate 2)
- `.ai-context/constitution.md`
- `.ai-context/ownership_index.md`
- `.ai-context/BRD.md` (linked entry only)
- Related / Builds-on specs named in Context
- For Gate 2: the diff, `.ai-context/tasks/<slug>.tasks.md`,
  `.ai-context/reviews/<slug>.gate2.md` if present

## Step 2 — Scan (identical for Artifact and Manual)

Walk each bucket. For every finding or pass, record:

- Bucket number and name
- Source path and section heading (not a paraphrase of the section)
- Severity if a finding: Blocker / Should-fix / Nit
- Whether DoR for this gate is met

Do **not** rewrite the spec or plan during the scan.

## Step 3 — Build the case list

One card per AC, plus one card per API endpoint, plus one card per constitution section
the plan must not be silent on, plus one card for sequencing, plus one card for the
spec-derived unit-test table. Cards cite real headings from the slug's files.

Manual path **stops here**: reply with slug, gate, bucket list, and file paths. Do not
summarise the spec.

## Step 4 — Artifact cards (Artifact path only)

Every card includes the slug's **full real text** for that section — paste the
Acceptance Criteria, API Contract (including exception tables), error handling,
unit test cases, Architecture Approach, Sequencing, Explicitly Deferred, and any
AuthN/AuthZ section in full. Never a summarised subset.

## Step 5 — Render

1. Copy `.agent/workflows/gate-review-dashboard-design.html` as the page.
2. Fill `#gate`, `#slug`, `#reviewer`, `#generated` and the four bucket `<section>`s.
   Keep that file's CSS, layout, and `copyCard` script **verbatim**. Do not restyle.
3. Write the filled page to
   `.ai-context/reviews/<slug>.gate<1|2>-dashboard.html`.
4. Tell the reviewer the path to open in a browser. If the current tool can publish a
   shareable link, publish the same HTML; do not invent a different layout for that
   channel.
5. Wait for a spoken/chat verdict: Approve / Reject / Changes requested, optional comment.
6. Write back per `governance.md` step 3. The reviewer does not edit `.ai-context/` files.

## Card markup (paste into a bucket; keep classes)

```html
<article class="card">
  <div class="card-head">
    <h3>{{CASE_ID}} — {{HEADING}}</h3>
    <div>
      <span class="sev pass">Pass</span>
      <button type="button" class="copy" onclick="copyCard(this)">Copy</button>
    </div>
  </div>
  <p class="source">{{PATH}} — {{SECTION}}</p>
  <pre>{{FULL SECTION TEXT — not a summary}}</pre>
</article>
```

Severity class is one of: `blocker`, `should`, `nit`, `pass`.

