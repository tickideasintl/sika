import { sql } from "drizzle-orm";
import type { InterestBucket } from "@/lib/debt-interest";
import {
  boolean,
  check,
  date,
  decimal,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ─── Enums ───────────────────────────────────────────────────────────────────

export const workspaceTypeEnum = pgEnum("workspace_type", [
  "personal",
  "business",
]);

export const workspaceRoleEnum = pgEnum("workspace_role", [
  "owner",
  "editor",
  "viewer",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
  "income",
  "expense",
  "giving",
]);

export const transactionStatusEnum = pgEnum("transaction_status", [
  "pending",
  "cleared",
  "reconciled",
]);

export const financialAccountClassEnum = pgEnum("financial_account_class", [
  "asset",
  "liability",
]);

export const financialAccountTypeEnum = pgEnum("financial_account_type", [
  "checking",
  "savings",
  "cash",
  "credit_card",
  "loan",
  "other",
]);

export const budgetPeriodEnum = pgEnum("budget_period", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const outgoingFrequencyEnum = pgEnum("outgoing_frequency", [
  "monthly",
  "quarterly",
  "yearly",
]);

export const givingCommitmentFrequencyEnum = pgEnum("giving_commitment_frequency", [
  "one_time",
  "monthly",
  "quarterly",
  "yearly",
]);

export const debtTypeEnum = pgEnum("debt_type", [
  "credit_card",
  "loan",
  "mortgage",
  "overdraft",
  "other",
]);

export const loanStatusEnum = pgEnum("loan_status", [
  "active",
  "partially_repaid",
  "fully_repaid",
  "defaulted",
]);

export const investmentTypeEnum = pgEnum("investment_type", [
  "stock",
  "crypto",
  "forex",
  "property",
  "business",
  "savings",
  "other",
]);

export const investmentEventTypeEnum = pgEnum("investment_event_type", [
  "return",
  "dividend",
  "sale",
  "partial_sale",
  "loss",
  "fee",
]);

/**
 * How a cost carried for a client is expected to come back.
 *
 * `none` is the default and means the cost is the workspace's own overhead — an
 * AI subscription, an accountant, a tool nobody else pays for. Everything else
 * names a client and says what recovery to expect: `at_cost` the same figure,
 * `fixed` a marked-up `rebill_amount`, and `bundled` nothing separate because a
 * retainer already covers it. `bundled` still attributes the cost to the client
 * for margin; it just never reports the cost as unrecovered.
 */
export const rebillModeEnum = pgEnum("rebill_mode", [
  "none",
  "at_cost",
  "fixed",
  "bundled",
]);

// ─── Better Auth tables ──────────────────────────────────────────────────────

export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    emailVerified: boolean("email_verified").notNull().default(false),
    image: text("image"),
    /** @deprecated Superseded by workspaces.categoriesSeeded; no longer read or written. */
    categoriesSeeded: boolean("categories_seeded").notNull().default(false),
    onboardingCompleted: boolean("onboarding_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
);

export const sessions = pgTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_sessions_user_id").on(t.userId)],
);

export const accounts = pgTable(
  "accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
    scope: text("scope"),
    password: text("password"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_accounts_user_id").on(t.userId)],
);

export const verifications = pgTable(
  "verifications",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_verifications_identifier").on(t.identifier)],
);

// ─── Workspaces ─────────────────────────────────────────────────────────────

export const workspaces = pgTable(
  "workspaces",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: workspaceTypeEnum("type").notNull(),
    currency: text("currency").notNull().default("GBP"),
    envelopeBudgetingEnabled: boolean("envelope_budgeting_enabled").notNull().default(false),
    /**
     * Durable marker that default categories have been seeded into this
     * workspace, so renaming or deleting them never brings them back. Lives
     * here rather than on the user because every workspace needs its own set.
     */
    categoriesSeeded: boolean("categories_seeded").notNull().default(false),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_workspaces_user").on(t.userId),
    uniqueIndex("idx_workspaces_user_name").on(t.userId, t.name),
  ],
);

export const workspaceMemberships = pgTable(
  "workspace_memberships",
  {
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: workspaceRoleEnum("role").notNull().default("viewer"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({
      name: "workspace_memberships_workspace_user_pk",
      columns: [t.workspaceId, t.userId],
    }),
    index("idx_workspace_memberships_user_workspace").on(t.userId, t.workspaceId),
  ],
);

export const workspaceInvitations = pgTable(
  "workspace_invitations",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    role: workspaceRoleEnum("role").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    invitedByUserId: text("invited_by_user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    acceptedAt: timestamp("accepted_at", { withTimezone: true }),
    acceptedByUserId: text("accepted_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_workspace_invitations_workspace").on(t.workspaceId, t.createdAt),
    index("idx_workspace_invitations_email").on(t.email),
  ],
);

export const onboardingStatus = pgTable(
  "onboarding_status",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    hasCompleted: boolean("has_completed").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Onboarding is per workspace: each one has its own currency and first
  // budget. Keying on user_id alone let a second workspace's setup steal the
  // single row, so finishing setup never stuck and the other workspace's card
  // came back.
  (t) => [
    primaryKey({
      name: "onboarding_status_user_workspace_pk",
      columns: [t.userId, t.workspaceId],
    }),
    index("idx_onboarding_status_workspace").on(t.workspaceId),
  ],
);

/** Per-occurrence read state for notifications derived from live source records. */
export const notificationStates = pgTable(
  "notification_states",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    eventKey: text("event_key").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_notification_states_user_workspace_event").on(
      t.userId,
      t.workspaceId,
      t.eventKey,
    ),
  ],
);

/** Workspace-level opt-in for delivery outside the in-app inbox. */
export const pushNotificationPreferences = pgTable(
  "push_notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_push_notification_preferences_user_workspace").on(t.userId, t.workspaceId),
  ],
);

/** Workspace-level opt-in for notifications sent to the account email. */
export const emailNotificationPreferences = pgTable(
  "email_notification_preferences",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_email_notification_preferences_user_workspace").on(t.userId, t.workspaceId),
  ],
);

/** Browser push capability. Endpoints are secret bearer capabilities and never returned by APIs. */
export const pushSubscriptions = pgTable(
  "push_subscriptions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    endpoint: text("endpoint").notNull(),
    p256dh: text("p256dh").notNull(),
    auth: text("auth").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
    lastFailureAt: timestamp("last_failure_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_push_subscriptions_workspace_endpoint").on(t.workspaceId, t.endpoint),
    index("idx_push_subscriptions_workspace_enabled").on(t.workspaceId, t.enabled),
  ],
);

/** Per-device delivery state, separate from the user's in-app read state. */
export const notificationDeliveries = pgTable(
  "notification_deliveries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    subscriptionId: text("subscription_id")
      .references(() => pushSubscriptions.id, { onDelete: "cascade" }),
    destinationKey: text("destination_key").notNull(),
    eventKey: text("event_key").notNull(),
    channel: text("channel").notNull().default("web_push"),
    status: text("status").notNull().default("pending"),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_notification_deliveries_destination_event_channel").on(
      t.destinationKey,
      t.workspaceId,
      t.eventKey,
      t.channel,
    ),
    index("idx_notification_deliveries_workspace_status").on(t.workspaceId, t.status),
  ],
);

/** Last successful backup reported by an operator-controlled validation job. */
export const backupStatus = pgTable("backup_status", {
  id: text("id").primaryKey(),
  lastSuccessfulAt: timestamp("last_successful_at", { withTimezone: true }).notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const goalCategoryEnum = pgEnum("goal_category", [
  "emergency_fund",
  "savings",
  "debt_payoff",
  "giving",
  "travel",
  "home",
  "education",
  "business",
  "other",
]);

export const goalActivityTypeEnum = pgEnum("goal_activity_type", [
  "contribution",
  "spending",
]);

// ─── AI Provider Settings ───────────────────────────────────────────────────

export const aiProviderSettings = pgTable(
  "ai_provider_settings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    provider: text("provider").notNull().default("openai"),
    apiEndpoint: text("api_endpoint").notNull().default("https://api.openai.com/v1"),
    apiKey: text("api_key"), // encrypted at application level
    model: text("model").notNull().default("gpt-4o-mini"),
    isEnabled: boolean("is_enabled").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_ai_provider_settings_user").on(t.userId),
    uniqueIndex("idx_ai_provider_settings_user_unique").on(t.userId),
  ],
);

export const goals = pgTable(
  "goals",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: goalCategoryEnum("category").notNull().default("savings"),
    targetAmount: decimal("target_amount", { precision: 12, scale: 2 }).notNull(),
    currentAmount: decimal("current_amount", { precision: 12, scale: 2 }).notNull().default("0"),
    targetDate: date("target_date", { mode: "string" }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_goals_user_workspace").on(t.userId, t.workspaceId),
    index("idx_goals_workspace_active").on(t.workspaceId, t.isActive),
  ],
);

export const goalActivities = pgTable(
  "goal_activities",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    goalId: text("goal_id")
      .notNull()
      .references(() => goals.id, { onDelete: "cascade" }),
    type: goalActivityTypeEnum("type").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    occurredOn: date("occurred_on", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_goal_activities_goal_date").on(t.goalId, t.occurredOn),
    index("idx_goal_activities_workspace").on(t.workspaceId),
  ],
);

// ─── Clients / People ────────────────────────────────────────────────────────

/**
 * A party money moves *for*: a client in a business workspace, a person you
 * cover costs for in a personal one. One table, labelled by workspace type —
 * see `lib/party-labels.ts`.
 *
 * `workspace_id` is NOT NULL here, unlike the domain tables that predate
 * workspaces and had to stay nullable through the backfill. Nothing in this
 * feature has ever existed outside a workspace.
 */
export const clients = pgTable(
  "clients",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    contactEmail: text("contact_email"),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_clients_workspace_active").on(t.workspaceId, t.isActive),
    uniqueIndex("idx_clients_workspace_name").on(t.workspaceId, t.name),
  ],
);

// ─── Giving recipients ──────────────────────────────────────────────────────

export const givingRecipients = pgTable(
  "giving_recipients",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_giving_recipients_workspace_active").on(t.workspaceId, t.isActive),
    uniqueIndex("idx_giving_recipients_workspace_name").on(t.workspaceId, t.name),
  ],
);

export const givingDesignations = pgTable(
  "giving_designations",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => givingRecipients.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_giving_designations_recipient_active").on(t.recipientId, t.isActive),
    uniqueIndex("idx_giving_designations_recipient_name").on(t.recipientId, t.name),
  ],
);

export const givingCommitments = pgTable(
  "giving_commitments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recipientId: text("recipient_id")
      .notNull()
      .references(() => givingRecipients.id, { onDelete: "restrict" }),
    designationId: text("designation_id").references(() => givingDesignations.id, {
      onDelete: "restrict",
    }),
    name: text("name").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    frequency: givingCommitmentFrequencyEnum("frequency").notNull(),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_giving_commitments_workspace_active").on(t.workspaceId, t.isActive),
    index("idx_giving_commitments_recipient").on(t.recipientId, t.designationId),
    uniqueIndex("idx_giving_commitments_active_general_target")
      .on(t.workspaceId, t.recipientId)
      .where(sql`${t.isActive} and ${t.designationId} is null`),
    uniqueIndex("idx_giving_commitments_active_designated_target")
      .on(t.workspaceId, t.recipientId, t.designationId)
      .where(sql`${t.isActive} and ${t.designationId} is not null`),
    check("chk_giving_commitments_positive_amount", sql`${t.amount} > 0`),
    check(
      "chk_giving_commitments_date_order",
      sql`${t.endDate} is null or ${t.endDate} >= ${t.startDate}`,
    ),
  ],
);

// ─── Domain tables ───────────────────────────────────────────────────────────

export const financialAccounts = pgTable(
  "financial_accounts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    accountClass: financialAccountClassEnum("account_class").notNull(),
    accountType: financialAccountTypeEnum("account_type").notNull(),
    currency: text("currency").notNull(),
    openingBalance: decimal("opening_balance", { precision: 14, scale: 2 })
      .notNull()
      .default("0"),
    openingDate: date("opening_date", { mode: "string" }).notNull(),
    reconciledBalance: decimal("reconciled_balance", { precision: 14, scale: 2 }),
    reconciledAt: date("reconciled_at", { mode: "string" }),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_financial_accounts_workspace_active").on(t.workspaceId, t.isActive),
    uniqueIndex("idx_financial_accounts_workspace_name").on(t.workspaceId, t.name),
  ],
);

export const transactionImportProfiles = pgTable(
  "transaction_import_profiles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    financialAccountId: text("financial_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    mapping: jsonb("mapping")
      .$type<Record<string, string | null>>()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_transaction_import_profiles_account").on(t.financialAccountId),
    uniqueIndex("idx_transaction_import_profiles_account_name").on(
      t.workspaceId,
      t.financialAccountId,
      t.name,
    ),
  ],
);

export const transactionRules = pgTable(
  "transaction_rules",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    matchField: text("match_field").notNull(),
    matchValue: text("match_value").notNull(),
    transactionType: transactionTypeEnum("transaction_type"),
    category: text("category"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    markReviewed: boolean("mark_reviewed").notNull().default(false),
    isActive: boolean("is_active").notNull().default(true),
    priority: integer("priority").notNull().default(100),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_transaction_rules_workspace_active_priority").on(
      t.workspaceId,
      t.isActive,
      t.priority,
    ),
    uniqueIndex("idx_transaction_rules_workspace_name").on(t.workspaceId, t.name),
    check("chk_transaction_rules_match_field", sql`${t.matchField} in ('payee', 'notes')`),
    check(
      "chk_transaction_rules_has_action",
      sql`${t.isActive} = false or ${t.category} is not null or ${t.clientId} is not null or jsonb_array_length(${t.tags}) > 0 or ${t.markReviewed} = true`,
    ),
  ],
);

/**
 * Transfers are deliberately separate from transactions. Moving money between
 * accounts changes balances but is neither income, expense, nor giving, so it
 * must never enter those reports or budgets.
 */
export const accountTransfers = pgTable(
  "account_transfers",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    fromAccountId: text("from_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    toAccountId: text("to_account_id")
      .notNull()
      .references(() => financialAccounts.id, { onDelete: "restrict" }),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_account_transfers_workspace_date").on(t.workspaceId, t.date),
    index("idx_account_transfers_from_date").on(t.fromAccountId, t.date),
    index("idx_account_transfers_to_date").on(t.toAccountId, t.date),
    check(
      "chk_account_transfers_different_accounts",
      sql`${t.fromAccountId} <> ${t.toAccountId}`,
    ),
    check("chk_account_transfers_positive_amount", sql`${t.amount} > 0`),
  ],
);

export const transactions = pgTable(
  "transactions",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    accountId: text("account_id").references(() => financialAccounts.id, {
      onDelete: "set null",
    }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    date: date("date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    status: transactionStatusEnum("status").notNull().default("cleared"),
    needsReview: boolean("needs_review").notNull().default(false),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    category: text("category").notNull(),
    payee: text("payee"),
    // Attributes a one-off movement to a client: a project fee invoiced once, a
    // licence bought for them that will never recur. Recurring money lives on
    // `recurring_outgoings.client_id` instead. Deleting the client keeps the
    // money in the ledger and only drops the attribution.
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    givingRecipientId: text("giving_recipient_id").references(() => givingRecipients.id, {
      onDelete: "restrict",
    }),
    givingDesignationId: text("giving_designation_id").references(() => givingDesignations.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    tags: jsonb("tags").$type<string[]>().notNull().default(sql`'[]'::jsonb`),
    receiptStorageId: text("receipt_storage_id"),
    importFingerprint: text("import_fingerprint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_transactions_user_date").on(t.userId, t.date.desc()),
    index("idx_transactions_user_type_date").on(t.userId, t.type, t.date.desc()),
    index("idx_transactions_account_date").on(t.accountId, t.date.desc()),
    index("idx_transactions_workspace_review").on(t.workspaceId, t.needsReview, t.date.desc()),
    index("idx_transactions_workspace_assignee_review").on(
      t.workspaceId,
      t.assignedToUserId,
      t.needsReview,
    ),
    index("idx_transactions_workspace_client").on(t.workspaceId, t.clientId),
    index("idx_transactions_workspace_giving_recipient").on(
      t.workspaceId,
      t.givingRecipientId,
    ),
    check(
      "chk_transactions_giving_attribution",
      sql`(${t.givingRecipientId} is null and ${t.givingDesignationId} is null) or (${t.type} = 'giving' and ${t.givingRecipientId} is not null)`,
    ),
    uniqueIndex("idx_transactions_workspace_import_fingerprint").on(
      t.workspaceId,
      t.importFingerprint,
    ),
  ],
);

export const transactionReviewEvents = pgTable(
  "transaction_review_events",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    action: text("action").$type<"assigned" | "unassigned" | "reviewed" | "reopened">().notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, { onDelete: "set null" }),
    actorName: text("actor_name").notNull(),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id, {
      onDelete: "set null",
    }),
    assignedToName: text("assigned_to_name"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_transaction_review_events_transaction").on(t.transactionId, t.createdAt)],
);

// Upload provenance, independent of any user-editable transaction reference.
export const storedObjects = pgTable(
  "stored_objects",
  {
    storageKey: text("storage_key").primaryKey(),
    workspaceId: text("workspace_id").notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("idx_stored_objects_workspace").on(t.workspaceId)],
);

export const transactionDocuments = pgTable(
  "transaction_documents",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    fileName: text("file_name").notNull(),
    mimeType: text("mime_type"),
    sizeBytes: integer("size_bytes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_transaction_documents_workspace_transaction").on(
      t.workspaceId,
      t.transactionId,
    ),
    uniqueIndex("idx_transaction_documents_transaction_storage").on(
      t.transactionId,
      t.storageKey,
    ),
    check(
      "chk_transaction_documents_positive_size",
      sql`${t.sizeBytes} is null or ${t.sizeBytes} > 0`,
    ),
  ],
);

export const categories = pgTable(
  "categories",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    type: transactionTypeEnum("type").notNull(),
    color: text("color").notNull(),
    icon: text("icon"),
    isDefault: boolean("is_default").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  // Category names are unique per workspace, not per user. Without the
  // workspace in this key a second workspace could not hold its own copy of a
  // default like "Food & Dining", so seeding it was impossible.
  (t) => [
    uniqueIndex("idx_categories_workspace_type_name").on(
      t.userId,
      t.workspaceId,
      t.type,
      t.name,
    ),
  ],
);

export const budgets = pgTable(
  "budgets",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    period: budgetPeriodEnum("period").notNull().default("monthly"),
    startDate: date("start_date", { mode: "string" }).notNull(),
    endDate: date("end_date", { mode: "string" }).notNull(),
    type: transactionTypeEnum("type").notNull().default("expense"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_budgets_user_active").on(t.userId, t.isActive),
  ],
);

// ─── Recurring Outgoings ─────────────────────────────────────────────────────

export const recurringOutgoings = pgTable(
  "recurring_outgoings",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull().default("expense"),
    dayOfMonth: integer("day_of_month").notNull(), // 1-31
    frequency: outgoingFrequencyEnum("frequency").notNull().default("monthly"),
    category: text("category"), // optional grouping e.g. "Housing", "Utilities"
    vendor: text("vendor"), // who is paid, e.g. "Namecheap", "Anthropic"
    // Null client means this is the workspace's own overhead. A client plus a
    // rebill mode means the cost is fronted on their behalf.
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    givingRecipientId: text("giving_recipient_id").references(() => givingRecipients.id, {
      onDelete: "restrict",
    }),
    givingDesignationId: text("giving_designation_id").references(() => givingDesignations.id, {
      onDelete: "restrict",
    }),
    rebillMode: rebillModeEnum("rebill_mode").notNull().default("none"),
    rebillAmount: decimal("rebill_amount", { precision: 10, scale: 2 }), // required when mode is 'fixed'
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recurring_outgoings_user").on(t.userId, t.isActive),
    index("idx_recurring_outgoings_client").on(t.clientId),
    index("idx_recurring_outgoings_workspace_type").on(t.workspaceId, t.type, t.isActive),
    check("chk_recurring_outgoings_day_of_month", sql`${t.dayOfMonth} BETWEEN 1 AND 31`),
    // A rebill mode without a client would claim a recovery from nobody. The
    // ON DELETE SET NULL on client_id would violate this, so deleting a client
    // has to reset the mode first — see `clients.remove`.
    check(
      "chk_recurring_outgoings_rebill_client",
      sql`${t.rebillMode} = 'none' OR ${t.clientId} IS NOT NULL`,
    ),
    check(
      "chk_recurring_outgoings_rebill_amount",
      sql`${t.rebillMode} <> 'fixed' OR ${t.rebillAmount} IS NOT NULL`,
    ),
    check(
      "chk_recurring_outgoings_rebill_type",
      sql`${t.type} = 'expense' OR (${t.rebillMode} = 'none' AND ${t.rebillAmount} IS NULL)`,
    ),
    check(
      "chk_recurring_outgoings_giving_attribution",
      sql`(${t.givingRecipientId} IS NULL AND ${t.givingDesignationId} IS NULL) OR (${t.type} = 'giving' AND ${t.givingRecipientId} IS NOT NULL)`,
    ),
    check(
      "chk_recurring_outgoings_client_type",
      sql`${t.type} = 'expense' OR ${t.clientId} IS NULL`,
    ),
  ],
);

// ─── Recurring Money Occurrences ─────────────────────────────────────────────

/**
 * One recorded Recurring money occurrence. These are stable snapshots, not
 * ledger movements; Transactions settle them through the relation below.
 * The legacy database name stays internal to the Postgres implementation.
 */
export const recurringMoneyOccurrences = pgTable(
  "recurring_money_drafts",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    recurringMoneyId: text("recurring_money_id")
      .notNull()
      .references(() => recurringOutgoings.id, { onDelete: "restrict" }),
    name: text("name").notNull(),
    periodMonth: date("period_month", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }).notNull(),
    expectedAmount: decimal("expected_amount", { precision: 10, scale: 2 }).notNull(),
    type: transactionTypeEnum("type").notNull(),
    category: text("category"),
    payee: text("payee"),
    clientId: text("client_id").references(() => clients.id, { onDelete: "set null" }),
    givingRecipientId: text("giving_recipient_id").references(() => givingRecipients.id, {
      onDelete: "restrict",
    }),
    givingDesignationId: text("giving_designation_id").references(() => givingDesignations.id, {
      onDelete: "restrict",
    }),
    notes: text("notes"),
    rebillMode: rebillModeEnum("rebill_mode").notNull().default("none"),
    rebillAmount: decimal("rebill_amount", { precision: 10, scale: 2 }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("idx_recurring_money_drafts_period").on(t.recurringMoneyId, t.periodMonth),
    index("idx_recurring_money_drafts_workspace_due").on(
      t.workspaceId,
      t.periodMonth,
      t.dueDate,
    ),
    check(
      "chk_recurring_money_drafts_period_month_day",
      sql`EXTRACT(DAY FROM ${t.periodMonth}) = 1`,
    ),
    check("chk_recurring_money_drafts_positive_amount", sql`${t.expectedAmount} > 0`),
    check(
      "chk_recurring_money_drafts_giving_attribution",
      sql`(${t.givingRecipientId} IS NULL AND ${t.givingDesignationId} IS NULL) OR (${t.type} = 'giving' AND ${t.givingRecipientId} IS NOT NULL)`,
    ),
    check(
      "chk_recurring_money_drafts_client_type",
      sql`${t.type} = 'expense' OR ${t.clientId} IS NULL`,
    ),
  ],
);

/** Real ledger transactions allocated to an expected Recurring money occurrence. */
export const recurringMoneySettlements = pgTable(
  "recurring_money_draft_settlements",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    occurrenceId: text("draft_id")
      .notNull()
      .references(() => recurringMoneyOccurrences.id, { onDelete: "cascade" }),
    transactionId: text("transaction_id")
      .notNull()
      .references(() => transactions.id, { onDelete: "cascade" }),
    provenance: text("provenance").notNull().default("externally-created"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_recurring_money_draft_settlements_draft").on(t.occurrenceId),
    uniqueIndex("idx_recurring_money_draft_settlements_transaction").on(t.transactionId),
    check(
      "chk_recurring_money_draft_settlements_provenance",
      sql`${t.provenance} IN ('lifecycle-created', 'externally-created')`,
    ),
  ],
);

// ─── Debts & Credits ─────────────────────────────────────────────────────────

export const debtsCredits = pgTable(
  "debts_credits",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    financialAccountId: text("financial_account_id")
      .references(() => financialAccounts.id, { onDelete: "set null" }),
    name: text("name").notNull(), // e.g. "Barclays Credit Card", "Car Loan"
    debtType: debtTypeEnum("debt_type").notNull(),
    lender: text("lender"), // e.g. "Barclays", "Halifax"
    currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull(),
    creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }), // for credit cards
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }), // APR as advertised (EAR basis) %
    minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }),
    // Rule used only to forecast the next minimum when no statement exists yet.
    // FCA CONC 6.7.5R shape: interest + fees + percent% of outstanding, floored.
    // No default floor: it is currency-specific and the workspace may not be GBP.
    minPaymentPercent: decimal("min_payment_percent", { precision: 5, scale: 2 }).default("1.00"),
    minPaymentFloor: decimal("min_payment_floor", { precision: 10, scale: 2 }),
    paymentDayOfMonth: integer("payment_day_of_month"), // 1-31
    startDate: date("start_date", { mode: "string" }), // when the loan/credit started
    endDate: date("end_date", { mode: "string" }), // expected payoff date
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debts_credits_user").on(t.userId, t.isActive),
    uniqueIndex("idx_debts_credits_financial_account")
      .on(t.financialAccountId)
      .where(sql`${t.financialAccountId} is not null`),
    check(
      "chk_debts_credits_payment_day_of_month",
      sql`${t.paymentDayOfMonth} IS NULL OR ${t.paymentDayOfMonth} BETWEEN 1 AND 31`,
    ),
  ],
);

// Ad-hoc balance snapshots – "I checked my balance today". Payments live in
// `debt_payments` and statements in `debt_statements`; this table stays a pure
// point-in-time reading so nothing double-counts.
export const debtBalanceLogs = pgTable(
  "debt_balance_logs",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    balance: decimal("balance", { precision: 12, scale: 2 }).notNull(),
    notes: text("notes"),
    loggedAt: date("logged_at", { mode: "string" }).notNull(), // the date this snapshot is for
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_balance_logs_debt").on(t.debtId, t.loggedAt),
    index("idx_debt_balance_logs_user").on(t.userId),
  ],
);

// ─── Debt Payments ───────────────────────────────────────────────────────────

/**
 * One row per actual payment made against a debt. Single source of truth for
 * money paid out, so statements can reconcile against it without duplicating it.
 * Replaces the old `debt_balance_logs.payment_made` column.
 */
export const debtPayments = pgTable(
  "debt_payments",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
    paidAt: date("paid_at", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_payments_debt").on(t.debtId, t.paidAt),
    index("idx_debt_payments_user").on(t.userId, t.paidAt),
  ],
);

// ─── Debt Statements ─────────────────────────────────────────────────────────

/**
 * One row per billing cycle. Revolving debts (credit card, overdraft) fill
 * `new_spending` and `minimum_payment`; amortising debts (loan, mortgage) fill
 * `principal_paid` and `interest_paid` instead.
 *
 * `closing_balance` is authoritative for `debts_credits.current_balance` when it
 * is the newest record. `balance_subject_to_interest` mirrors Plaid's
 * `balance_subject_to_apr`: issuers charge on an average daily balance, so when
 * the statement prints that figure the derived rate is exact rather than
 * estimated.
 */
export const debtStatements = pgTable(
  "debt_statements",
  {
    id: text("id").primaryKey(),
    debtId: text("debt_id")
      .notNull()
      .references(() => debtsCredits.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    periodStart: date("period_start", { mode: "string" }).notNull(),
    periodEnd: date("period_end", { mode: "string" }).notNull(),
    statementDate: date("statement_date", { mode: "string" }).notNull(),
    dueDate: date("due_date", { mode: "string" }),
    openingBalance: decimal("opening_balance", { precision: 12, scale: 2 }).notNull(),
    closingBalance: decimal("closing_balance", { precision: 12, scale: 2 }).notNull(),
    interestCharged: decimal("interest_charged", { precision: 10, scale: 2 })
      .notNull()
      .default("0"),
    feesCharged: decimal("fees_charged", { precision: 10, scale: 2 }).notNull().default("0"),
    newSpending: decimal("new_spending", { precision: 12, scale: 2 }), // revolving only
    minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }), // revolving only
    balanceSubjectToInterest: decimal("balance_subject_to_interest", {
      precision: 12,
      scale: 2,
    }),
    principalPaid: decimal("principal_paid", { precision: 10, scale: 2 }), // amortising only
    interestPaid: decimal("interest_paid", { precision: 10, scale: 2 }), // amortising only
    // Per-APR buckets; when present, interest/basis columns are the bucket sums.
    interestBreakdown: jsonb("interest_breakdown").$type<InterestBucket[]>(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_debt_statements_debt").on(t.debtId, t.periodEnd),
    index("idx_debt_statements_user").on(t.userId, t.dueDate),
    uniqueIndex("uq_debt_statements_debt_period").on(t.debtId, t.periodEnd),
    check("chk_debt_statements_period", sql`${t.periodEnd} >= ${t.periodStart}`),
  ],
);

// ─── Loans Given (Receivables) ───────────────────────────────────────────────

export const loansGiven = pgTable(
  "loans_given",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    borrowerName: text("borrower_name").notNull(),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    outstandingBalance: decimal("outstanding_balance", { precision: 12, scale: 2 }).notNull(),
    loanDate: date("loan_date", { mode: "string" }).notNull(),
    expectedPaybackDate: date("expected_payback_date", { mode: "string" }),
    status: loanStatusEnum("status").notNull().default("active"),
    /** Monthly rate charged to the borrower. Null means no interest agreed. */
    interestRate: decimal("interest_rate", { precision: 5, scale: 2 }),
    /**
     * Date interest stopped accruing, set when the loan is written off. Without
     * it a defaulted loan would keep charging indefinitely, and `updated_at`
     * cannot stand in: editing a note years later would silently inflate the
     * frozen figure. Cleared if the loan leaves `defaulted`.
     */
    accrualStoppedOn: date("accrual_stopped_on", { mode: "string" }),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_loans_given_user").on(t.userId, t.status),
  ],
);

export const loanRepayments = pgTable(
  "loan_repayments",
  {
    id: text("id").primaryKey(),
    loanId: text("loan_id")
      .notNull()
      .references(() => loansGiven.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    amount: decimal("amount", { precision: 12, scale: 2 }).notNull(),
    repaymentDate: date("repayment_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_loan_repayments_loan").on(t.loanId, t.repaymentDate),
    index("idx_loan_repayments_user").on(t.userId),
  ],
);

// ─── Investments & Assets ────────────────────────────────────────────────────

export const investments = pgTable(
  "investments",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    investmentType: investmentTypeEnum("investment_type").notNull(),
    platform: text("platform"),
    costBasis: decimal("cost_basis", { precision: 14, scale: 2 }).notNull(),
    currentValue: decimal("current_value", { precision: 14, scale: 2 }).notNull(),
    quantity: decimal("quantity", { precision: 18, scale: 8 }),
    purchaseDate: date("purchase_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_investments_user").on(t.userId, t.isActive),
  ],
);

export const investmentEvents = pgTable(
  "investment_events",
  {
    id: text("id").primaryKey(),
    investmentId: text("investment_id")
      .notNull()
      .references(() => investments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventType: investmentEventTypeEnum("event_type").notNull(),
    amount: decimal("amount", { precision: 14, scale: 2 }).notNull(),
    eventDate: date("event_date", { mode: "string" }).notNull(),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("idx_investment_events_investment").on(t.investmentId, t.eventDate),
    index("idx_investment_events_user").on(t.userId),
  ],
);
