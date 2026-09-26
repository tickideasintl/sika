import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  assertStoredObjectInWorkspace,
  registerStoredObject,
  StoredObjectOwnershipError,
} from "./stored-objects";
import * as workspaces from "./workspaces";
import * as transactions from "./transactions";
import { createWorkspaceArchiveSource } from "./workspace-export";

describe("stored object ownership regression", {
  skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL",
}, () => {
  it("enforces durable ownership across writes and archive queries", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId,
      name: "Receipt ownership test",
      email: `receipt-${userId}@example.com`,
    });
    try {
      const first = await workspaces.create(userId, { name: "First", type: "personal" });
      const second = await workspaces.create(userId, { name: "Second", type: "business" });
      const key = `receipts/${crypto.randomUUID()}.jpg`;
      await registerStoredObject(first.id, key);
      await assertStoredObjectInWorkspace(first.id, key);
      await assert.rejects(
        assertStoredObjectInWorkspace(second.id, key), StoredObjectOwnershipError,
      );
      await assert.rejects(registerStoredObject(second.id, key));
      await assertStoredObjectInWorkspace(first.id, key);

      const input = {
        amount: 10, date: "2026-09-01", type: "expense" as const,
        category: "Food", receiptStorageId: key,
      };
      await assert.rejects(transactions.create(second.id, input), StoredObjectOwnershipError);
      const own = await transactions.create(first.id, input);
      const other = await transactions.create(second.id, { ...input, receiptStorageId: null });
      await assert.rejects(
        transactions.update(second.id, other.id, { receiptStorageId: key }),
        StoredObjectOwnershipError,
      );
      assert.equal((await transactions.getById(second.id, other.id))?.receiptStorageId, null);
      const archive = await createWorkspaceArchiveSource(first.id);
      assert.ok(archive.files.some((file) => file.transactionId === own.id && file.storageKey === key));
      assert.equal((await createWorkspaceArchiveSource(second.id)).files.length, 0);
    } finally {
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
