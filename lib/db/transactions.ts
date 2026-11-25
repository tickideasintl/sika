import { createHash } from "node:crypto";
import { and, desc, eq, gte, ilike, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  transactionDocuments,
  transactionReviewEvents,
  transactions,
  users,
  workspaceMemberships,
} from "@/db/schema";
import * as clientsService from "./clients";
import * as financialAccountsService from "./financial-accounts";
import * as givingRecipientsService from "./giving-recipients";
import * as recurringMoneyOccurrences from "@/lib/recurring-money-occurrences";
import * as transactionRulesService from "./transaction-rules";
import { lockWorkspaceLedger, type LedgerReader } from "./ledger-lock";
import { ownerUserId } from "./workspaces";
import { assertStoredObjectInWorkspace } from "./stored-objects";
import {
  idSchema,
  limitSchema,
  pageSchema,
  pageSizeSchema,
  transactionCreateSchema,
  transactionBulkUpdateSchema,
  transactionUpdateSchema,
  transactionListFiltersSchema,
  workspaceIdSchema,
} from "./validation";

// ─── Types ───────────────────────────────────────────────────────────────────

type TransactionType = "expense" | "giving" | "income";
type TransactionStatus = "pending" | "cleared" | "reconciled";

export class GivingAttributionError extends Error {}

async function assertGivingAttribution(
  workspaceId: string,
  type: TransactionType,
  clientId?: string | null,
  recipientId?: string | null,
  designationId?: string | null,
  executor: LedgerReader = db,
) {
  if (clientId && type === "giving") {
    throw new GivingAttributionError("Clients cannot be assigned to giving transactions");
  }
  if (!recipientId && !designationId) return;
  if (type !== "giving" || !recipientId) {
    throw new GivingAttributionError(
      "Giving attribution can only be assigned to giving transactions",
    );
  }
  await givingRecipientsService.assertRecipientInWorkspace(workspaceId, recipientId, executor);
  if (designationId) {
    await givingRecipientsService.assertDesignationInWorkspace(
      workspaceId,
      designationId,
      recipientId,
      executor,
    );
  }
}

export interface ListFilters {
  type?: TransactionType;
  accountId?: string;
  status?: TransactionStatus;
  needsReview?: boolean;
  assignedToUserId?: string | null;
  category?: string;
  clientId?: string;
  tag?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedFilters extends ListFilters {
  limit: number;
  cursor?: string; // createdAt ISO cursor for keyset pagination
}

export interface CreateInput {
  amount: number;
  date: string;
  type: TransactionType;
  accountId?: string | null;
  status?: TransactionStatus;
  category: string;
  payee?: string | null;
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  notes?: string | null;
  tags?: string[];
  receiptStorageId?: string | null;
}

export interface UpdateInput {
  amount?: number;
  date?: string;
  type?: TransactionType;
  accountId?: string | null;
  status?: TransactionStatus;
  needsReview?: boolean;
  assignedToUserId?: string | null;
  category?: string;
  payee?: string | null;
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  notes?: string | null;
  tags?: string[];
  receiptStorageId?: string | null;
}

export interface ImportInput {
  lineNumber: number;
  amount: number;
  date: string;
  type: TransactionType;
  category: string;
  payee: string | null;
  notes: string | null;
  tags: string[];
  externalId: string | null;
  clientId?: string | null;
  givingRecipientId?: string | null;
  givingDesignationId?: string | null;
  needsReview?: boolean;
}

interface ImportCandidate
  extends ImportInput,
    recurringMoneyOccurrences.ValidatedImportCandidate {
  fingerprint: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function genId() {
  return crypto.randomUUID();
}

async function reviewParticipant(workspaceId: string, userId: string) {
  const [participant] = await db
    .select({ id: users.id, name: users.name })
    .from(workspaceMemberships)
    .innerJoin(users, eq(users.id, workspaceMemberships.userId))
    .where(
      and(
        eq(workspaceMemberships.workspaceId, workspaceId),
        eq(workspaceMemberships.userId, userId),
        ne(workspaceMemberships.role, "viewer"),
      ),
    )
    .limit(1);
  if (!participant) throw new Error("Reviewer must be an owner or editor in this workspace");
  return participant;
}

function normalizedImportIdentity(row: ImportInput) {
  if (row.externalId) {
    return `external:${row.externalId.trim().toLowerCase()}`;
  }
  return [
    row.date,
    row.amount.toFixed(2),
    row.type,
    row.notes?.trim().toLowerCase().replace(/\s+/g, " ") ?? "",
  ].join("|");
}

function prepareImportCandidates(accountId: string | null, rows: ImportInput[]) {
  const occurrences = new Map<string, number>();
  return rows.map((row): ImportCandidate => {
    const identity = normalizedImportIdentity(row);
    const occurrence = row.externalId ? 0 : (occurrences.get(identity) ?? 0);
    occurrences.set(identity, occurrence + 1);
    const fingerprint = createHash("sha256")
      .update(`${accountId ?? "unassigned"}|${identity}|${occurrence}`)
      .digest("hex");
    return { ...row, fingerprint };
  });
}

async function validateImport(
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  workspaceIdSchema.parse(workspaceId);
  if (accountId) {
    const account = await financialAccountsService.assertInWorkspace(
      workspaceId,
      accountId,
    );
    for (const row of rows) {
      financialAccountsService.assertDateIsOpen(account, row.date);
    }
  }
  for (const row of rows) {
    transactionCreateSchema.parse(row);
    await assertGivingAttribution(
      workspaceId,
      row.type,
      row.clientId,
      row.givingRecipientId,
      row.givingDesignationId,
    );
  }
  const classifiedRows = await transactionRulesService.applyToImportRows(
    workspaceId,
    rows,
  );
  return prepareImportCandidates(accountId, classifiedRows);
}

function buildWhere(workspaceId: string, filters: ListFilters) {
  const conditions = [
    eq(transactions.workspaceId, workspaceId),
  ];

  if (filters.type) conditions.push(eq(transactions.type, filters.type));
  if (filters.accountId) conditions.push(eq(transactions.accountId, filters.accountId));
  if (filters.status) conditions.push(eq(transactions.status, filters.status));
  if (filters.needsReview !== undefined) {
    conditions.push(eq(transactions.needsReview, filters.needsReview));
  }
  if (filters.assignedToUserId !== undefined) {
    conditions.push(
      filters.assignedToUserId === null
        ? isNull(transactions.assignedToUserId)
        : eq(transactions.assignedToUserId, filters.assignedToUserId),
    );
  }
  if (filters.category) conditions.push(eq(transactions.category, filters.category));
  if (filters.clientId) conditions.push(eq(transactions.clientId, filters.clientId));
  if (filters.tag) conditions.push(sql`${transactions.tags} @> ${JSON.stringify([filters.tag])}::jsonb`);
  if (filters.startDate) conditions.push(gte(transactions.date, filters.startDate));
  if (filters.endDate) conditions.push(lte(transactions.date, filters.endDate));
  if (filters.search) {
    const pattern = `%${filters.search}%`;
    conditions.push(
      or(
        ilike(transactions.category, pattern),
        ilike(transactions.payee, pattern),
        ilike(transactions.notes, pattern),
        sql`EXISTS (
          SELECT 1
          FROM jsonb_array_elements_text(${transactions.tags}) AS tag
          WHERE tag ILIKE ${pattern}
        )`,
      )!,
    );
  }

  return and(...conditions);
}

// ─── Service functions ───────────────────────────────────────────────────────

/** Full list with optional filters, ordered newest-first. */
export async function list(workspaceId: string, filters: ListFilters = {}) {
  workspaceIdSchema.parse(workspaceId);
  const validFilters = transactionListFiltersSchema.parse(filters);
  return db
    .select()
    .from(transactions)
    .where(buildWhere(workspaceId, validFilters))
    .orderBy(desc(transactions.date));
}

/** Newest N transactions for the dashboard widget. */
export async function listRecent(workspaceId: string, limit = 5) {
  workspaceIdSchema.parse(workspaceId);
  limitSchema.parse(limit);
  return db
    .select()
    .from(transactions)
    .where(eq(transactions.workspaceId, workspaceId))
    .orderBy(desc(transactions.date))
    .limit(limit);
}

/**
 * Offset-based pagination (simpler than keyset for the current UI).
 * Returns rows + whether there are more.
 */
export async function listPaginated(
  workspaceId: string,
  filters: ListFilters = {},
  page = 0,
  pageSize = 25,
) {
  workspaceIdSchema.parse(workspaceId);
  const validFilters = transactionListFiltersSchema.parse(filters);
  pageSchema.parse(page);
  pageSizeSchema.parse(pageSize);
  const rows = await db
    .select()
    .from(transactions)
    .where(buildWhere(workspaceId, validFilters))
    .orderBy(desc(transactions.date))
    .limit(pageSize + 1) // fetch one extra to check hasMore
    .offset(page * pageSize);

  const hasMore = rows.length > pageSize;
  if (hasMore) rows.pop();

  return { rows, hasMore, page, pageSize };
}

/** Fetch a single transaction (null if not found or wrong workspace). */
export async function getById(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspaceId)))
    .limit(1);
  return row ?? null;
}

/** Create and return the new row. */
export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  transactionCreateSchema.parse(input);
  await assertStoredObjectInWorkspace(workspaceId, input.receiptStorageId);
  const userId = await ownerUserId(workspaceId);
  if (input.status === "reconciled") {
    throw new Error("Transactions can only be reconciled through account reconciliation");
  }
  if (input.clientId) {
    await clientsService.assertInWorkspace(workspaceId, input.clientId);
  }
  await assertGivingAttribution(
    workspaceId,
    input.type,
    input.clientId,
    input.givingRecipientId,
    input.givingDesignationId,
  );
  const id = genId();
  const now = new Date();
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    if (input.accountId) {
      const account = await financialAccountsService.assertInWorkspace(
        workspaceId,
        input.accountId,
        tx,
      );
      financialAccountsService.assertDateIsOpen(account, input.date);
    }
    await assertStoredObjectInWorkspace(workspaceId, input.receiptStorageId, tx);
    const [row] = await tx
      .insert(transactions)
      .values({
        id,
        userId,
        workspaceId,
        amount: String(input.amount),
        date: input.date,
        type: input.type,
        accountId: input.accountId ?? null,
        status: input.status ?? "cleared",
        category: input.category,
        payee: input.payee?.trim() || null,
        clientId: input.clientId ?? null,
        givingRecipientId: input.givingRecipientId ?? null,
        givingDesignationId: input.givingDesignationId ?? null,
        notes: input.notes ?? null,
        tags: input.tags ?? [],
        receiptStorageId: input.receiptStorageId ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  });
}

export async function reviewImport(
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  const candidates = await validateImport(workspaceId, accountId, rows);
  const result = await recurringMoneyOccurrences.importTransactions(workspaceId, {
    mode: "preview",
    accountId,
    candidates,
  });
  return {
    ready: result.ready,
    duplicateLineNumbers: result.duplicateLineNumbers,
    ...(result.matchedLineNumbers.length > 0 && {
      matchedLineNumbers: result.matchedLineNumbers,
    }),
  };
}

export async function importRows(
  workspaceId: string,
  accountId: string | null,
  rows: ImportInput[],
) {
  const candidates = await validateImport(workspaceId, accountId, rows);
  const result = await recurringMoneyOccurrences.importTransactions(workspaceId, {
    mode: "commit",
    accountId,
    candidates,
  });
  return {
    importedIds: result.importedIds,
    duplicateLineNumbers: result.duplicateLineNumbers,
    ...(result.matchedLineNumbers.length > 0 && {
      matchedLineNumbers: result.matchedLineNumbers,
    }),
  };
}

export async function bulkUpdateMetadata(
  workspaceId: string,
  input: {
    ids: string[];
    needsReview?: boolean;
    assignedToUserId?: string | null;
    category?: string;
    payee?: string | null;
  },
  actorUserId?: string,
) {
  workspaceIdSchema.parse(workspaceId);
  const validInput = transactionBulkUpdateSchema.parse(input);
  const ids = [...new Set(validInput.ids)];
  const actorParticipant = actorUserId
    ? await reviewParticipant(workspaceId, actorUserId)
    : null;
  const assignee = validInput.assignedToUserId
    ? await reviewParticipant(workspaceId, validInput.assignedToUserId)
    : null;
  const reviewChangedAt = new Date();
  return db.transaction(async (tx) => {
    const owned = await tx
      .select({
        id: transactions.id,
        needsReview: transactions.needsReview,
        assignedToUserId: transactions.assignedToUserId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.workspaceId, workspaceId),
          inArray(transactions.id, ids),
        ),
      );
    if (owned.length !== ids.length) {
      throw new Error("One or more transactions were not found in this workspace");
    }
    const rows = await tx
      .update(transactions)
      .set({
        ...(validInput.needsReview !== undefined && {
          needsReview: validInput.needsReview,
          reviewedAt: validInput.needsReview
            ? null
            : sql`case when ${transactions.needsReview} then ${reviewChangedAt} else ${transactions.reviewedAt} end`,
          reviewedByUserId: validInput.needsReview
            ? null
            : sql`case when ${transactions.needsReview} then ${actorUserId ?? null} else ${transactions.reviewedByUserId} end`,
        }),
        ...(validInput.assignedToUserId !== undefined && {
          assignedToUserId: validInput.assignedToUserId,
        }),
        ...(validInput.category !== undefined && { category: validInput.category }),
        ...(validInput.payee !== undefined && { payee: validInput.payee || null }),
        updatedAt: new Date(),
      })
      .where(inArray(transactions.id, ids))
      .returning({ id: transactions.id });
    if (actorParticipant) {
      const events = owned.flatMap((row) => {
        const entries: Array<typeof transactionReviewEvents.$inferInsert> = [];
        if (
          validInput.assignedToUserId !== undefined &&
          validInput.assignedToUserId !== row.assignedToUserId
        ) {
          entries.push({
            id: genId(),
            workspaceId,
            transactionId: row.id,
            action: assignee ? "assigned" : "unassigned",
            actorUserId: actorParticipant.id,
            actorName: actorParticipant.name,
            assignedToUserId: assignee?.id ?? null,
            assignedToName: assignee?.name ?? null,
          });
        }
        if (validInput.needsReview !== undefined && validInput.needsReview !== row.needsReview) {
          entries.push({
            id: genId(),
            workspaceId,
            transactionId: row.id,
            action: validInput.needsReview ? "reopened" : "reviewed",
            actorUserId: actorParticipant.id,
            actorName: actorParticipant.name,
          });
        }
        return entries;
      });
      if (events.length > 0) await tx.insert(transactionReviewEvents).values(events);
    }
    return rows.map((row) => row.id);
  });
}

/** Partial update. Throws if not found / unauthorized. */
export async function update(workspaceId: string, id: string, input: UpdateInput, actorUserId?: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  transactionUpdateSchema.parse(input);
  await assertStoredObjectInWorkspace(workspaceId, input.receiptStorageId);
  const actor = actorUserId
    ? await reviewParticipant(workspaceId, actorUserId)
    : null;
  const assignee = input.assignedToUserId
    ? await reviewParticipant(workspaceId, input.assignedToUserId)
    : null;
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    await assertStoredObjectInWorkspace(workspaceId, input.receiptStorageId, tx);
    const [existing] = await tx.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspaceId)))
      .limit(1).for("update");
    if (!existing) throw new Error("Transaction not found or unauthorized");

    if (
      existing.status === "reconciled" &&
      (input.amount !== undefined ||
        input.date !== undefined ||
        input.type !== undefined ||
        input.accountId !== undefined ||
        input.status !== undefined)
    ) {
      throw new Error("Reconciled transaction ledger fields cannot be changed");
    }

    const changesLedger =
      input.amount !== undefined ||
      input.date !== undefined ||
      input.type !== undefined ||
      input.accountId !== undefined ||
      input.status !== undefined;
    if (changesLedger && existing.workspaceId) {
      const effectiveDate = input.date ?? existing.date;
      const affectedAccountIds = new Set(
        [existing.accountId, input.accountId === undefined ? existing.accountId : input.accountId].filter(
          (accountId): accountId is string => Boolean(accountId),
        ),
      );
      for (const accountId of affectedAccountIds) {
        const account = await financialAccountsService.assertInWorkspace(
          existing.workspaceId,
          accountId,
          tx,
        );
        financialAccountsService.assertDateIsOpen(
          account,
          accountId === existing.accountId ? existing.date : effectiveDate,
        );
        if (accountId === existing.accountId && effectiveDate !== existing.date) {
          financialAccountsService.assertDateIsOpen(account, effectiveDate);
        }
      }
    } else if (input.accountId && !existing.workspaceId) {
      throw new Error("This transaction has no workspace, so it cannot be assigned to an account");
    }

    if (input.clientId && input.clientId !== existing.clientId) {
      // Checked against the row's own workspace, so a client from another
      // workspace cannot be attached to this money.
      if (!existing.workspaceId) {
        throw new Error("This transaction has no workspace, so it cannot be attributed");
      }
      await clientsService.assertInWorkspace(existing.workspaceId, input.clientId, tx);
    }

    const effectiveType = input.type ?? existing.type;
    const effectiveClientId = input.clientId === undefined ? existing.clientId : input.clientId;
    const effectiveRecipientId =
      input.givingRecipientId === undefined
        ? existing.givingRecipientId
        : input.givingRecipientId;
    const effectiveDesignationId =
      input.givingDesignationId === undefined
        ? existing.givingDesignationId
        : input.givingDesignationId;
    if (!existing.workspaceId) {
      if (effectiveRecipientId || effectiveDesignationId) {
        throw new GivingAttributionError("This transaction has no workspace, so it cannot be attributed");
      }
    } else if (
      input.type !== undefined ||
      input.clientId !== undefined ||
      input.givingRecipientId !== undefined ||
      input.givingDesignationId !== undefined
    ) {
      await assertGivingAttribution(
        existing.workspaceId,
        effectiveType,
        effectiveClientId,
        effectiveRecipientId,
        effectiveDesignationId,
        tx,
      );
    }

    if (input.type !== undefined && input.type !== existing.type) {
      await recurringMoneyOccurrences.assertChange(workspaceId, {
        kind: "transaction-type",
        transactionId: id,
        nextType: input.type,
      }, tx);
    }

    if (existing.type === "giving" && effectiveType !== "giving") {
      const [document] = await tx
        .select({ id: transactionDocuments.id })
        .from(transactionDocuments)
        .where(eq(transactionDocuments.transactionId, id))
        .limit(1);
      if (document) {
        throw new GivingAttributionError(
          "Remove this gift's supporting documents before changing its type",
        );
      }
    }

    const [row] = await tx
      .update(transactions)
      .set({
        ...(input.amount !== undefined && { amount: String(input.amount) }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.accountId !== undefined && { accountId: input.accountId ?? null }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.needsReview !== undefined && { needsReview: input.needsReview }),
        ...(input.needsReview !== undefined && input.needsReview !== existing.needsReview && {
          reviewedAt: input.needsReview ? null : new Date(),
          reviewedByUserId: input.needsReview ? null : (actorUserId ?? null),
        }),
        ...(input.assignedToUserId !== undefined && {
          assignedToUserId: input.assignedToUserId,
        }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.payee !== undefined && { payee: input.payee?.trim() || null }),
        ...(input.clientId !== undefined && { clientId: input.clientId ?? null }),
        ...(input.givingRecipientId !== undefined && {
          givingRecipientId: input.givingRecipientId ?? null,
        }),
        ...(input.givingDesignationId !== undefined && {
          givingDesignationId: input.givingDesignationId ?? null,
        }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.tags !== undefined && { tags: input.tags }),
        ...(input.receiptStorageId !== undefined && { receiptStorageId: input.receiptStorageId }),
        updatedAt: new Date(),
      })
      .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspaceId)))
      .returning();
    if (actor) {
      const events: Array<typeof transactionReviewEvents.$inferInsert> = [];
      if (
        input.assignedToUserId !== undefined &&
        input.assignedToUserId !== existing.assignedToUserId
      ) {
        events.push({
          id: genId(),
          workspaceId: existing.workspaceId,
          transactionId: id,
          action: assignee ? "assigned" : "unassigned",
          actorUserId: actor.id,
          actorName: actor.name,
          assignedToUserId: assignee?.id ?? null,
          assignedToName: assignee?.name ?? null,
        });
      }
      if (input.needsReview !== undefined && input.needsReview !== existing.needsReview) {
        events.push({
          id: genId(),
          workspaceId: existing.workspaceId,
          transactionId: id,
          action: input.needsReview ? "reopened" : "reviewed",
          actorUserId: actor.id,
          actorName: actor.name,
        });
      }
      if (events.length > 0) await tx.insert(transactionReviewEvents).values(events);
    }
    return row;
  });
}

export async function listReviewHistory(workspaceId: string, transactionId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  const transaction = await getById(workspaceId, transactionId);
  if (!transaction) {
    throw new Error("Transaction not found or unauthorized");
  }
  return db
    .select()
    .from(transactionReviewEvents)
    .where(eq(transactionReviewEvents.transactionId, transactionId))
    .orderBy(desc(transactionReviewEvents.createdAt));
}

/** Delete a transaction. Throws if not found / unauthorized. */
export async function remove(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    const [existing] = await tx.select().from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspaceId)))
      .limit(1).for("update");
    if (!existing) throw new Error("Transaction not found or unauthorized");
    if (existing.status === "reconciled") {
      throw new Error("Reconciled transactions cannot be deleted");
    }
    if (existing.accountId) {
      const account = await financialAccountsService.assertInWorkspace(workspaceId, existing.accountId, tx);
      financialAccountsService.assertDateIsOpen(account, existing.date);
    }
    await tx.delete(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.workspaceId, workspaceId)));
  });
}

/**
 * Sum of `amount` grouped by type for a date range.
 * Used internally by analytics and budget-spending.
 */
export async function sumByTypeAndCategory(
  workspaceId: string,
  startDate: string,
  endDate: string,
) {
  workspaceIdSchema.parse(workspaceId);
  return db
    .select({
      type: transactions.type,
      category: transactions.category,
      total: sql<string>`sum(${transactions.amount})`.as("total"),
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.workspaceId, workspaceId),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ),
    )
    .groupBy(transactions.type, transactions.category);
}
