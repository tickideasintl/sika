# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary:** an individual managing their own money who also gives regularly — tithes,
partnership, offerings, donations — and wants that giving tracked as deliberately as
their spending. They are motivated by stewardship, not by optimization: the question
they bring is "am I being consistent?" more than "am I being efficient?"

**Also served, without a separate product:** anyone tracking personal money. Giving is
never mandatory. A user who never records a giving transaction gets a complete,
coherent expense-and-income tracker with nothing nagging them about an unused pillar.

**Second workspace, same person:** sole traders, freelancers, and small-business owners
who need business money kept genuinely separate from personal money rather than tagged
inside one ledger.

**Invited collaborator (intended, not yet exercised):** a second person given access to
one workspace by its owner — a spouse on the household books, a business partner, a
bookkeeper. They would arrive through an invitation link rather than by signing up, and
their role (editor or viewer) would decide whether they can write. The mechanism exists
in code; no real second person has used it yet, and the gaps recorded under Capabilities
mean this audience is not yet served. Treat it as a direction, not a shipped experience.

**Operator:** the person who self-hosts the instance. Often the same person as the
primary user; sometimes a technical family member or church administrator hosting for
someone else. They care about the data never leaving their server.

*(Decided during init at the user's request: "everyone, but targeted at faith-motivated
individuals as well" — resolved as faith-motivated primary, general-purpose by
construction. Correct this if the emphasis is wrong.)*

## Product Purpose

Sika is a self-hosted personal and business finance manager. It records income,
expenses, and giving; tracks recurring outgoings, debts, money lent to others,
investments, budgets, and goals; and reports on all of it by period and category,
with optional AI receipt scanning for capture.

*Sika* is Twi for "money".

Success is a user who still has accurate numbers in it three months later, because
entry was fast enough that they never fell behind, and because the record includes
the giving that other trackers make them approximate.

The programme behind the feature list, recorded in `docs/PRODUCT_ROADMAP.md`, is turning
a broad manual tracker into a ledger that stays accurate: money can be imported from the
bank, reviewed before it is trusted, tied to an account, reconciled against a statement,
and backed up and restored with the backup proven to restore. Accuracy is the product;
the features are how it survives contact with three years of real use.

## Positioning

**Giving is a third kind of money movement, not a category of spending.** In the data
model it is a peer of income and expense (`transaction_type` enum: `income | expense |
giving`), with its own default categories, its own budgets, and its own line in every
report and export. Trackers that treat tithes as an expense tag can produce a total;
they cannot answer "what did I give this year, separate from what I spent" without the
user maintaining the separation by hand.

**Reinforcing, not the headline:**

- Fully self-hosted, with **no required third-party services**. Receipt scanning, S3
  storage, email, and Web Push are each off until configured, so a default install sends
  nothing anywhere. When AI is enabled it can point at any OpenAI-compatible endpoint
  including a local Ollama — the user chooses whether their receipts ever leave the
  building. Enabling Web Push is the one case where a third party is unavoidable: the
  browser vendor's push service relays the message, which is why it is opt-in and why the
  in-app inbox works without it.
- Workspaces isolate personal from business at the data layer, not by convention. Every
  feature is workspace-scoped.
- Access is granted by invitation from inside the instance, never by public signup. The
  sharing mechanism — owner/editor/viewer on a workspace — exists but is unproven in real
  use, so it is not yet a claim to make about the product.

*(Decided during init at the user's request. The claim is structural and defensible
today; it is a position, not a measured market finding.)*

## Operating Context

- Entry happens in small moments — after a purchase, after a service, at the end of a
  week — often one-handed on a phone. The app is a PWA and mobile-first responsive;
  desktop is where review, reporting, and setup happen.
- Giving is frequently cash or bank transfer with no receipt, entered from memory, and
  often on a rhythm (weekly service, monthly partnership) rather than ad hoc.
- Users switch workspaces mid-session; the active workspace is a persistent, visible
  piece of state, and being wrong about which one is active corrupts the record.
- Reporting has real deadlines behind it: tax year, financial year-end, annual giving
  summaries. CSV export, a full JSON/ZIP workspace export, and validated backups exist so
  the numbers can leave the app and come back.
- Money arrives in two rhythms, not one. Typing happens continuously in small moments;
  importing happens in batches, when a bank statement is downloaded. Imported money is not
  trusted on arrival — it lands in a review inbox, gets a payee and a category, and is
  marked reviewed, which is a separate sitting from entry.
- Attention is pulled, not pushed, by default: an in-app notification inbox carries money
  due, review items, budget limits, and stale backups. Push and email delivery exist for
  the same events but only once the operator configures them.
- **Access model.** An empty instance is claimed once with a server-side setup token
  (`SIKA_SETUP_TOKEN`); public self-registration is closed at the auth API, not only in
  the UI. After that, further accounts exist only by invitation: an owner creates an
  invitation for one email address, the link is copied and shared by hand, and signup is
  accepted only when the invitation matches. There is no admin tier and no user-admin
  screen — the setup token is bootstrap authority, not a product role, and roles are
  scoped to a workspace rather than to the instance.
- Because invitations are copy-a-link, mail is never required to add a person. SMTP is a
  notification convenience, not part of provisioning.
- Deployment is Docker Compose or Dokploy on the user's own server; migrations run at
  startup. Backups are the operator's job: `npm run backup:create`, `backup:validate` and
  `backup:restore` are shipped commands, and an optional token-protected endpoint records
  the last validated success so the app can complain when it goes stale.

## Capabilities and Constraints

**Present:**

- Email/password auth (Better Auth); no admin tier — the first account is an ordinary
  user. Creating it requires the operator's server-only `SIKA_SETUP_TOKEN`; open
  registration closes permanently once that account exists.
- Workspace sharing — **foundation only; not a working multi-person feature yet.**
  `owner` / `editor` / `viewer` memberships exist, invitation links name one email address
  and expire in seven days, member and invitation management is mounted in Settings,
  revocation removes access immediately, and every *workspace-scoped* API route authorises
  against the caller's role in the active workspace (defaulting to editor, dropping to
  viewer on read paths). Four routes are deliberately workspace-agnostic and authorise the
  user alone: `/api/workspaces*`, `/api/ai-provider`, `/api/receipts/scan`, and
  `/api/workspace-invitations/accept`. Verified against a scratch database: an invited
  member does read the owner's ledger. Three gaps stop it being usable, all of them in
  code rather than in the model:
  - **A phantom workspace is created for every invited member.** When a workspace-scoped
    request arrives without an `x-workspace-id` header, `requireAuthWithWorkspace` falls
    back to `getOrCreateDefault(actor)`, which *creates* an empty `Personal` workspace
    marked `is_default`; the workspace context then prefers `is_default`, i.e. the
    member's own empty workspace, over the shared one they were invited to. Both of those
    steps are confirmed against a scratch database. The **trigger is inferred and not yet
    reproduced in a browser**: `apiFetch` reads `localStorage` synchronously and the
    dashboard layout fires `/api/categories/seed` through it on mount, so a fresh member
    with empty `localStorage` should send that call without the header. One session signed
    in as an invited member settles it either way.
  - **Nothing a member writes is attributed to them.** Services run under the workspace
    owner's ledger identity, so a transaction entered by an editor carries the owner's
    `user_id`. The actor is recorded only for review events and review assignment. There
    is no "who entered this" anywhere a shared ledger would need one.
  - **Roles are invisible in the UI.** `activeWorkspace.role` is read in exactly one
    component (the members card). A viewer is shown every add, edit and delete control in
    the app and discovers the restriction as a 403 after pressing one.
- Workspaces: `personal` and `business` types, multiple allowed, per-workspace
  currency, hard data isolation across every feature. Categories, budgets, and onboarding
  are seeded and tracked per workspace, not per user.
- Transactions: `income`, `expense`, `giving`; CRUD, search, type/category/date-range
  filtering at the database level. A transaction can carry a payee, tags, a financial
  account, pending/cleared/reconciled status, client attribution, giving recipient and
  designation, supporting documents, and a needs-review flag with an assignee.
- Import pipeline: CSV with signed or debit/credit columns, plus OFX/QFX, QIF and
  CAMT.053; saved per-account import profiles; account-scoped fingerprints and an explicit
  duplicate-check step; a needs-review inbox with bulk classification; prioritised
  transaction rules that apply a category, tags, client, or reviewed state to future
  imports without ever touching amounts, dates, types, accounts, or reconciliation status.
- Review accountability: reviews can be assigned to a member, and every review event is
  kept as history rather than overwritten.
- Financial accounts: asset and liability accounts, opening and derived balances,
  linked transfers that never enter income/expense/giving reports, statement
  reconciliation, and account balances included in net worth. Historical
  transactions remain explicitly unassigned until the user places them.
- Categories: 10 default expense, 8 default giving, plus custom, color-coded,
  per workspace.
- Budgets: monthly / quarterly / yearly, per category, with live spent-vs-allocated
  progress, copy-forward into the next period, optional rollover of an unused balance
  (expense and giving budgets only), and optional workspace-level envelope budgeting for
  monthly plans.
- Giving workspace: recipients and their funds or designations with archiving that
  preserves history; one-time, monthly, quarterly and yearly commitments compared against
  what was actually given; an optional giving-to-income context for the period; multiple
  supporting documents per gift; a review that finds gifts with no document; and annual
  summaries by recipient and designation with CSV export. These are personal records, not
  official tax receipts issued on a recipient's behalf.
- Recurring money for income, expenses and giving through one model, with monthly
  expectation drafts that never enter the ledger, matching of imported transactions to
  those drafts, variable amounts, and partial or over-settlement reported separately.
- Recurring outgoings with payment logs; loans given with repayments and status;
  investments (stock, crypto, forex, property, business, savings, other) with
  return/dividend/sale/loss/fee events; goals with contribution and spending activity and
  dated sinking-fund plans; net-worth rollup.
- A unified financial calendar combining recurring income, expenses, giving and debt
  payment dates, distinguishing statement amounts from estimates and showing partial or
  completed settlement without changing ledger totals.
- Notifications: an in-app inbox with unread state and durable read tracking, covering
  money due within seven days, imported transactions needing review, budgets at 80% and
  over, and validated backups that have gone stale for 48 hours. Optional Web Push and
  SMTP delivery of the same events, per member, through a token-protected dispatcher with
  per-occurrence deduplication.
- Clients (business workspaces) / people (personal), with the costs carried on
  their behalf. A recurring outgoing can name the vendor it is paid to and the
  client it is really for, on one of four terms: **own cost**, **at cost**,
  **fixed price**, or **in retainer**. Transactions can be attributed to a client
  so money coming back is matched against money fronted. Recovery accrues when a
  cost is actually paid, not when it is scheduled, and the shortfall is
  cumulative and floored at zero so a renewal settled late does not read as a
  permanent leak. A recovered cost is still an expense and its recovery is still
  income: the two are never netted in the ledger, only in the client view and in
  the overhead split on the outgoings page.
- Debts and credits (credit card, loan, mortgage, overdraft, other) with balance
  snapshots, payments, and per-cycle **statements**: opening and closing balance,
  interest and fees charged, minimum payment, and the interest rate that cycle
  implies shown against the APR on file. When a statement prints several APRs at
  once, interest can be split into per-APR lines (a 0% balance transfer next to
  purchases), each with the rate it implies against its own APR, alongside a
  single blended statement rate. Statement interest is reported as cost of
  borrowing and is deliberately never added to expense totals — the payment is
  already counted and the interest sits inside it.
- Debts can be linked to a liability account so one balance is never counted twice.
- Analytics: trend and category charts (Recharts), period filters, comparison against the
  previous period or the same period a year earlier, and CSV export.
- Data portability: full workspace export as JSON or as a ZIP that carries the receipt and
  document files with it; `backup:create` / `backup:validate` / `backup:restore`
  commands, where validation decodes the whole `pg_restore` archive and asserts that the
  table of contents holds every required table plus the Drizzle migration journal — not a
  checksum, but not a trial restore either; and an optional endpoint for recording that an
  external backup succeeded.
- Receipt scanning via any OpenAI-compatible vision endpoint, configured per user in
  Settings, disabled by default; receipt images and giving documents stored in
  S3-compatible storage when configured.
- First-run onboarding card: workspace currency, optional first budget, optional first
  transaction.
- Light/dark/system theming with dark as the default, toast notifications,
  `prefers-reduced-motion` honored.
- Installable PWA; the service worker caches only static assets (icons, manifest,
  favicon) and never authenticated pages or financial data.

**Constraints:**

- Next.js 16 App Router, React 19, TypeScript, PostgreSQL + Drizzle, Tailwind v4 with
  `@theme` tokens in `app/globals.css`, shadcn/ui + Radix primitives, lucide-react
  icons, Bricolage Grotesque and Geist via `next/font` (self-hosted at build time).
  New UI works within this system rather than adding a parallel one.
- **A default install must remain fully functional with no third-party API keys.** Any
  feature depending on an external service degrades to an explicit, non-blocking
  opt-in. This is a product commitment, not a current convenience.
  *(Decided during init at the user's request.)*
- Currency is per workspace, from a fixed list of 10 (GBP default, plus USD, EUR, NGN,
  KES, ZAR, CAD, AUD, GHS, INR). Amounts are single-currency per workspace; there is no
  FX conversion.
- Copy is English only; no i18n layer exists.
- MIT licensed and public at `github.com/tickideasintl/sika`. Anything shipped is
  readable by self-hosters and contributors.

**Decided — registration and multi-person access (v1.0.0, superseded 2026-08-15):**

- **Bootstrap is unchanged:** the operator sets `SIKA_SETUP_TOKEN` at deploy and the
  first visitor who knows it creates the first account. Empty-database open signup is
  rejected because a public instance could otherwise be claimed by a bot before the
  operator arrives.
- **Open registration stays closed forever.** Once an account exists, `/sign-up` is
  refused at the auth API unless the request carries a valid invitation token.
- **What replaced "exactly one account per instance":** the *foundation* for shared
  workspaces. An owner invites a named email at editor or viewer level; the invitation is
  a copied link, not a sent mail; accepting it creates that person's own account, which
  sees only the workspaces they were invited to. The `users_singleton` database constraint
  that enforced one row in `users` was dropped in migration `0033` when memberships
  shipped. **In practice every instance is still single-user** — nobody has run the
  invitation flow with a real second person, and the three gaps listed under Capabilities
  would surface immediately if they did.
- **Roles are workspace-scoped, not instance-scoped.** There is still no admin tier and
  no user-admin screen. An owner administers their own workspace and nothing else.

**Household sharing is NOT implemented (established 2026-08-16 by reading the code and
exercising it against a scratch database):**

- What exists is the plumbing the v1 vocabulary called for — memberships and roles — not
  the feature. `docs/PRODUCT_ROADMAP.md` is the accurate document here: it says
  "foundation implemented", and that is the correct description.
- **Definition of done, so this is not re-litigated:** household sharing is implemented
  when an invited person can sign in and land in the workspace they were invited to
  without being given a workspace of their own, when the ledger records which member
  entered or changed a row, and when a viewer is shown a read-only interface rather than
  controls that fail. None of the three is true today.
- Until then, describe Sika as single-user with a sharing foundation. Do not put shared
  finances in a release note, the README, or any user-facing copy.

**Undecided:**

- **Isolated multi-user hosting** — several unrelated private accounts on one server,
  each with their own workspaces — remains unbuilt and unpromised. If it is ever offered,
  the provisioning path is still open (likely an operator CLI, not open registration).
- Whether bank integration, when it arrives, is allowed to break the no-required-
  third-party default (it would have to be opt-in to comply).

## Brand Commitments

**Binding:**

- The name **Sika**, and its meaning — Twi for "money". The rename from SurplusWise is
  shipped in `CHANGELOG.md`, the npm package, the PWA manifest, and the git remote. The
  local directory name `SurplusWise` is legacy and carries no authority.
- MIT license, and attribution to TickIdeas Intl as the publishing org.
- Voice as it stands in shipped copy: plain, concrete, unhyped. "Track your income,
  expenses, and giving in one place. No clutter, no noise." No growth-hacking tone, no
  exclamation marks, no financial-guru urgency.
- Giving is named respectfully and never euphemized, ironized, or upsold.

**Explicitly not binding:**

- The current visual direction — the Sika mark in `public/brand/`, the `#0B0B0D`
  dark canvas recorded as `manifest.json` `theme_color`, the Bricolage Grotesque
  and Geist pairing, and the semantic money palette. A future direction may replace
  all of it.

  These are **chosen, not inherited**: the mark was approved against a specific
  direction and the rest is documented in `DESIGN.md`. Not binding means a
  deliberate redesign may replace them — it does not mean they are free to drift.
  Changing any of them means regenerating `public/icon-192.png`,
  `public/icon-512.png`, `public/apple-touch-icon.png`, `public/og-image.png` and
  `manifest.json` `theme_color` together.

*(Decided during init at the user's request; updated after the Sika brand and the
Quiet Ledger redesign shipped, which replaced the original scaffold defaults — a
wallet glyph, `#3b82f6` blue, and Plus Jakarta Sans.)*

## Evidence on Hand

- **Real:** the running application and its feature set; the public MIT repository and
  CI; `README.md`, `CHANGELOG.md`, `docs/` (setup, migration, backup and restore, go-live
  checklist); `docs/PRODUCT_ROADMAP.md` as the dependency-ordered programme and the place
  sequencing decisions live; `prd.md` as origin document.
- `CHANGELOG.md` is current only to roughly the recurring-money work. Roughly a dozen
  shipped features after it — exports, backup commands, budget planning, year-over-year
  reports, workspace sharing — are in the code and the roadmap but not in the changelog.
  Read the roadmap or `git log`, not the changelog, when checking whether something exists.
- **Absent — must not be fabricated:** user counts, install counts, GitHub stars,
  testimonials, case studies, named customers, press, awards, funding, uptime figures,
  benchmark results, and any measured accuracy claim for receipt scanning.
- The numbers in `prd.md` §6 (90% receipt-capture accuracy, 70% 30-day retention, 4/5
  satisfaction) are **stated goals, never measured**. They may not appear anywhere
  user-facing as achievements.
- There is no pricing, no plans, and no paid tier. Sika is free and self-hosted.
- **There is still no PDF export.** Numbers leave the app as CSV, as a JSON workspace
  export, or as a ZIP carrying the stored files with them. The unused `jspdf` dependency
  that used to sit in `package.json` has been removed; do not describe PDF reporting as a
  feature until it exists.
- Giving summaries are personal records. They are not, and must not be described as,
  official tax receipts issued on a recipient's behalf.

## Product Principles

1. **Giving keeps its own line.** Anywhere money is summarized, categorized, budgeted,
   or exported, giving is visible as its own thing — never folded into expenses to
   simplify a chart.
2. **The record is protected at both ends.** Typing must be fast — friction added to
   capture costs more than the feature it enables — and importing must be slow: money
   arriving from a bank file is a claim until a person confirms it, and no automatic rule
   may change an amount, a date, a type, an account, or a reconciliation state.
3. **Nothing leaves the server unless the user sent it.** External calls — AI, S3, SMTP,
   Web Push — are opt-in, named, and reversible, and every one of them has a working
   in-app equivalent. The default install is silent.
4. **The active workspace is never ambiguous.** Personal and business separation is a
   promise, and it now carries other people's access with it; any UI where a user could
   enter data into the wrong workspace, or see one they were not invited to, breaks it.
5. **Say only what is true.** No invented proof, no aspirational metrics presented as
   results, no urgency about someone else's money.

## Accessibility & Inclusion

- **WCAG 2.2 AA is the standard for new and changed UI.** The existing surface has not
  been audited against it; `docs/IMPROVEMENTS.md` carries an open AA audit item. New
  work meets the bar; legacy screens are brought up as they are touched.
  *(Decided during init at the user's request.)*
- Non-negotiables given the domain: numeric data is never conveyed by color alone
  (over/under budget, positive/negative net worth, debt vs asset must carry text or
  shape); amounts use tabular figures; touch targets meet 24px minimum with comfortable
  spacing for one-handed phone entry.
- Radix primitives supply the interaction semantics; keep them rather than rebuilding
  controls.
- `prefers-reduced-motion` is already honored globally in `app/globals.css` and must
  stay honored.
