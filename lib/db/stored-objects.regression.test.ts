import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { users } from "@/db/schema";
import {
  assertStoredObjectInWorkspace,
  registerStoredObject,
  retireUnreferencedStoredObject,
  StoredObjectOwnershipError,
} from "./stored-objects";
import * as workspaces from "./workspaces";
import * as transactions from "./transactions";
import * as documents from "./transaction-documents";
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

  it("retains shared documents and receipts, then rejects retired keys", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId, name: "Shared attachment test", email: `shared-${userId}@example.com`,
    });
    try {
      const workspace = await workspaces.create(userId, { name: "Shared", type: "personal" });
      const key = `receipts/${crypto.randomUUID()}.pdf`;
      await registerStoredObject(workspace.id, key);
      const input = {
        amount: 10, date: "2026-09-01", type: "giving" as const, category: "Giving",
        receiptStorageId: key,
      };
      const first = await transactions.create(workspace.id, input);
      const second = await transactions.create(workspace.id, input);
      const attachment = { storageKey: key, fileName: "Receipt.pdf", mimeType: "application/pdf", sizeBytes: 10 };
      const firstDoc = await documents.create(workspace.id, first.id, attachment);
      const secondDoc = await documents.create(workspace.id, second.id, attachment);
      await documents.remove(workspace.id, first.id, firstDoc.id);
      assert.equal(await retireUnreferencedStoredObject(workspace.id, key), false);
      await documents.remove(workspace.id, second.id, secondDoc.id);
      // Reattach a receipt without a document: it independently protects the key.
      await transactions.update(workspace.id, first.id, { receiptStorageId: key });
      assert.equal(await retireUnreferencedStoredObject(workspace.id, key), false);
      await transactions.remove(workspace.id, first.id);
      assert.equal(await retireUnreferencedStoredObject(workspace.id, key), true);
      await assert.rejects(transactions.create(workspace.id, input), StoredObjectOwnershipError);
      await assert.rejects(documents.create(workspace.id, second.id, attachment), StoredObjectOwnershipError);
    } finally {
      await db.delete(users).where(eq(users.id, userId));
    }
  });

  it("serializes retirement against each reference creation boundary", async () => {
    const userId = crypto.randomUUID();
    await db.insert(users).values({
      id: userId, name: "Attachment race test", email: `race-${userId}@example.com`,
    });
    try {
      const workspace = await workspaces.create(userId, { name: "Race", type: "personal" });
      const input = { amount: 10, date: "2026-09-01", type: "giving" as const, category: "Giving" };
      const target = await transactions.create(workspace.id, input);
      for (const kind of ["create", "update", "document"]) {
        const key = `receipts/${crypto.randomUUID()}.pdf`;
        await registerStoredObject(workspace.id, key);
        const attach = () => kind === "create"
          ? transactions.create(workspace.id, { ...input, receiptStorageId: key })
          : kind === "update"
            ? transactions.update(workspace.id, target.id, { receiptStorageId: key })
            : documents.create(workspace.id, target.id, {
              storageKey: key, fileName: "Receipt.pdf", mimeType: "application/pdf", sizeBytes: 10,
            });
        const [write, retirement] = await Promise.allSettled([
          attach(), retireUnreferencedStoredObject(workspace.id, key),
        ]);
        assert.equal(retirement.status, "fulfilled");
        if (retirement.value) {
          assert.equal(write.status, "rejected");
          if (write.status === "rejected") assert.ok(write.reason instanceof StoredObjectOwnershipError);
        } else {
          assert.equal(write.status, "fulfilled");
          await assertStoredObjectInWorkspace(workspace.id, key);
        }
      }
    } finally {
      await db.delete(users).where(eq(users.id, userId));
    }
  });
});
