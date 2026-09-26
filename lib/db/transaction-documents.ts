import { and, asc, count, desc, eq, gte, isNull, lte } from "drizzle-orm";
import { db } from "@/db/client";
import {
  givingDesignations,
  givingRecipients,
  transactionDocuments,
  transactions,
} from "@/db/schema";
import { MAX_SUPPORTING_DOCUMENTS, safeDocumentFileName } from "@/lib/supporting-documents";
import {
  dateStringSchema,
  idSchema,
  pageSchema,
  pageSizeSchema,
  workspaceIdSchema,
} from "./validation";
import { ownerUserId } from "./workspaces";
import { assertStoredObjectInWorkspace } from "./stored-objects";

async function getOwnedTransaction(
  workspaceId: string,
  transactionId: string,
  requireGiving = true,
) {
  const [row] = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, transactionId),
        eq(transactions.workspaceId, workspaceId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Transaction not found or unauthorized");
  if (requireGiving && row.type !== "giving") {
    throw new Error("Supporting documents are only available for giving transactions");
  }
  return row;
}

export async function list(workspaceId: string, transactionId: string) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  await getOwnedTransaction(workspaceId, transactionId);
  return db
    .select()
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    )
    .orderBy(asc(transactionDocuments.createdAt));
}

export async function listMissingForGiving(
  workspaceId: string,
  startDate: string,
  endDate: string,
  page = 0,
  pageSize = 10,
) {
  workspaceIdSchema.parse(workspaceId);
  dateStringSchema.parse(startDate);
  dateStringSchema.parse(endDate);
  pageSchema.parse(page);
  pageSizeSchema.parse(pageSize);
  if (endDate < startDate) throw new Error("period end must not be before period start");

  const conditions = and(
    eq(transactions.workspaceId, workspaceId),
    eq(transactions.type, "giving"),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    isNull(transactions.receiptStorageId),
    isNull(transactionDocuments.id),
  );
  const documentJoin = and(
    eq(transactionDocuments.transactionId, transactions.id),
    eq(transactionDocuments.workspaceId, workspaceId),
  );
  const [totalResult] = await db
    .select({ value: count() })
    .from(transactions)
    .leftJoin(transactionDocuments, documentJoin)
    .where(conditions);
  const total = totalResult?.value ?? 0;
  const rows = await db
    .select({
      id: transactions.id,
      amount: transactions.amount,
      date: transactions.date,
      category: transactions.category,
      payee: transactions.payee,
      givingRecipientName: givingRecipients.name,
      givingDesignationName: givingDesignations.name,
    })
    .from(transactions)
    .leftJoin(transactionDocuments, documentJoin)
    .leftJoin(givingRecipients, eq(transactions.givingRecipientId, givingRecipients.id))
    .leftJoin(givingDesignations, eq(transactions.givingDesignationId, givingDesignations.id))
    .where(conditions)
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(pageSize)
    .offset(page * pageSize);

  return { rows, total, page, pageSize, hasMore: (page + 1) * pageSize < total };
}

export async function assertCanUpload(
  workspaceId: string,
  transactionId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  const transaction = await getOwnedTransaction(workspaceId, transactionId);
  if (transaction.type !== "giving") {
    throw new Error("Supporting documents can only be added to giving transactions");
  }
  const [result] = await db
    .select({ value: count() })
    .from(transactionDocuments)
    .where(eq(transactionDocuments.transactionId, transactionId));
  if ((result?.value ?? 0) >= MAX_SUPPORTING_DOCUMENTS) {
    throw new Error(`A gift can have at most ${MAX_SUPPORTING_DOCUMENTS} supporting documents`);
  }
}

export async function create(
  workspaceId: string,
  transactionId: string,
  input: { storageKey: string; fileName: string; mimeType: string; sizeBytes: number },
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  await assertStoredObjectInWorkspace(workspaceId, input.storageKey);
  const userId = await ownerUserId(workspaceId);
  return db.transaction(async (tx) => {
    await assertStoredObjectInWorkspace(workspaceId, input.storageKey, tx);
    const [transaction] = await tx
      .select({ id: transactions.id, type: transactions.type })
      .from(transactions)
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.workspaceId, workspaceId),
        ),
      )
      .limit(1)
      .for("update");
    if (!transaction) throw new Error("Transaction not found or unauthorized");
    if (transaction.type !== "giving") {
      throw new Error("Supporting documents can only be added to giving transactions");
    }

    const [result] = await tx
      .select({ value: count() })
      .from(transactionDocuments)
      .where(eq(transactionDocuments.transactionId, transactionId));
    if ((result?.value ?? 0) >= MAX_SUPPORTING_DOCUMENTS) {
      throw new Error(`A gift can have at most ${MAX_SUPPORTING_DOCUMENTS} supporting documents`);
    }

    const [row] = await tx
      .insert(transactionDocuments)
      .values({
        id: crypto.randomUUID(),
        userId,
        workspaceId,
        transactionId,
        storageKey: input.storageKey,
        fileName: safeDocumentFileName(input.fileName),
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      })
      .returning();
    return row;
  });
}

export async function listForTransactionDeletion(
  workspaceId: string,
  transactionId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  await getOwnedTransaction(workspaceId, transactionId, false);
  return db
    .select({ storageKey: transactionDocuments.storageKey })
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    );
}

export async function get(
  workspaceId: string,
  transactionId: string,
  documentId: string,
) {
  workspaceIdSchema.parse(workspaceId);
  idSchema.parse(transactionId);
  idSchema.parse(documentId);
  await getOwnedTransaction(workspaceId, transactionId);
  const [row] = await db
    .select()
    .from(transactionDocuments)
    .where(
      and(
        eq(transactionDocuments.id, documentId),
        eq(transactionDocuments.workspaceId, workspaceId),
        eq(transactionDocuments.transactionId, transactionId),
      ),
    )
    .limit(1);
  if (!row) throw new Error("Supporting document not found or unauthorized");
  return row;
}

export async function remove(
  workspaceId: string,
  transactionId: string,
  documentId: string,
) {
  const existing = await get(workspaceId, transactionId, documentId);
  await db.transaction(async (tx) => {
    await tx
      .delete(transactionDocuments)
      .where(
        and(
          eq(transactionDocuments.id, documentId),
          eq(transactionDocuments.workspaceId, workspaceId),
          eq(transactionDocuments.transactionId, transactionId),
        ),
      );
    await tx
      .update(transactions)
      .set({ receiptStorageId: null, updatedAt: new Date() })
      .where(
        and(
          eq(transactions.id, transactionId),
          eq(transactions.workspaceId, workspaceId),
          eq(transactions.receiptStorageId, existing.storageKey),
        ),
      );
  });
  return existing;
}
