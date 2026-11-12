# Payment Links manager

A small React app to create payment links, list them, filter by status and mark them as paid.
All data lives in memory behind a mock async API (no backend, nothing persists across a refresh).

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
  optional expiry (must be in the future). Errors are inline, linked with `aria-describedby`,
  and focus moves to the first invalid field on submit.
- **List** with amount, description, customer, status (Active / Paid / Expired) and created time.
  Newest first. A table on wide screens, stacked cards below 640px.
- **Filter** by All / Active / Paid / Expired (toggle buttons with counts).
- **Mark as paid** on active links.
- Loading, empty (no links vs. none matching the filter) and error states with Retry.

## Design decisions

- **Money is integer paise.** The amount string is parsed with string arithmetic (never
  `Math.round(x * 100)`), then formatted only at the edge with `Intl.NumberFormat('en-IN')`.
- **Status is derived, never stored for expiry.** `getStatus(link, now)` is a pure function:
  `paid` if `paidAt` is set, else `expired` if `expiresAt <= now`, else `active`. `now` is
  injected; the UI re-renders on a 30 s tick (`useNow`). Paid is terminal.
- **Exhaustive `switch` with a `never` check** on `LinkStatus`, so adding a status fails the
  typecheck everywhere it has to be handled.
- **Data access behind one interface** (`src/api/linksApi.ts`): an in-memory implementation with
  latency and failure injection (`failNext`, `setFailAll`) that a real backend could replace.

```
src/
  domain/      types, money, validation, status, format   (pure, unit-tested)
  api/         LinksApi interface + in-memory mock
  hooks/       useNow (ticking clock), useLinks (load/create/markPaid + states)
  components/  CreateLinkForm, StatusFilter, LinksList, EmptyState, ErrorAlert
e2e/           Playwright specs (expiry is tested with page.clock)
```

## Assumptions

- New links are Active; an expired link cannot be marked paid; a paid link stays Paid.
- Phone is an Indian mobile number: spaces/dashes and a leading `+91` or `0` are stripped, then
  `^[6-9]\d{9}$`. Email uses a simple `x@y.z` check and is lower-cased.
- Expiry uses the browser's local time zone; blank means it never expires; an expiry equal to
  "now" counts as expired.
- Description length is counted after trimming, in UTF-16 code units.
- Out of scope: edit, cancel, delete, persistence, search, pagination.
