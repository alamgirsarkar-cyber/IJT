# Rule: Auto-Log

> The instruction that makes the audit trail exist without depending on an engineer
> remembering to write it. Always on, every session.

## Instruction to the agent

After completing any task from `.ai-context/tasks/<slug>.tasks.md` — whether the outcome
was accepted, edited or rejected — append an entry to `.ai-context/prompt_history.md`
using the format defined at the top of that file, then stop and report what you appended.

Append. Never rewrite, reorder, summarise, or delete existing entries.

## Every entry records

| Field | Rule |
|---|---|
| Timestamp | Local date and time the task completed |
| Engineer | The human who ran the session — the accountable owner |
| Model | Model and version used |
| Task | The task ID, e.g. `<slug>.T03`, plus its title |
| Satisfies | The AC and API IDs the task claims to satisfy |
| Context supplied | The specific files tagged in — never "the repository" |
| Workflow used | The `.agent/workflows/` template, or "freehand" with a reason |
| Prompt | What was asked, referenced by identifier |
| Outcome | Accepted / Accepted with edits / Rejected and re-specced |
| Review notes | What the engineer corrected by hand, what the agent missed |
| Follow-up | Spec revision, ADR candidate, new task — or "none" |

## Redaction rules — no exceptions

Never write into `prompt_history.md`:

- Secrets, credentials, tokens, connection strings, private keys
- PII as defined in `.ai-context/constitution.md`
- Client-confidential data, real customer records, production identifiers

If a prompt contained any of the above, log the entry with the value replaced by
`<redacted: reason>` and raise it — a secret reaching a prompt is an incident, and the
log entry is not the place to preserve the evidence verbatim.

## What this rule is not

It is not a substitute for `.ai-context/status.md`. That file is the human-curated,
same-day delivery summary. This one is the machine-appended session trail. Both exist;
neither replaces the other.

## Also update, same day

- `.ai-context/tasks/<slug>.tasks.md` — task checkbox state
- `.ai-context/status.md` — Active Specs row and Daily Execution Log
