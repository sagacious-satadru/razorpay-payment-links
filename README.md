# Payment Links manager

A small React app to create payment links, list them, filter by status and record (partial)
payments against them. There is no backend: a mock async API stores links in `localStorage`
(`payment-links:v1`), so they survive a page reload.

**Stack:** Vite 7, React 19, TypeScript (strict), Vitest + Testing Library, Playwright. No UI framework.

## Run it

- Install: `pnpm install && pnpm exec playwright install chromium`
- Run: `pnpm dev` (http://localhost:5173)
- Unit tests: `pnpm test`
- E2E: `pnpm e2e`

Also: `pnpm typecheck`, `pnpm lint`, `pnpm build`.

npm equivalents:

- Install: `npm install && npx playwright install chromium`
- Run: `npm run dev` (http://localhost:5173)
- Unit tests: `npm test`
- E2E: `npm run e2e`

## What it does

- **Create** a link: amount (INR, up to 2 decimals, > 0, max ₹5,00,000), description (required,
  max 100 chars, live counter), customer email and/or phone (at least one, format validated),
  optional expiry (must be in the future). Optionally **allow partial payments**, with a
  required minimum first payment (> 0 and <= the amount). Errors are inline, linked with
  `aria-describedby`, and focus moves to the first invalid field on submit.
- **List** with amount, description, customer, status (Active / Partially paid / Paid / Expired),
  paid / due and created time. Newest first. A table on wide screens, stacked cards below 640px.
- **Filter** by All / Active / Partially paid / Paid / Expired (toggle buttons with counts).
- **Record payment** on Active and Partially paid links: an inline form prefilled with the amount
  due (amount > 0 and <= due; a link that does not allow partial payments must be paid in full;
  the first payment of a partial link must reach the minimum).
- Loading, empty (no links vs. none matching the filter) and error states with Retry.

## Design decisions

- **Money is integer paise.** The amount string is parsed with string arithmetic (never
  `Math.round(x * 100)`), then formatted only at the edge with `Intl.NumberFormat('en-IN')`.
- **Paid / due and status are derived, never stored.** A link holds `payments[]`; paid is their
  sum and due is `amount - paid`. `getStatus(link, now)` is a pure function with the order
  `paid` (paid >= amount) > `expired` (`expiresAt <= now`) > `partially_paid` > `active`. `now` is
  injected; the UI re-renders on a 30 s tick (`useNow`). Fully paid links never expire.
- **Exhaustive `switch` with a `never` check** on `LinkStatus`, so adding a status fails the
  typecheck everywhere it has to be handled.
- **Data access behind one interface** (`src/api/linksApi.ts`): an in-memory implementation with
  latency and failure injection (`failNext`, `setFailAll`) that a real backend could replace.
  Persistence lives here too (`src/api/storage.ts`): load on start, save after every change, all
  storage access in try/catch, data shape-checked on load; unreadable or invalid data is ignored
  with a console warning and the app starts empty. The UI is unaware of storage.
- **The payment rules are enforced twice** from one function (`checkPaymentAmount`): by the form
  for inline errors and by the API so they cannot be bypassed.

```
src/
  domain/      types, money, validation, status, payments, format   (pure, unit-tested)
  api/         LinksApi interface, in-memory mock, localStorage persistence
  hooks/       useNow (ticking clock), useLinks (load/create/recordPayment + states)
  components/  CreateLinkForm, RecordPaymentForm, StatusFilter, LinksList, EmptyState, ErrorAlert
e2e/           Playwright specs (expiry is tested with page.clock)
```

## Assumptions

- New links are Active. Payments cannot be recorded on Paid or Expired links; an expired link
  keeps its recorded payments and shows Expired (not Partially paid).
- Phone is an Indian mobile number: spaces/dashes and a leading `+91` or `0` are stripped, then
  `^[6-9]\d{9}$`. Email uses a simple `x@y.z` check and is lower-cased.
- Expiry uses the browser's local time zone; blank means it never expires; an expiry equal to
  "now" counts as expired.
- Description length is counted after trimming, in UTF-16 code units.
- The minimum first payment only applies while nothing has been paid; later payments can be any
  amount > 0 and <= due.
- Out of scope: edit, cancel, delete, refunds, search, pagination.


## Agent transcript
razorpay-frontend-agentic-readiness-agent-transcript.txt is the implementation session (added
after submission; no code changes; submitted code is ea386f8). The scaffold, AGENTS.md and the
plans for sections 2 and 4 came from a separate planning session with Claude Code, while using the `brainstorming` skill from [Obra superpowers skill](https://github.com/obra/superpowers). Their output
is AGENTS.md: section 2 answers under "Assumptions", design and tests under "Design"/"Tests",
section 4 under "Requirement change 1", "Assumptions for change 1" and "Change log".