# State tracking

How `.ai-context/state/completed.md` is kept.

- **Append only.** A new Gate 2 verdict, or a re-review, is a new dated line. Never edit or
  delete an earlier line.
- Spec-level board remains `.ai-context/status.md`. `completed.md` is the Gate 2
  write-back log required by `.agent/rules/governance.md`.
- One line per verdict. Format:

  ```
  - `<slug>` — Gate 2 reviewed by: Tapas Dutta, <YYYY-MM-DD>, <Approve|Reject|Changes requested> — <optional comment>
  ```

- Gate 1 verdicts are **not** recorded here. They go on the spec as `## Gate 1 Review`.
- Moving a feature to merged in `status.md` / `tasks.md` is allowed only after an Approve
  line exists here for that slug, and only the assigned Gate 2 reviewer may authorise that
  move (agent writes the files after the spoken verdict).
