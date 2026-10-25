# Sika - Dokploy Deployment Guide

> For a more detailed walkthrough, see [docs/SETUP.md](docs/SETUP.md#dokploy-deployment).

## Prerequisites

1. A running Dokploy instance
2. A PostgreSQL 16+ service (use Dokploy's built-in Postgres template)
3. (Optional) MinIO or S3-compatible storage for receipt images

## Deployment Steps

### Step 1: Create Services

1. **PostgreSQL** — Dokploy → Create Service → Database → PostgreSQL.
2. **Application** — Dokploy → Create Service → Application → Docker.
   - Connect your Git repository, select branch.
   - Dockerfile path: `Dockerfile`, context: `.`

### Step 2: Set Environment Variables

**Runtime env vars** (Application → Environment):

```
DATABASE_URL=postgresql://postgres:pw@sika-db:5432/sika
BETTER_AUTH_SECRET=<openssl rand -base64 32>
SIKA_SETUP_TOKEN=<openssl rand -hex 32>
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
OPENAI_API_KEY=your_openai_api_key

# S3 storage (optional)
S3_ENDPOINT=http://minio:9000
S3_BUCKET=sika-receipts
S3_REGION=us-east-1
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
```

Keep `SIKA_SETUP_TOKEN` server-only. Configure proxies and observability tools to
redact the `x-sika-setup-token` request header; never put the token in a URL or a
`NEXT_PUBLIC_*` variable.

**Build args** (Application → Build):

```
NEXT_PUBLIC_SITE_URL=https://your-app-domain.com
```

### Step 3: Automatic Migration on Startup (Enabled)

For single-service Dockerfile deploys, the app now runs migrations automatically
on startup before serving traffic:

1. `node auto-migrate.mjs` (with PostgreSQL advisory lock)
2. `node verify-db-schema.mjs` (schema gate)
3. `node server.js`

This means you do **not** need to run migrations locally first for normal deploys.

> Recommended: keep this enabled in production:
> - `SKIP_DB_AUTO_MIGRATE=false`
> - `SKIP_DB_SCHEMA_CHECK=false`

If your DB is inaccessible at startup, the container will fail fast and restart
until connectivity is restored.

The one-account registration migration deliberately stops if `users` already has
multiple rows. Back up the database and reconcile those accounts before redeploying;
the migration never deletes or chooses an account automatically.

### Step 4: Configure Domain & SSL

1. Go to **Domains** tab.
2. Add your custom domain.
3. Enable HTTPS (Let's Encrypt).
4. Container port: `3000`.

### Step 5: Deploy

Click **Deploy** and monitor build logs.

### Step 6: Verify and Install the PWA

PWA installation requires the final HTTPS domain; it will not be offered from an
insecure public HTTP URL.

1. Open the deployed domain and confirm `/manifest.json`, `/sw.js`, and both app
   icons return HTTP 200.
2. In Chrome or Edge, choose **Install Sika** from the address bar or browser menu.
3. On iPhone or iPad, open the site in Safari and choose **Share → Add to Home Screen**.
4. Launch Sika from the installed icon and confirm it opens without browser chrome.
5. Disconnect the device and reload. Sika should show its offline screen without
   displaying previously loaded financial data; reconnect and choose **Try again**.

The service worker caches only public PWA assets and immutable Next.js code. It does
not cache authenticated pages, API responses, transactions, or receipt data.

### Production Protocol Checklist

Use the exact command/order runbook here:
- [docs/PROD_GO_LIVE_CHECKLIST.md](docs/PROD_GO_LIVE_CHECKLIST.md)

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | Yes | Auth secret (`openssl rand -base64 32`) |
| `SIKA_SETUP_TOKEN` | Yes | First-account setup secret (`openssl rand -hex 32`) |
| `NEXT_PUBLIC_SITE_URL` | Yes | Public app URL (for auth callbacks & metadata) |
| `WEB_PUSH_VAPID_PUBLIC_KEY` | No | VAPID public key for browser reminders |
| `WEB_PUSH_VAPID_PRIVATE_KEY` | No | VAPID private key (keep secret) |
| `WEB_PUSH_VAPID_SUBJECT` | No | Operator contact URI, e.g. `mailto:admin@example.com` |
| `NOTIFICATION_DISPATCH_TOKEN` | No | Bearer token protecting the cron dispatcher |
| `BACKUP_REPORT_TOKEN` | No | Bearer token for a validated backup job to report success |
| `SMTP_URL` | No | SMTP connection URL; URL-encode credentials |
| `SMTP_FROM` | No | Sender mailbox, e.g. `Sika <sika@example.com>` |
| `OPENAI_API_KEY` | No | For AI-powered receipt scanning; only sent to `https://api.openai.com` |
| `SIKA_ALLOW_PRIVATE_AI_ENDPOINTS` | No | `true` allows http:// and private-network AI endpoints (e.g. local Ollama); trusted installs only |
| `S3_ENDPOINT` | No | S3/MinIO endpoint URL |
| `S3_BUCKET` | No | Storage bucket name |
| `S3_REGION` | No | Bucket region |
| `S3_ACCESS_KEY_ID` | No | S3 access key |
| `S3_SECRET_ACCESS_KEY` | No | S3 secret key |
| `S3_PUBLIC_URL` | No | Public CDN prefix for stored files |
| `SKIP_DB_AUTO_MIGRATE` | No | Keep `false` in production (enable auto migration) |
| `DB_MIGRATE_RETRIES` | No | DB connection retries for auto-migrate (default 20) |
| `DB_MIGRATE_RETRY_DELAY_MS` | No | Delay between migrate retries in ms (default 2000) |
| `SKIP_DB_SCHEMA_CHECK` | No | Keep `false` in production (enable startup schema gate) |
| `DB_SCHEMA_CHECK_RETRIES` | No | DB readiness retries for schema check (default 20) |
| `DB_SCHEMA_CHECK_RETRY_DELAY_MS` | No | Delay between schema-check retries in ms (default 2000) |

To deliver optional browser or email reminders, configure Web Push and/or SMTP,
then create an hourly system cron job that sends `POST` to
`$NEXT_PUBLIC_SITE_URL/api/notifications/dispatch` with
`Authorization: Bearer $NOTIFICATION_DISPATCH_TOKEN`. Keep the token in the
header rather than a query string so proxies do not record it in URLs.

To enable backup status monitoring, generate `BACKUP_REPORT_TOKEN` independently.
After your external backup job has successfully created and validated its archive,
send `POST` to `$NEXT_PUBLIC_SITE_URL/api/backup-status/report` with
`Authorization: Bearer $BACKUP_REPORT_TOKEN`. Do not report before validation:
Sika records the report as evidence of success but does not create the backup.
When monitoring is configured, Sika alerts through the default workspace after
48 hours without a reported success.

## Troubleshooting

### Build fails
- Ensure `NEXT_PUBLIC_SITE_URL` is set in build args.

### Database connection errors
- Verify `DATABASE_URL` uses the correct internal hostname for the Postgres service.
- Ensure the database has been created.

### Authentication issues
- Verify `NEXT_PUBLIC_SITE_URL` matches your actual domain.
- Ensure `BETTER_AUTH_SECRET` is set.
- If setup is unavailable on an empty database, ensure `SIKA_SETUP_TOKEN` is set.

### Health check failing
The app may take 30-60 seconds to start. Increase the health check `start_period` if needed.

## Updating

1. Push changes to your repository.
2. In Dokploy, click **Redeploy** (or enable auto-deploy from git).
3. Confirm logs show successful `db-migrate` and `db-check` steps.

## Architecture

```
┌─────────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Next.js Container  │────▶│  PostgreSQL   │     │  S3 / MinIO  │
│  (App + API routes) │     │  (persistent) │     │  (receipts)  │
└─────────────────────┘     └──────────────┘     └──────────────┘
```

All services run on a single Dokploy host. No external SaaS dependencies required (except OpenAI for receipt scanning).
