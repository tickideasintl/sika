import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storedObjects } from "@/db/schema";
import { workspaceIdSchema } from "./validation";

export class StoredObjectOwnershipError extends Error {
  constructor() {
    super("Attachment not found in this workspace; older receipts must be re-uploaded");
    this.name = "StoredObjectOwnershipError";
  }
}

/** Only server-side upload code may create ownership records. Never claim old references. */
export async function registerStoredObject(workspaceId: string, storageKey: string) {
  workspaceIdSchema.parse(workspaceId);
  await db.insert(storedObjects).values({ storageKey, workspaceId });
}

export async function assertStoredObjectInWorkspace(
  workspaceId: string,
  storageKey: string | null | undefined,
) {
  workspaceIdSchema.parse(workspaceId);
  if (storageKey == null) return;
  if (!storageKey || storageKey.length > 1024 || !/^(receipts|supporting-documents)\//.test(storageKey)) {
    throw new StoredObjectOwnershipError();
  }
  const [owned] = await db
    .select({ storageKey: storedObjects.storageKey })
    .from(storedObjects)
    .where(and(
      eq(storedObjects.storageKey, storageKey),
      eq(storedObjects.workspaceId, workspaceId),
    ))
    .limit(1);
  if (!owned) throw new StoredObjectOwnershipError();
}
