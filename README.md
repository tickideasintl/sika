# Sika

[![CI](https://github.com/tickideasintl/sika/actions/workflows/ci.yml/badge.svg)](https://github.com/tickideasintl/sika/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Self-hosted personal and business finance manager.** Track expenditures, monitor
monthly outgoings, and manage faith-based giving such as tithes and partnership,
with optional AI-powered receipt scanning. Separate **Personal** and **Business**
workspaces keep data fully isolated.

*Sika* is Twi for "money".

Your financial data stays on your own server. Nothing is sent anywhere unless you
explicitly enable optional AI, storage, or notification delivery integrations.

## Quick start

You need Docker and Docker Compose.

```bash
git clone https://github.com/tickideasintl/sika.git
cd sika
cp .env.example .env

# Required: generate independent auth and one-time setup secrets, then set a database password
sed -i "s|^BETTER_AUTH_SECRET=.*|BETTER_AUTH_SECRET=$(openssl rand -base64 32)|" .env
sed -i "s|^SIKA_SETUP_TOKEN=.*|SIKA_SETUP_TOKEN=$(openssl rand -hex 32)|" .env
echo "POSTGRES_PASSWORD=$(openssl rand -base64 24)" >> .env

docker compose up -d
```

Sika is now on [http://localhost:3000](http://localhost:3000). Migrations run
automatically on startup, so there is no separate database setup step. Open the
setup page and enter `SIKA_SETUP_TOKEN` to create the instance's only account.
The account is an ordinary user; there is no admin tier. Registration closes
after that account is created.

### Minimum configuration

Four variables are required:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret, `openssl rand -base64 32` |
| `SIKA_SETUP_TOKEN` | First-account setup secret, `openssl rand -hex 32` |
| `NEXT_PUBLIC_SITE_URL` | Public origin, e.g. `https://sika.example.com` |

Everything else is optional. **Receipt scanning and file storage are off unless
you configure them**, so Sika runs fully offline with no third-party API keys.
Set `OPENAI_API_KEY` to enable receipt scanning, and the `S3_*` variables to store
receipt images. The AI provider is configurable per user in Settings and works
with any OpenAI-compatible HTTPS endpoint. `OPENAI_API_KEY` is only used for
OpenAI itself; other providers need the user's own key. To use a local Ollama
instance, set `SIKA_ALLOW_PRIVATE_AI_ENDPOINTS=true`, which lets any signed-in
user point the server at internal hosts, so only enable it on trusted installs.

Notification delivery is also optional and self-hosted. Browser Push uses a VAPID
key pair generated with `npx web-push generate-vapid-keys --json`; email uses
your own SMTP server through `SMTP_URL` and `SMTP_FROM`. Configure either channel
plus `NOTIFICATION_DISPATCH_TOKEN`, then invoke the token-protected dispatcher
from system cron (hourly is a sensible default):

```bash
curl --fail --request POST \
  --header "Authorization: Bearer $NOTIFICATION_DISPATCH_TOKEN" \
  "$NEXT_PUBLIC_SITE_URL/api/notifications/dispatch"
```

The token belongs in the header, never in the URL. Users explicitly opt into
each channel per workspace in Settings; Sika does not prompt for browser
permission on load, and SMTP is not required for account registration.

See `.env.example` for the complete list.

### Before exposing it to the internet

The bundled `docker-compose.yml` is tuned for local use. For a public deployment:

- Remove the `ports:` mapping on the `db` service so Postgres is not reachable
- Set `POSTGRES_PASSWORD`, `BETTER_AUTH_SECRET`, and `SIKA_SETUP_TOKEN` to independently generated values
- Put Sika behind a reverse proxy with TLS and set `NEXT_PUBLIC_SITE_URL` to the
  HTTPS origin
- Schedule `npm run backup:create` and store its validated archive off-host.
  See [Backup and restore](docs/BACKUP_AND_RESTORE.md)

See [SECURITY.md](SECURITY.md) for the full checklist, and
[DOKPLOY.md](DOKPLOY.md) if you deploy with Dokploy.

> **Upgrading an existing installation:** the one-account migration deliberately
> stops if the database already contains multiple users. Back up the database and
> reconcile those accounts before retrying; Sika never chooses an account or deletes
> financial data automatically.

## Features

### Current Features

**Authentication & Security**
- ✅ One-time, setup-token-protected account creation with Better Auth
- ✅ Login and logout with secure session management
- ✅ Email/password authentication

**Transaction Management**
- ✅ Manual transaction entry (expenses, income, and givings)
- ✅ Giving recipients and recipient-specific funds/designations
- ✅ Giving commitments and expected-versus-recorded progress
- ✅ Optional giving-to-income context by reporting period
- ✅ Multiple optional supporting documents per gift
- ✅ Missing supporting-document review for giving
- ✅ Annual giving summaries by recipient and designation
- ✅ CRUD operations for all transactions
- ✅ Search and filter transactions
- ✅ Date range filtering with database-level optimization
- ✅ Optional financial account assignment with pending/cleared/reconciled status
- ✅ Asset and liability balances, transfers, and statement reconciliation
- ✅ CSV, OFX/QFX, QIF, and CAMT.053 imports with payees and duplicate review
- ✅ Imported-transaction review inbox with safe bulk classification
- ✅ Prioritized transaction rules for automatic import classification
- 🤖 AI-powered receipt scanning with OpenAI Vision
- ✅ Receipt upload and storage via S3-compatible storage

**Budget Tracking**
- ✅ Create budgets for expense and giving categories
- ✅ Monthly, quarterly, and yearly budget periods
- ✅ Real-time budget vs actual spending tracking
- ✅ Budget progress indicators with color coding

**Projected Income**
- ✅ Set expected income by category and period, per workspace
- ✅ Compare received income with the month's projection
- ✅ Copy a projection forward without treating extra receipts as over-budget

**Analytics & Reports**
- 📊 Interactive analytics dashboard with charts
- 📈 Spending trends visualization (line charts)
- 🥧 Category breakdown (pie charts)
- 📅 Period-based filtering (weekly, monthly, quarterly, yearly, custom)
- 💾 CSV data export
- 💰 Financial account balances included in net worth

**Category Management**
- ✅ Default expense categories (10 categories)
- ✅ Default giving categories (8 categories)
- ✅ Create custom categories
- ✅ Edit and delete custom categories
- ✅ Color-coded categories

**Workspaces**
- ✅ Switch between Personal and Business finance workspaces
- ✅ All features available in both workspaces with separate data
- ✅ Create additional workspaces (personal or business type)
- ✅ Workspace switcher dropdown in dashboard navigation
- ✅ Automatic data isolation — transactions, budgets, categories, debts, loans, investments, and analytics are workspace-scoped

**User Interface**
- ✅ Responsive dashboard layout
- ✅ Modern UI with Tailwind CSS and shadcn/ui
- ✅ Dark mode support
- ✅ Toast notifications
- ✅ Installable PWA with a privacy-safe offline fallback
- ✅ Mobile-friendly design
- ✅ In-app, Web Push, and SMTP reminders for due money, import review, budget limits, and stale backups

### Upcoming Features
- 📱 Advanced filtering options
- 🏦 Bank integration
- 🔮 Spending predictions

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Runtime**: React 19
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication**: Better Auth (Postgres adapter)
- **AI/OCR**: OpenAI Vision API
- **File Storage**: S3-compatible (AWS S3, MinIO, R2, etc.)
- **UI Components**: shadcn/ui + Radix UI
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **Deployment**: Dokploy (self-hosted) or any Docker host

## Getting Started

### Prerequisites

- Node.js 24.x (24.13.0 or newer; Node 25+ is not supported) and npm
- PostgreSQL 16+ (local, Neon, Supabase, or Dokploy-managed)
- An OpenAI-compatible API key — optional, only for receipt scanning
- S3-compatible storage for receipt images — optional

### Installation

1. Clone the repository:
```bash
git clone https://github.com/tickideasintl/sika.git
cd sika
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Key variables:
```env
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/sika
BETTER_AUTH_SECRET=<openssl rand -base64 32>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
OPENAI_API_KEY=your_openai_api_key
```

See `.env.example` for the full list including S3 storage vars.

4. Run database migrations (**required**):
```bash
npm run db:migrate
```

> Production note: Docker runtime auto-runs migrations on startup, then verifies
> schema before serving traffic. See Dokploy runbook:
> `docs/PROD_GO_LIVE_CHECKLIST.md`.

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser.

> For detailed setup instructions (including Dokploy deployment), see [docs/SETUP.md](docs/SETUP.md).
> For production release command order, use [docs/PROD_GO_LIVE_CHECKLIST.md](docs/PROD_GO_LIVE_CHECKLIST.md).
> For future DB changes, use [docs/NEXT_DB_MIGRATION_TEMPLATE.md](docs/NEXT_DB_MIGRATION_TEMPLATE.md).

## Project Structure

```
Sika/
├── app/
│   ├── api/            # API route handlers
│   │   ├── auth/       # Better Auth endpoints
│   │   ├── workspaces/ # Workspace CRUD
│   │   ├── transactions/
│   │   ├── categories/
│   │   ├── budgets/
│   │   ├── analytics/
│   │   ├── recurring-outgoings/
│   │   ├── debts-credits/
│   │   ├── loans-given/
│   │   ├── investments/
│   │   └── receipts/
│   ├── dashboard/      # Dashboard pages
│   ├── globals.css     # Global styles
│   ├── layout.tsx      # Root layout
│   └── page.tsx        # Home / landing page
├── components/
│   ├── ui/             # shadcn/ui components
│   └── dashboard/      # Dashboard-specific components
├── contexts/           # React context providers (workspace, etc.)
├── db/
│   ├── schema.ts       # Drizzle ORM schema
│   ├── client.ts       # Postgres connection pool
│   └── migrations/     # SQL migration files
├── lib/
│   ├── db/             # Data-access layer (transactions, budgets, etc.)
│   ├── auth.ts         # Better Auth server config
│   ├── auth-client.ts  # Better Auth client
│   ├── auth-server.ts  # Auth server helpers (incl. workspace resolution)
│   ├── storage.ts      # S3 storage helpers
│   └── utils.ts        # Utility functions
├── hooks/              # Custom React hooks
├── types/              # Shared TypeScript types
└── public/             # Static assets
```

## Database

The application uses PostgreSQL with Drizzle ORM. Main tables:

- **users / sessions / accounts** — managed by Better Auth
- **workspaces** — personal and business finance workspaces per user
- **transactions** — user financial transactions (scoped by workspace, indexed by user, date, type, category)
- **categories** — user-defined and default categories (per workspace)
- **budgets** — budget allocations with period-based tracking (per workspace)
- **recurring_outgoings** — monthly recurring bills and subscriptions (per workspace)
- **debts_credits** — credit cards, loans, and other debts (per workspace)
- **loans_given** — money lent to others (per workspace)
- **investments** — stocks, crypto, property, and other assets (per workspace)

### Database Commands

```bash
npm run db:generate   # Generate SQL migrations from schema changes
npm run db:migrate    # Apply pending migrations
npm run db:studio     # Open Drizzle Studio GUI
```

## Dependency Maintenance Note

Dependencies were upgraded and the app was verified with:

```bash
npm run lint
npm run build
```

Both commands pass on the current dependency set.

### esbuild override (GHSA-67mh-4wv8-2f99)

`npm audit` reports 0 vulnerabilities. Keeping it that way depends on the `overrides`
block in `package.json`:

```json
"overrides": {
  "@esbuild-kit/core-utils": {
    "esbuild": "^0.25.12"
  }
}
```

`drizzle-kit` still depends on the deprecated `@esbuild-kit/esm-loader` chain, which
otherwise pulls in `esbuild@0.18.20` and four moderate advisories. The override forces
that nested copy onto a patched release, where it dedupes onto the `esbuild` version
`drizzle-kit` already ships.

Do not remove this block until `drizzle-kit` drops `@esbuild-kit/esm-loader`; doing so
silently reintroduces the advisories. The `audit` job in CI guards against this.

Do not run `npm audit fix --force` here either, because it tries to downgrade
`drizzle-kit` to 0.18.1.

An earlier attempt at this override was recorded as producing an invalid dependency
tree. The cause was a stale `node_modules`/lockfile: npm reuses the existing tree and
will not apply a new override on top of it. Removing the affected subtree and letting
the lockfile regenerate resolves it cleanly, which is how the current tree was produced.

After changing `drizzle-kit`, re-run `npm audit`, `npm run lint`, and `npm run build`.

## Development Roadmap

### Completed ✅
- Project setup, auth, UI foundation
- Transaction, category, and budget management
- AI receipt scanning
- Analytics and reports (CSV export)
- Dark mode, PWA configuration
- PostgreSQL migration (Convex → Postgres + Drizzle)
- Recurring outgoings, debts/credits, loans given, investments tracking
- **Finance workspaces (Personal & Business) with data isolation**

### Next Up
- Bank integration
- Spending predictions
- Multi-user / household support

## Contributing

Contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup,
the checks CI runs, and how to handle database migrations.

Found a security issue? Please report it privately; see [SECURITY.md](SECURITY.md).

## License

Released under the [MIT License](LICENSE). You are free to use, modify, and
self-host Sika, including commercially.
