/* global process, console, setTimeout */

import { Client } from "pg";

const REQUIRED_TABLES = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "transactions",
  "stored_objects",
  "transaction_review_events",
  "categories",
  "budgets",
  "recurring_outgoings",
  "debts_credits",
  "debt_balance_logs",
  "loans_given",
  "loan_repayments",
  "investments",
  "investment_events",
  "workspaces",
  "workspace_memberships",
  "workspace_invitations",
  "notification_states",
  "email_notification_preferences",
  "push_notification_preferences",
  "push_subscriptions",
  "notification_deliveries",
  "backup_status",
];

// Columns that guarantee latest migrations have been applied.
const REQUIRED_COLUMNS = [
  { table: "transactions", column: "receipt_storage_id" },
  { table: "stored_objects", column: "storage_key" },
  { table: "stored_objects", column: "workspace_id" },
  { table: "transactions", column: "date" },
  { table: "transactions", column: "assigned_to_user_id" },
  { table: "transaction_review_events", column: "actor_name" },
  { table: "budgets", column: "start_date" },
  { table: "budgets", column: "end_date" },
  { table: "recurring_outgoings", column: "day_of_month" },
  { table: "debts_credits", column: "current_balance" },
  { table: "loans_given", column: "outstanding_balance" },
  { table: "investments", column: "current_value" },
  // migration 0009 — workspaces
  { table: "workspaces", column: "type" },
  { table: "workspace_memberships", column: "role" },
  { table: "workspace_invitations", column: "token_hash" },
  { table: "transactions", column: "workspace_id" },
  { table: "categories", column: "workspace_id" },
  { table: "budgets", column: "workspace_id" },
  { table: "recurring_outgoings", column: "workspace_id" },
  { table: "debts_credits", column: "workspace_id" },
  { table: "loans_given", column: "workspace_id" },
  { table: "investments", column: "workspace_id" },
  { table: "push_notification_preferences", column: "enabled" },
  { table: "push_subscriptions", column: "endpoint" },
  { table: "notification_deliveries", column: "event_key" },
  { table: "notification_deliveries", column: "destination_key" },
  { table: "backup_status", column: "last_successful_at" },
  // migration 0042 — loan interest accrual freeze
  { table: "loans_given", column: "accrual_stopped_on" },
];

const REQUIRED_INDEXES = ["idx_workspace_memberships_user_workspace"];

const RETRIES = Number(process.env.DB_SCHEMA_CHECK_RETRIES ?? "20");
const RETRY_DELAY_MS = Number(process.env.DB_SCHEMA_CHECK_RETRY_DELAY_MS ?? "2000");

if (process.env.SKIP_DB_SCHEMA_CHECK === "true") {
  console.log("[db-check] SKIP_DB_SCHEMA_CHECK=true, skipping schema verification.");
  process.exit(0);
}

if (!process.env.DATABASE_URL) {
  console.error("[db-check] DATABASE_URL is not set. Refusing to start.");
  process.exit(1);
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function connectWithRetry() {
  let lastError;

  for (let attempt = 1; attempt <= RETRIES; attempt += 1) {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    try {
      await client.connect();
      console.log(`[db-check] Connected to database on attempt ${attempt}/${RETRIES}.`);
      return client;
    } catch (error) {
      lastError = error;
      console.warn(`[db-check] DB connection attempt ${attempt}/${RETRIES} failed.`);
      try {
        await client.end();
      } catch {
        // ignore close errors
      }
      if (attempt < RETRIES) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  throw lastError;
}

async function verifySchema(client) {
  const missingTables = [];

  for (const table of REQUIRED_TABLES) {
    const result = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = $1
      ) AS exists
    `,
      [table]
    );

    if (!result.rows[0]?.exists) {
      missingTables.push(table);
    }
  }

  const missingColumns = [];

  for (const item of REQUIRED_COLUMNS) {
    const result = await client.query(
      `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = $1
          AND column_name = $2
      ) AS exists
    `,
      [item.table, item.column]
    );

    if (!result.rows[0]?.exists) {
      missingColumns.push(`${item.table}.${item.column}`);
    }
  }

  const missingIndexes = [];

  for (const index of REQUIRED_INDEXES) {
    const result = await client.query(
      `
      SELECT COALESCE(
        table_rel.relname = 'workspace_memberships'
          AND pg_get_indexdef(i.indexrelid) LIKE '%(user_id, workspace_id)%',
        false
      ) AS valid
      FROM pg_class index_rel
      JOIN pg_index i ON i.indexrelid = index_rel.oid
      JOIN pg_class table_rel ON table_rel.oid = i.indrelid
      WHERE index_rel.oid = to_regclass($1)
    `,
      [`public.${index}`]
    );

    if (!result.rows[0]?.valid) {
      missingIndexes.push(index);
    }
  }

  const migrationsTableResult = await client.query(
    `
      SELECT COALESCE(
        to_regclass('drizzle.__drizzle_migrations')::text,
        to_regclass('public.__drizzle_migrations')::text
      ) AS name
    `
  );

  if (!migrationsTableResult.rows[0]?.name) {
    throw new Error(
      "Missing drizzle.__drizzle_migrations table. Run migrations before starting the app."
    );
  }

  if (missingTables.length || missingColumns.length || missingIndexes.length) {
    const details = [
      missingTables.length
        ? `Missing tables: ${missingTables.join(", ")}`
        : null,
      missingColumns.length
        ? `Missing columns: ${missingColumns.join(", ")}`
        : null,
      missingIndexes.length
        ? `Missing indexes: ${missingIndexes.join(", ")}`
        : null,
    ]
      .filter(Boolean)
      .join(" | ");

    throw new Error(
      `${details}. Database schema is not up-to-date. Run migrations before deploy.`
    );
  }
}

async function main() {
  let client;
  try {
    client = await connectWithRetry();
    await verifySchema(client);
    console.log("[db-check] Schema verification passed.");
  } finally {
    if (client) {
      await client.end();
    }
  }
}

main().catch((error) => {
  console.error("[db-check] Startup blocked:", error instanceof Error ? error.message : error);
  console.error("[db-check] Run migrations first, then restart the app.");
  process.exit(1);
});
