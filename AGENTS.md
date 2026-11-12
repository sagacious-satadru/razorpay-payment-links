# AGENTS.md - Payment Links manager (Razorpay agentic frontend test)

Context for any coding agent (Claude Code, Antigravity, Cursor) working in this repo.
The human (Satadru) directs; the agent proposes, implements in small steps, and verifies.

## The test (timed, 100 min, HackerEarth)
1. Spot what the agent got wrong - 5 MCQs (10 min)
2. Brief and context setup (15 min) - clarifying questions + assumptions, reusable context
3. Build the base - Payment Links manager (40 min)
4. Requirement change, revealed in that section (20 min)
5. Walkthrough and defensibility (15 min)
Rules: commit after each section (they read the commit history); keep the agent transcript;
no pasted pre-written solutions or template apps. Work in a NEW public GitHub repo.

## Brief (verbatim essentials)
1. Create form: amount (INR, required, > 0, max 2 decimals, max 5,00,000), description
   (required, max 100 chars), customer email OR phone (at least one; validate format),
   expiry date (optional, must be in the future).
2. List: amount, description, customer, status (Active / Paid / Expired), created time.
   Links whose expiry has passed must show Expired.
3. Filter by status (All / Active / Paid / Expired).
4. Data in memory / mocked; no backend.
5. Sensible empty, error and validation states. Keyboard-accessible, usable at mobile width.
Stack: Vite + React + TypeScript, Vitest + Testing Library, Playwright for E2E.

## Requirement change 1 (Section 4) - Partial payments (verbatim essentials)
- Create form: checkbox "Allow partial payments" + "Minimum first payment" (required if ticked;
  > 0 and <= amount).
- Each link tracks amount paid. "Record payment" action on Active / Partially paid links
  (amount > 0 and <= amount due).
- Status: Active (nothing paid), Partially paid, Paid (fully paid), Expired. Expired wins over
  Active / Partially paid once expiry passes; Paid links never expire.
- List shows paid / due; the status filter gains "Partially paid".
- Links must survive a page reload.

## Assumptions for change 1 (agreed defaults)
- **Data model:** `allowPartial: boolean`, `minFirstPaymentPaise?: number`,
  `payments: { id, amountPaise, at }[]`. `paidPaise` and `duePaise` are **derived**
  (sum of payments; amount - paid), never stored. Remove `paidAt`; "paid at" = last payment.
- **Status (derived, pure, `now` injected), in this order:** `paid` if paid >= amount;
  else `expired` if `expiresAt <= now`; else `partially_paid` if paid > 0; else `active`.
  `LinkStatus = 'active' | 'partially_paid' | 'paid' | 'expired'`.
- **Record payment rules** (amount parsed string -> integer paise like the create form):
  > 0 and <= due. If `allowPartial` is false the payment must equal the full due (single
  payment). If partial is allowed and nothing is paid yet, the first payment must be
  >= `minFirstPaymentPaise`. Later payments: any amount > 0 and <= due. Final payment that
  clears the due makes the link Paid. Not offered on Paid or Expired links.
- **UI:** "Record payment" replaces "Mark as paid": an inline mini-form per link (amount input
  prefilled with the due, Submit/Cancel, inline accessible errors). Min-first-payment input is
  shown only when the checkbox is ticked (and validated only then). List shows "Paid / Due"
  (e.g. ₹200.00 paid, ₹300.00 due). Filter: All / Active / Partially paid / Paid / Expired with counts.
- **Persistence:** the in-memory API also writes to `localStorage` under a versioned key
  `payment-links:v1` after every change and loads it on start. All storage access in
  try/catch; unreadable or invalid data (shape-checked on load) is ignored with a console
  warning and starts empty. Storage stays behind the `LinksApi` interface (the UI is unaware).

## Assumptions (agreed defaults; PM did not answer)
- **Status:** new links are Active. Each Active link has a "Mark as paid" button. Paid is
  terminal (stays Paid even after expiry passes). An expired link cannot be marked paid
  (button not shown). Status is **derived**, never stored for expiry:
  `getStatus(link, now)` = `paid` if `paidAt`; else `expired` if `expiresAt <= now`; else `active`.
  `now` is injected (pure function); the UI re-renders on a 30 s tick (`useNow`).
- **Amount:** input `type="text" inputMode="decimal"`. Trim, then must match
  `^\d+(\.\d{1,2})?$` (rejects `1e5`, commas, signs, `.5`, 3+ decimals). Parse the **string**
  into integer paise (rupee part * 100 + paise part padded to 2), never `Math.round(x*100)`.
  Valid range 1 paise (INR 0.01) to 5,00,00,000 paise (INR 5,00,000.00) inclusive.
  Display with `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **Description:** trimmed; required (whitespace-only rejected); max 100 chars after trim;
  input also has `maxLength={100}` and a live counter.
- **Customer:** at least one of email / phone. Email trimmed, lower-cased, simple syntax check
  `^[^\s@]+@[^\s@]+\.[^\s@]+$`. Phone normalised (strip spaces, dashes, leading `+91` or `0`)
  then `^[6-9]\d{9}$` (Indian mobile). If both given, both validated, saved and shown stacked.
- **Expiry:** optional `datetime-local` (user's local time zone), must be strictly after now at
  submit. Blank = never expires. Expiry exactly equal to now counts as Expired.
- **List:** newest first. Created time shown absolute, en-IN, in `<time dateTime=ISO>`.
  Table at >= 640px, stacked cards below (360px min width supported).
- **Filter:** four toggle buttons with `aria-pressed` in a labelled group, each with a count,
  e.g. "Active (3)". Distinct empty messages: no links at all vs none matching the filter.
- **Errors:** the store sits behind a small async mock API (`src/api/linksApi.ts`) that can be
  told to fail (for tests / a dev toggle). Create failure shows an error alert with Retry and
  keeps the form values. Field errors inline, on blur and on submit, linked with
  `aria-describedby` + `aria-invalid`; focus moves to the first invalid field on submit.
  Successful create resets the form and announces via an `aria-live="polite"` region.
- **Out of scope unless asked:** edit, cancel, delete, search,
  pagination, real payment URLs. (The Section 4 change will likely be one of these - keep the
  design ready for it.)

## Design
```
src/
  domain/
    types.ts        PaymentLink { id, amountPaise, description, email?, phone?,
                    createdAt (ms), expiresAt? (ms), paidAt? (ms) }; LinkStatus union;
                    StatusFilter = 'all' | LinkStatus
    money.ts        parseRupeesToPaise(str) -> number | null; formatPaise(n) -> string
    validation.ts   validateLinkInput(raw, now) -> { ok: true, value } | { ok: false, errors }
    status.ts       getStatus(link, now); filterLinks(links, filter, now); countByStatus
  api/linksApi.ts   async createLink / listLinks / markPaid over an in-memory array;
                    small delay; failure injection
  hooks/useNow.ts   ticking clock
  hooks/useLinks.ts load/create/markPaid with loading + error state
  components/       CreateLinkForm, StatusFilter, LinksList (table/cards), EmptyState,
                    ErrorAlert
  App.tsx           composes them; replaces the Vite demo
e2e/                Playwright specs (use page.clock to test expiry)
```
- Every `switch` on `LinkStatus` is exhaustive with a `never` check, so a new status added by a
  requirement change fails typecheck wherever it must be handled.
- Plain CSS (one `App.css`, mobile-first). No new runtime dependencies.

## Tests (each acceptance criterion has one)
- Unit: money parsing edge cases (0, 0.01, 500000, 500000.01, 1.005, 1e5, "", " 5 ", ".5");
  validation rules (each field, at-least-one contact, future expiry); `getStatus` incl. the
  boundary and Paid-after-expiry.
- Component (RTL + user-event): errors shown and focus moves; valid submit adds a row and resets;
  filter counts and filtering; mark paid; API failure shows error + Retry keeps values;
  empty states.
- E2E (Playwright): create -> appears -> filter; expiry flips to Expired via `page.clock`;
  keyboard-only create; 360px viewport has no horizontal scroll.

## Stack and commands (pnpm only)
- React 19 + TypeScript (strict) + Vite 7.
- `pnpm dev` (http://localhost:5173) · `pnpm test` · `pnpm test:watch` · `pnpm typecheck`
  · `pnpm lint` · `pnpm build` · `pnpm e2e`

## Working rules
1. **Acceptance criteria first.** Restate a feature as testable criteria; ask when ambiguous.
2. **Small steps.** One feature per change. Show the plan, then implement.
3. **Verify, don't claim.** After each change run `pnpm typecheck && pnpm test && pnpm lint`
   (and `pnpm e2e` where relevant); report the actual output.
4. **No new dependencies** without asking. No pasted template apps or pre-written solutions.
5. **Commits:** after each section, only when the human asks; conventional messages
   (`feat:`, `fix:`, `test:`, `docs:`).

## Requirement changes
Restate the delta as criteria, list the files/types it touches, update types first (let the
compiler find call sites), then tests, then UI. Record it under "Change log".

## Change log
- **Section 4 - npm support:** Playwright `webServer.command` changed from `pnpm dev ...` to
  `npx vite --port 5173 --strictPort` so E2E runs with npm or pnpm; README notes npm commands.
- **Section 4 - Partial payments (requirement change 1):** added the "Requirement change 1"
  brief and "Assumptions for change 1" sections above. This supersedes the original
  assumptions where they conflict: "Paid is terminal / Mark as paid" becomes payment-based
  status (Paid only when fully paid); `paidAt` replaced by a `payments` list; the status union
  gains `partially_paid`; "persistence across refresh" moved from out of scope to required
  (localStorage, versioned key). Tests to add: status matrix incl. Expired-over-Partially-paid
  and Paid-never-expires; record-payment validation (min first, <= due, full-only when partial
  not allowed); min-first-payment form validation; storage round trip and corrupt data;
  RTL for record payment and the new filter; E2E: create with partial -> record part ->
  Partially paid -> reload -> still there -> pay rest -> Paid.
- **Context files committed:** AGENTS.md and CLAUDE.md (`@AGENTS.md`) are no longer gitignored.
