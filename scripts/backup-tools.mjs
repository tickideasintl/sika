/* global process, URL */

import { spawn } from "node:child_process";
import { stat } from "node:fs/promises";
import { devNull } from "node:os";

export const REQUIRED_BACKUP_TABLES = [
  "users",
  "sessions",
  "accounts",
  "verifications",
  "workspaces",
  "workspace_memberships",
  "workspace_invitations",
  "onboarding_status",
  "notification_states",
  "push_notification_preferences",
  "email_notification_preferences",
  "push_subscriptions",
  "notification_deliveries",
  "backup_status",
  "ai_provider_settings",
  "goals",
  "goal_activities",
  "clients",
  "giving_recipients",
  "giving_designations",
  "giving_commitments",
  "financial_accounts",
  "transaction_import_profiles",
  "transaction_rules",
  "account_transfers",
  "transactions",
  "transaction_review_events",
  "transaction_documents",
  "stored_objects",
  "categories",
  "budgets",
  "recurring_outgoings",
  "recurring_money_drafts",
  "recurring_money_draft_settlements",
  "debts_credits",
  "debt_balance_logs",
  "debt_payments",
  "debt_statements",
  "loans_given",
  "loan_repayments",
  "investments",
  "investment_events",
];

function decodeUrlPart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function postgresConnection(databaseUrl) {
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new Error("Database URL is invalid");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new Error("Database URL must use postgres:// or postgresql://");
  }

  const databaseName = decodeUrlPart(parsed.pathname.replace(/^\//, ""));
  if (!parsed.hostname || !databaseName) {
    throw new Error("Database URL must include a host and database name");
  }

  /** @type {Record<string, string | undefined>} */
  const env = {
    ...process.env,
    PGHOST: parsed.hostname,
    PGPORT: parsed.port || "5432",
    PGUSER: decodeUrlPart(parsed.username),
    PGPASSWORD: decodeUrlPart(parsed.password),
    PGDATABASE: databaseName,
  };
  const queryEnvironment = {
    sslmode: "PGSSLMODE",
    sslcert: "PGSSLCERT",
    sslkey: "PGSSLKEY",
    sslrootcert: "PGSSLROOTCERT",
    application_name: "PGAPPNAME",
    options: "PGOPTIONS",
  };
  for (const [queryName, environmentName] of Object.entries(queryEnvironment)) {
    const value = parsed.searchParams.get(queryName);
    if (value) env[environmentName] = value;
  }

  return { databaseName, env };
}

export function assertArchiveToc(toc) {
  const missing = REQUIRED_BACKUP_TABLES.filter((table) => {
    const escaped = table.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return !new RegExp(`\\bTABLE\\s+public\\s+${escaped}\\b`).test(toc);
  });
  if (missing.length > 0) {
    throw new Error(`Backup is missing required tables: ${missing.join(", ")}`);
  }
  if (!/\bTABLE\s+(?:drizzle|public)\s+__drizzle_migrations\b/.test(toc)) {
    throw new Error("Backup is missing the Drizzle migration journal");
  }
}

export function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: options.env ?? process.env,
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", (chunk) => {
        stdout += chunk;
      });
      child.stderr.on("data", (chunk) => {
        stderr += chunk;
      });
    }
    child.on("error", (error) => {
      reject(
        error.code === "ENOENT"
          ? new Error(`${command} was not found. Install the PostgreSQL 16 client tools.`)
          : error,
      );
    });
    child.on("exit", (code) => {
      if (code === 0) {
        resolve({ stdout, stderr });
      } else {
        reject(new Error(`${command} exited with code ${code}${stderr ? `: ${stderr.trim()}` : ""}`));
      }
    });
  });
}

export async function validateBackupArchive(archivePath) {
  const archive = await stat(archivePath).catch(() => null);
  if (!archive?.isFile() || archive.size === 0) {
    throw new Error(`Backup archive is missing or empty: ${archivePath}`);
  }

  const pgRestore = process.env.PG_RESTORE_BIN || "pg_restore";
  const { stdout: toc } = await runCommand(pgRestore, ["--list", archivePath], {
    capture: true,
  });
  assertArchiveToc(toc);
  await runCommand(pgRestore, ["--file", devNull, archivePath]);
  return { sizeBytes: archive.size };
}

export function positionalArgument(args, flagNames = []) {
  return args.find((argument, index) => {
    if (argument.startsWith("-")) return false;
    return index === 0 || !flagNames.includes(args[index - 1]);
  });
}

export function flagValue(args, name) {
  const index = args.indexOf(name);
  if (index < 0) return null;
  const value = args[index + 1];
  if (!value || value.startsWith("-")) throw new Error(`${name} requires a value`);
  return value;
}
