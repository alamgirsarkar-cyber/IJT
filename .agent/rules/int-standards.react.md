# INT Standards — React / TypeScript

**Stack:** React 18, TypeScript 5, Redux Toolkit, RTK Query · **Applies to:** `employee-portal-web/**`
**Last updated:** 2026-09-01

## Always

- Read `.ai-context/constitution.md` first. WCAG 2.1 AA is a non-negotiable, not a
  nice-to-have, and an inaccessible screen is an incomplete screen.
- One task at a time from the feature's `tasks.md`, tests first.
- Reuse the portal design system. A new component means the design system was missing
  something, which is a conversation, not a decision to make inside a feature branch.
- Stop and ask if the spec does not say what a state should look like. Do not invent an empty
  state, an error message or a loading behaviour the spec never defined — that is a product
  decision arriving through the back door.

## Never

- Never add AI attribution to a comment or commit message.
- Never introduce a second state management library. Redux Toolkit only, per the constitution.
- Never put PII into `localStorage`, `sessionStorage`, a URL, an analytics event or a console
  statement — including free-text an employee wrote about themselves.
- Never convey meaning by colour alone.
- Never render user-supplied text as markup.

## Structure & Style

- `src/features/<feature-slug>/` containing `components/`, `hooks/`, `api/`, `model/`. Feature
  code does not import from another feature.
- Function components with hooks. No class components.
- Server state through RTK Query; client state through Redux Toolkit slices. Do not duplicate
  server state into a slice — a second copy is a second truth that goes stale.
- All copy externalised into resource files, even when only one locale ships. Retrofitting
  this later means touching every component.
- Props typed explicitly; no `any`; no non-null assertions.

## Accessibility — treated as functional requirement

- Every interactive element is reachable and operable by keyboard, with a visible focus
  indicator. Focus order matches visual order.
- Every input has a programmatically associated label. A placeholder is not a label.
- Validation errors are announced via a live region and associated with their field through
  `aria-describedby`. Focus moves to the first error on a failed submit.
- Status conveyed by an icon or colour also carries text.
- Automated `axe` checks run in CI **and** a manual keyboard and screen-reader pass is
  performed. Automation catches roughly half of what matters and none of what matters most.
- Respect `prefers-reduced-motion`.
- Target 360 px minimum width and 200% zoom without loss of function.

## Data Handling

- Never log or trace a form field's contents, including in development builds.
- Sensitive free text is submitted and forgotten by the client — not cached in a slice, not
  restored from storage, not included in an error report.
- Optimistic updates only where the server has an idempotent contract and a conflict has a
  defined resolution. Where the API uses `If-Match`, surface a real conflict to the user
  rather than silently overwriting their other tab.

## Testing

- React Testing Library, queried **by accessible role and name**, never by test ID. A
  component findable only by test ID is a component a screen reader cannot find either, so the
  query strategy is itself an accessibility check.
- Playwright for journey tests across the whole feature.
- No snapshot-only tests for logic-bearing components, per the constitution.
- Mock at the network boundary with MSW, using the spec's API contract shapes including its
  error responses — the error paths are what the component gets wrong.
- Test the loading, empty, error and stale states, not only the populated one.

## Performance Guardrails

- Memoise only where a measured problem exists. Reflexive `useMemo` adds noise and hides the
  real cost.
- Virtualise long lists; paginate rather than fetching everything.
- Lazy-load a feature route; a new journey must not enlarge the initial bundle for employees
  who never open it.
- Debounce autosave; never fire a request per keystroke.

## Definition of Done for a generated increment

- [ ] Tests written first, confirmed Red, now Green
- [ ] Keyboard-only pass completed
- [ ] Screen-reader pass completed
- [ ] `axe` clean — zero serious or critical
- [ ] Every state (loading, empty, error, stale, populated) implemented as specified
- [ ] No PII in storage, URLs, logs or analytics
- [ ] Copy externalised
- [ ] Nothing changed outside the task's scope
