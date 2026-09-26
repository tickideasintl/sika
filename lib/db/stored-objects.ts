import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storedObjects, transactionDocuments, transactions } from "@/db/schema";
import { workspaceIdSchema } from "./validation";

export class StoredObjectOwnershipError extends Error {
  constructor() {
    super("Attachment not found in this workspace; older receipts must be re-uploaded");
    this.name = "StoredObjectOwnershipError";
  }
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Live upload authorization, not an immutable audit log or proof of S3 existence.
 * Only server-side uploads register keys; retired keys must never be re-registered.
 */
export async function registerStoredObject(workspaceId: string, storageKey: string) {
  workspaceIdSchema.parse(workspaceId);
  await db.insert(storedObjects).values({ storageKey, workspaceId });
}

export async function assertStoredObjectInWorkspace(
  workspaceId: string,
  storageKey: string | null | undefined,
  tx?: Transaction,
) {
  workspaceIdSchema.parse(workspaceId);
  if (storageKey == null) return;
  if (!storageKey || storageKey.length > 1024 || !/^(receipts|supporting-documents)\//.test(storageKey)) {
    throw new StoredObjectOwnershipError();
  }
  const query = (tx ?? db)
    .select({ storageKey: storedObjects.storageKey })
    .from(storedObjects)
    .where(and(
      eq(storedObjects.storageKey, storageKey),
      eq(storedObjects.workspaceId, workspaceId),
    ))
    .limit(1);
  // Writers hold this lock through the reference write. Retirement uses the
  // same row lock, so validation cannot race with deleting the object.
  const [owned] = await (tx ? query.for("update") : query);
  if (!owned) throw new StoredObjectOwnershipError();
}

/**
 * Retire authorization before touching S3. Committing first fails closed even
 * if S3 succeeds and the process crashes: a deleted key cannot be attached again.
 * A failed S3 delete can leave an inaccessible orphan, never a live dead key.
 */
export async function retireUnreferencedStoredObject(workspaceId: string, storageKey: string) {
  return db.transaction(async (tx) => {
    await assertStoredObjectInWorkspace(workspaceId, storageKey, tx);
    // Check both reference types, including historical cross-workspace rows.
    // Such rows cannot authorize access, but must not cause another file loss.
    const [receipt] = await tx.select({ id: transactions.id })
      .from(transactions)
      .where(eq(transactions.receiptStorageId, storageKey))
      .limit(1);
    if (receipt) return false;
    const [document] = await tx.select({ id: transactionDocuments.id })
      .from(transactionDocuments)
      .where(eq(transactionDocuments.storageKey, storageKey))
      .limit(1);
    if (document) return false;
    await tx.delete(storedObjects).where(and(
      eq(storedObjects.storageKey, storageKey),
      eq(storedObjects.workspaceId, workspaceId),
    ));
    return true;
  });
}
