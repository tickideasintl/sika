# Contributing to Sika

Thanks for considering a contribution. Sika is a self-hosted personal finance
manager, and contributions of any size are welcome.

## Getting set up

You need Node.js (see `.nvmrc`, currently 24.22.1) and PostgreSQL 16+.

```bash
git clone https://github.com/tickideasintl/sika.git
cd sika
npm install
cp .env.example .env.local
```

Fill in `DATABASE_URL` and `BETTER_AUTH_SECRET` in `.env.local`. Generate the
secret with `openssl rand -base64 32`. `OPENAI_API_KEY` and the `S3_*` variables
are optional; leave them unset unless you are working on receipt scanning.

Apply migrations, then start the dev server:

```bash
npm run db:migrate
npm run dev
```

If you would rather not install Postgres locally, `docker compose up db` starts
one matching the default `DATABASE_URL`.

## Before opening a pull request

Run the same checks CI runs:

```bash
npm run lint
npx tsc --noEmit
npm test
npm run build
```

All four must pass. `npm test` runs the unit tests anywhere; the database-backed
integration tests skip themselves unless `DATABASE_URL` points at a migrated
Postgres, which is what CI provides. To run them locally, start the bundled
database with `docker compose up db` and apply migrations first.

Coverage is partial, so please also describe how you verified your change by hand.

## Database changes

Schema lives in `db/schema.ts`. Never hand-edit files in `db/migrations/`.

```bash
npm run db:generate   # after editing db/schema.ts
npm run db:migrate    # apply locally
```

Commit the generated migration alongside the schema change. Migrations run
automatically on container startup, so they must be safe to apply to an existing
database with real data. Prefer additive changes, and make destructive ones a
separate, clearly flagged pull request.

## Commit messages

The project follows [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add recurring transaction reminders
fix: correct budget rollover across year boundaries
chore(deps): update dependencies
docs: clarify self-hosting steps
```

## Dependency updates

Two constraints are easy to trip over:

- **`@types/node` tracks the Node runtime major**, not the newest published
  major. If `.nvmrc` says 24.x, `@types/node` stays on 24.x.
- **The `overrides` block in `package.json` is load-bearing.** It suppresses
  GHSA-67mh-4wv8-2f99 in a transitive `drizzle-kit` dependency. Removing it
  reintroduces the advisory, and CI will fail. See the README for details.

## Scope

Sika deliberately covers personal and small-business finance, including
faith-based giving categories such as tithes and partnership. Features serving
that use case are in scope. Bank integrations, multi-currency, and reporting
improvements are welcome; please open an issue to discuss larger changes before
building them.

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md).
