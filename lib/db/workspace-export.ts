import { and, eq, isNotNull } from "drizzle-orm";
import { db } from "@/db/client";
import {
  accountTransfers,
  budgets,
  categories,
  clients,
  debtBalanceLogs,
  debtPayments,
  debtStatements,
  debtsCredits,
  emailNotificationPreferences,
  financialAccounts,
  givingCommitments,
  givingDesignations,
  givingRecipients,
  goalActivities,
  goals,
  investmentEvents,
  investments,
  loanRepayments,
  loansGiven,
  notificationStates,
  onboardingStatus,
  pushNotificationPreferences,
  recurringMoneySettlements,
  recurringMoneyOccurrences,
  recurringOutgoings,
  storedObjects,
  transactionDocuments,
  transactionImportProfiles,
  transactionReviewEvents,
  transactionRules,
  transactions,
  workspaceMemberships,
  workspaces,
} from "@/db/schema";
import { StoredObjectOwnershipError } from "./stored-objects";

export const WORKSPACE_EXPORT_FORMAT = "sika-workspace-export";
export const WORKSPACE_EXPORT_VERSION = 5;

/**
 * User-owned, portable records included in a JSON workspace export.
 *
 * Authentication records, AI credentials, push subscription capabilities,
 * delivery logs, and global backup status are intentionally not export data.
 */
export const WORKSPACE_EXPORT_DATASETS = [
  "workspaceMemberships",
  "onboardingStatus",
  "notificationStates",
  "pushNotificationPreferences",
  "emailNotificationPreferences",
  "goals",
  "goalActivities",
  "clients",
  "givingRecipients",
  "givingDesignations",
  "givingCommitments",
  "financialAccounts",
  "transactionImportProfiles",
  "transactionRules",
  "accountTransfers",
  "transactions",
  "transactionReviewEvents",
  "transactionDocuments",
  "categories",
  "budgets",
  "recurringOutgoings",
  "recurringMoneyOccurrences",
  "recurringMoneySettlements",
  "debtsCredits",
  "debtBalanceLogs",
  "debtPayments",
  "debtStatements",
  "loansGiven",
  "loanRepayments",
  "investments",
  "investmentEvents",
] as const;

type ExportDatasets = {
  [Key in (typeof WORKSPACE_EXPORT_DATASETS)[number]]: unknown[];
};

export interface WorkspaceExport {
  format: typeof WORKSPACE_EXPORT_FORMAT;
  version: typeof WORKSPACE_EXPORT_VERSION;
  generatedAt: string;
  workspace: typeof workspaces.$inferSelect;
  data: ExportDatasets;
}

export interface WorkspaceExportFile {
  documentId: string | null;
  transactionId: string;
  storageKey: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number | null;
  source: "supporting_document" | "legacy_receipt";
}

function childRows<Row>(rows: Array<{ child: Row }>): Row[] {
  return rows.map(({ child }) => child);
}

type ExportTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

async function readWorkspaceExport(
  tx: ExportTransaction,
  workspaceId: string,
  generatedAt: Date,
): Promise<WorkspaceExport> {
  const [workspace] = await tx
    .select()
    .from(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .limit(1);

  if (!workspace) throw new Error("Workspace not found or unauthorized");

  const [
    membershipRows,
    onboarding,
    states,
    pushPreferences,
    emailPreferences,
    goalRows,
    goalActivityRows,
    clientRows,
    recipientRows,
    designationRows,
    commitmentRows,
    accountRows,
    importProfileRows,
    ruleRows,
    transferRows,
    transactionRows,
    reviewEventRows,
    documentRows,
    categoryRows,
    budgetRows,
    recurringRows,
    occurrenceRows,
    settlementRows,
    debtRows,
    debtBalanceRows,
    debtPaymentRows,
    debtStatementRows,
    loanRows,
    repaymentRows,
    investmentRows,
    investmentEventRows,
  ] = [
    await tx
      .select()
      .from(workspaceMemberships)
      .where(eq(workspaceMemberships.workspaceId, workspaceId)),
    await tx.select().from(onboardingStatus).where(eq(onboardingStatus.workspaceId, workspaceId)),
    await tx.select().from(notificationStates).where(eq(notificationStates.workspaceId, workspaceId)),
    await tx.select().from(pushNotificationPreferences).where(eq(pushNotificationPreferences.workspaceId, workspaceId)),
    await tx.select().from(emailNotificationPreferences).where(eq(emailNotificationPreferences.workspaceId, workspaceId)),
    await tx.select().from(goals).where(eq(goals.workspaceId, workspaceId)),
    await tx.select().from(goalActivities).where(eq(goalActivities.workspaceId, workspaceId)),
    await tx.select().from(clients).where(eq(clients.workspaceId, workspaceId)),
    await tx.select().from(givingRecipients).where(eq(givingRecipients.workspaceId, workspaceId)),
    await tx.select().from(givingDesignations).where(eq(givingDesignations.workspaceId, workspaceId)),
    await tx.select().from(givingCommitments).where(eq(givingCommitments.workspaceId, workspaceId)),
    await tx.select().from(financialAccounts).where(eq(financialAccounts.workspaceId, workspaceId)),
    await tx.select().from(transactionImportProfiles).where(eq(transactionImportProfiles.workspaceId, workspaceId)),
    await tx.select().from(transactionRules).where(eq(transactionRules.workspaceId, workspaceId)),
    await tx.select().from(accountTransfers).where(eq(accountTransfers.workspaceId, workspaceId)),
    await tx.select({
      id: transactions.id,
      userId: transactions.userId,
      workspaceId: transactions.workspaceId,
      accountId: transactions.accountId,
      amount: transactions.amount,
      date: transactions.date,
      type: transactions.type,
      status: transactions.status,
      needsReview: transactions.needsReview,
      assignedToUserId: transactions.assignedToUserId,
      reviewedAt: transactions.reviewedAt,
      reviewedByUserId: transactions.reviewedByUserId,
      category: transactions.category,
      payee: transactions.payee,
      clientId: transactions.clientId,
      givingRecipientId: transactions.givingRecipientId,
      givingDesignationId: transactions.givingDesignationId,
      notes: transactions.notes,
      tags: transactions.tags,
      importFingerprint: transactions.importFingerprint,
      createdAt: transactions.createdAt,
      updatedAt: transactions.updatedAt,
    }).from(transactions).where(eq(transactions.workspaceId, workspaceId)),
    await tx
      .select()
      .from(transactionReviewEvents)
      .where(eq(transactionReviewEvents.workspaceId, workspaceId)),
    await tx.select({
      id: transactionDocuments.id,
      userId: transactionDocuments.userId,
      workspaceId: transactionDocuments.workspaceId,
      transactionId: transactionDocuments.transactionId,
      fileName: transactionDocuments.fileName,
      mimeType: transactionDocuments.mimeType,
      sizeBytes: transactionDocuments.sizeBytes,
      createdAt: transactionDocuments.createdAt,
    }).from(transactionDocuments).where(eq(transactionDocuments.workspaceId, workspaceId)),
    await tx.select().from(categories).where(eq(categories.workspaceId, workspaceId)),
    await tx.select().from(budgets).where(eq(budgets.workspaceId, workspaceId)),
    await tx.select().from(recurringOutgoings).where(eq(recurringOutgoings.workspaceId, workspaceId)),
    await tx.select().from(recurringMoneyOccurrences).where(eq(recurringMoneyOccurrences.workspaceId, workspaceId)),
    await tx.select().from(recurringMoneySettlements).where(eq(recurringMoneySettlements.workspaceId, workspaceId)),
    await tx.select().from(debtsCredits).where(eq(debtsCredits.workspaceId, workspaceId)),
    await tx.select({ child: debtBalanceLogs }).from(debtBalanceLogs)
      .innerJoin(debtsCredits, eq(debtBalanceLogs.debtId, debtsCredits.id))
      .where(eq(debtsCredits.workspaceId, workspaceId)),
    await tx.select({ child: debtPayments }).from(debtPayments)
      .innerJoin(debtsCredits, eq(debtPayments.debtId, debtsCredits.id))
      .where(eq(debtsCredits.workspaceId, workspaceId)),
    await tx.select({ child: debtStatements }).from(debtStatements)
      .innerJoin(debtsCredits, eq(debtStatements.debtId, debtsCredits.id))
      .where(eq(debtsCredits.workspaceId, workspaceId)),
    await tx.select().from(loansGiven).where(eq(loansGiven.workspaceId, workspaceId)),
    await tx.select({ child: loanRepayments }).from(loanRepayments)
      .innerJoin(loansGiven, eq(loanRepayments.loanId, loansGiven.id))
      .where(eq(loansGiven.workspaceId, workspaceId)),
    await tx.select().from(investments).where(eq(investments.workspaceId, workspaceId)),
    await tx.select({ child: investmentEvents }).from(investmentEvents)
      .innerJoin(investments, eq(investmentEvents.investmentId, investments.id))
      .where(eq(investments.workspaceId, workspaceId)),
  ];

  return {
    format: WORKSPACE_EXPORT_FORMAT,
    version: WORKSPACE_EXPORT_VERSION,
    generatedAt: generatedAt.toISOString(),
    workspace,
    data: {
      workspaceMemberships: membershipRows,
      onboardingStatus: onboarding,
      notificationStates: states,
      pushNotificationPreferences: pushPreferences,
      emailNotificationPreferences: emailPreferences,
      goals: goalRows,
      goalActivities: goalActivityRows,
      clients: clientRows,
      givingRecipients: recipientRows,
      givingDesignations: designationRows,
      givingCommitments: commitmentRows,
      financialAccounts: accountRows,
      transactionImportProfiles: importProfileRows,
      transactionRules: ruleRows,
      accountTransfers: transferRows,
      transactions: transactionRows,
      transactionReviewEvents: reviewEventRows,
      transactionDocuments: documentRows,
      categories: categoryRows,
      budgets: budgetRows,
      recurringOutgoings: recurringRows,
      recurringMoneyOccurrences: occurrenceRows,
      recurringMoneySettlements: settlementRows,
      debtsCredits: debtRows,
      debtBalanceLogs: childRows(debtBalanceRows),
      debtPayments: childRows(debtPaymentRows),
      debtStatements: childRows(debtStatementRows),
      loansGiven: loanRows,
      loanRepayments: childRows(repaymentRows),
      investments: investmentRows,
      investmentEvents: childRows(investmentEventRows),
    },
  };
}

export async function createWorkspaceExport(
  workspaceId: string,
  generatedAt = new Date(),
): Promise<WorkspaceExport> {
  return db.transaction(
    (tx) => readWorkspaceExport(tx, workspaceId, generatedAt),
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}

/** Return the public JSON payload and private storage references from one snapshot. */
export async function createWorkspaceArchiveSource(
  workspaceId: string,
  generatedAt = new Date(),
): Promise<{ workspaceExport: WorkspaceExport; files: WorkspaceExportFile[] }> {
  return db.transaction(
    async (tx) => {
      const workspaceExport = await readWorkspaceExport(tx, workspaceId, generatedAt);
      const documents = await tx
        .select({
          documentId: transactionDocuments.id,
          transactionId: transactionDocuments.transactionId,
          storageKey: transactionDocuments.storageKey,
          fileName: transactionDocuments.fileName,
          mimeType: transactionDocuments.mimeType,
          sizeBytes: transactionDocuments.sizeBytes,
        })
        .from(transactionDocuments)
        .where(eq(transactionDocuments.workspaceId, workspaceId));
      const legacyReceipts = await tx
        .select({
          transactionId: transactions.id,
          storageKey: transactions.receiptStorageId,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.workspaceId, workspaceId),
            isNotNull(transactions.receiptStorageId),
          ),
        );

      const files: WorkspaceExportFile[] = documents.map((document) => ({
        ...document,
        source: "supporting_document",
      }));
      const documentedReceipts = new Set(
        documents.map((document) => `${document.transactionId}\0${document.storageKey}`),
      );
      for (const receipt of legacyReceipts) {
        if (
          receipt.storageKey &&
          !documentedReceipts.has(`${receipt.transactionId}\0${receipt.storageKey}`)
        ) {
          files.push({
            documentId: null,
            transactionId: receipt.transactionId,
            storageKey: receipt.storageKey,
            fileName: "Receipt",
            mimeType: null,
            sizeBytes: null,
            source: "legacy_receipt",
          });
        }
      }

      // References, including legacy-* supporting documents, are not provenance.
      // Fail closed rather than silently emitting an incomplete archive.
      const ownedObjects = await tx
        .select({ storageKey: storedObjects.storageKey })
        .from(storedObjects)
        .where(eq(storedObjects.workspaceId, workspaceId));
      const ownedKeys = new Set(ownedObjects.map((object) => object.storageKey));
      if (files.some((file) => !ownedKeys.has(file.storageKey))) {
        throw new StoredObjectOwnershipError();
      }
      return { workspaceExport, files };
    },
    { isolationLevel: "repeatable read", accessMode: "read only" },
  );
}
