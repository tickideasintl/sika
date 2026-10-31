import { and, desc, eq, gte, lte, ne, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accountTransfers,
  financialAccounts,
  transactions,
  workspaces,
} from "@/db/schema";
import { calculateAccountBalance } from "@/lib/account-balance";
import { lockWorkspaceLedger, type LedgerReader } from "./ledger-lock";
import { ownerUserId } from "./workspaces";
import {
  accountReconciliationSchema,
  accountTransferCreateSchema,
  financialAccountCreateSchema,
  financialAccountUpdateSchema,
  idSchema,
  workspaceIdSchema,
} from "./validation";

export type FinancialAccountClass = "asset" | "liability";
export type FinancialAccountType =
  | "checking"
  | "savings"
  | "cash"
  | "credit_card"
  | "loan"
  | "other";

export interface CreateInput {
  name: string;
  accountClass: FinancialAccountClass;
  accountType: FinancialAccountType;
  currency: string;
  openingBalance: number;
  openingDate: string;
}

export interface UpdateInput {
  name?: string;
  isActive?: boolean;
}

export interface TransferInput {
  fromAccountId: string;
  toAccountId: string;
  amount: number;
  date: string;
  notes?: string | null;
}

function genId() {
  return crypto.randomUUID();
}

export async function assertInWorkspace(
  workspaceId: string,
  accountId: string,
  executor: LedgerReader = db,
) {
  const [account] = await executor
    .select()
    .from(financialAccounts)
    .where(
      and(
        eq(financialAccounts.id, accountId),
        eq(financialAccounts.workspaceId, workspaceId),
      ),
    )
    .limit(1);

  if (!account) throw new Error("Financial account not found in this workspace");
  return account;
}

export function assertDateIsOpen(
  account: typeof financialAccounts.$inferSelect,
  date: string,
) {
  if (account.reconciledAt && date <= account.reconciledAt) {
    throw new Error(
      `Transactions through ${account.reconciledAt} are locked by reconciliation`,
    );
  }
}

async function movementDelta(
  account: typeof financialAccounts.$inferSelect,
  endDate?: string,
  includePending = false,
  executor: LedgerReader = db,
) {
  const transactionConditions = [
    eq(transactions.accountId, account.id),
    gte(transactions.date, account.openingDate),
  ];
  if (endDate) transactionConditions.push(lte(transactions.date, endDate));
  if (!includePending) transactionConditions.push(ne(transactions.status, "pending"));

  const [transactionResult] = await executor
    .select({
      delta: sql<string>`coalesce(sum(
        case when ${transactions.type} = 'income'
          then ${transactions.amount}
          else -${transactions.amount}
        end
      ), 0)`,
    })
    .from(transactions)
    .where(and(...transactionConditions));

  const transferConditions = [
    or(
      eq(accountTransfers.fromAccountId, account.id),
      eq(accountTransfers.toAccountId, account.id),
    )!,
    gte(accountTransfers.date, account.openingDate),
  ];
  if (endDate) transferConditions.push(lte(accountTransfers.date, endDate));

  const [transferResult] = await executor
    .select({
      delta: sql<string>`coalesce(sum(
        case when ${accountTransfers.toAccountId} = ${account.id}
          then ${accountTransfers.amount}
          else -${accountTransfers.amount}
        end
      ), 0)`,
    })
    .from(accountTransfers)
    .where(and(...transferConditions));

  return Number(transactionResult.delta) + Number(transferResult.delta);
}

export async function balanceAt(
  account: typeof financialAccounts.$inferSelect,
  endDate?: string,
  includePending = false,
  executor: LedgerReader = db,
) {
  return calculateAccountBalance(
    Number(account.openingBalance),
    account.accountClass,
    await movementDelta(account, endDate, includePending, executor),
  );
}

export async function list(workspaceId: string, includeInactive = false) {
  workspaceIdSchema.parse(workspaceId);

  const conditions = [eq(financialAccounts.workspaceId, workspaceId)];
  if (!includeInactive) conditions.push(eq(financialAccounts.isActive, true));

  const rows = await db
    .select()
    .from(financialAccounts)
    .where(and(...conditions))
    .orderBy(financialAccounts.accountClass, financialAccounts.name);

  return Promise.all(
    rows.map(async (account) => ({
      ...account,
      currentBalance: await balanceAt(account),
      projectedBalance: await balanceAt(account, undefined, true),
    })),
  );
}

export async function getById(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  const account = await assertInWorkspace(workspaceId, id);
  return {
    ...account,
    currentBalance: await balanceAt(account),
    projectedBalance: await balanceAt(account, undefined, true),
  };
}

export async function create(workspaceId: string, input: CreateInput) {
  workspaceIdSchema.parse(workspaceId);
  const validInput = financialAccountCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  const [workspace] = await db
    .select({ currency: workspaces.currency })
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);
  if (!workspace) throw new Error("Workspace not found or unauthorized");
  if (validInput.currency !== workspace.currency) {
    throw new Error(`Account currency must match the workspace currency (${workspace.currency})`);
  }

  const now = new Date();
  const [row] = await db
    .insert(financialAccounts)
    .values({
      id: genId(),
      userId,
      workspaceId,
      name: validInput.name,
      accountClass: validInput.accountClass,
      accountType: validInput.accountType,
      currency: validInput.currency,
      openingBalance: String(validInput.openingBalance),
      openingDate: validInput.openingDate,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  return row;
}

export async function update(
  workspaceId: string,
  id: string,
  input: UpdateInput,
) {
  const validInput = financialAccountUpdateSchema.parse(input);
  await assertInWorkspace(workspaceId, id);
  const [row] = await db
    .update(financialAccounts)
    .set({ ...validInput, updatedAt: new Date() })
    .where(and(eq(financialAccounts.id, id), eq(financialAccounts.workspaceId, workspaceId)))
    .returning();
  return row;
}

export async function listTransfers(workspaceId: string) {
  workspaceIdSchema.parse(workspaceId);
  return db
    .select({
      id: accountTransfers.id,
      fromAccountId: accountTransfers.fromAccountId,
      toAccountId: accountTransfers.toAccountId,
      amount: accountTransfers.amount,
      date: accountTransfers.date,
      notes: accountTransfers.notes,
      createdAt: accountTransfers.createdAt,
    })
    .from(accountTransfers)
    .where(eq(accountTransfers.workspaceId, workspaceId))
    .orderBy(desc(accountTransfers.date), desc(accountTransfers.createdAt));
}

export async function createTransfer(
  workspaceId: string,
  input: TransferInput,
) {
  const validInput = accountTransferCreateSchema.parse(input);
  const userId = await ownerUserId(workspaceId);
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    const [fromAccount, toAccount] = await Promise.all([
      assertInWorkspace(workspaceId, validInput.fromAccountId, tx),
      assertInWorkspace(workspaceId, validInput.toAccountId, tx),
    ]);
    assertDateIsOpen(fromAccount, validInput.date);
    assertDateIsOpen(toAccount, validInput.date);

    const now = new Date();
    const [row] = await tx
      .insert(accountTransfers)
      .values({
        id: genId(),
        userId,
        workspaceId,
        fromAccountId: validInput.fromAccountId,
        toAccountId: validInput.toAccountId,
        amount: String(validInput.amount),
        date: validInput.date,
        notes: validInput.notes ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    return row;
  });
}

export async function removeTransfer(workspaceId: string, id: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(id);
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    const [transfer] = await tx
      .select()
      .from(accountTransfers)
      .where(
        and(
          eq(accountTransfers.id, id),
          eq(accountTransfers.workspaceId, workspaceId),
        ),
      )
      .limit(1);
    if (!transfer) throw new Error("Transfer not found or unauthorized");

    const [fromAccount, toAccount] = await Promise.all([
      assertInWorkspace(workspaceId, transfer.fromAccountId, tx),
      assertInWorkspace(workspaceId, transfer.toAccountId, tx),
    ]);
    assertDateIsOpen(fromAccount, transfer.date);
    assertDateIsOpen(toAccount, transfer.date);

    await tx
      .delete(accountTransfers)
      .where(and(eq(accountTransfers.id, id), eq(accountTransfers.workspaceId, workspaceId)));
  });
}

export async function reconcile(
  workspaceId: string,
  id: string,
  input: { statementDate: string; statementBalance: number },
) {
  const validInput = accountReconciliationSchema.parse(input);
  return db.transaction(async (tx) => {
    await lockWorkspaceLedger(tx, workspaceId);
    const account = await assertInWorkspace(workspaceId, id, tx);
    if (validInput.statementDate < account.openingDate) {
      throw new Error("Statement date cannot be before the account opening date");
    }
    if (account.reconciledAt && validInput.statementDate <= account.reconciledAt) {
      throw new Error(`Statement date must be after ${account.reconciledAt}`);
    }

    const calculatedBalance = await balanceAt(account, validInput.statementDate, false, tx);
    const difference = Number((validInput.statementBalance - calculatedBalance).toFixed(2));
    if (difference !== 0) {
      return { reconciled: false as const, calculatedBalance, difference };
    }

    await tx
      .update(transactions)
      .set({ status: "reconciled", updatedAt: new Date() })
      .where(
        and(
          eq(transactions.accountId, id),
          lte(transactions.date, validInput.statementDate),
          ne(transactions.status, "pending"),
        ),
      );
    await tx
      .update(financialAccounts)
      .set({
        reconciledBalance: String(validInput.statementBalance),
        reconciledAt: validInput.statementDate,
        updatedAt: new Date(),
      })
      .where(and(eq(financialAccounts.id, id), eq(financialAccounts.workspaceId, workspaceId)));

    return { reconciled: true as const, calculatedBalance, difference: 0 };
  });
}
