import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { storedObjects, transactions, users, workspaces } from "@/db/schema";
import * as documentsService from "./transaction-documents";
import * as transactionsService from "./transactions";

describe(
  "transaction supporting documents regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("scopes documents to a workspace and only uploads them to gifts", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Document test user",
        email: `documents-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        { id: workspaceId, userId, name: "Personal", type: "personal", currency: "GBP", isDefault: true },
        { id: otherWorkspaceId, userId, name: "Other", type: "personal", currency: "GBP", isDefault: false },
      ]);

      try {
        // Simulate server-side upload provenance; references alone are no longer enough.
        await db.insert(storedObjects).values([
          "receipts/legacy.jpg",
          "supporting-documents/expense.pdf",
          "supporting-documents/other.pdf",
          "supporting-documents/concurrent-a.pdf",
          "supporting-documents/concurrent-b.pdf",
          "supporting-documents/type-race.pdf",
          ...Array.from({ length: 9 }, (_, index) => `supporting-documents/${index}.pdf`),
        ].map((storageKey) => ({ storageKey, workspaceId })));
        const gift = await transactionsService.create(workspaceId, {
          amount: 100,
          date: "2026-08-01",
          type: "giving",
          category: "Offering",
          receiptStorageId: "receipts/legacy.jpg",
        });
        const expense = await transactionsService.create(workspaceId, {
          amount: 20,
          date: "2026-08-01",
          type: "expense",
          category: "Food",
        });

        await assert.rejects(
          () => documentsService.create(workspaceId, expense.id, {
            storageKey: "supporting-documents/expense.pdf",
            fileName: "expense.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
          }),
          /only be added to giving/,
        );
        await assert.rejects(
          () => documentsService.list(workspaceId, expense.id),
          /only available for giving/,
        );

        const legacy = await documentsService.create(workspaceId, gift.id, {
          storageKey: "receipts/legacy.jpg",
          fileName: "  Receipt\u0000.jpg  ",
          mimeType: "image/jpeg",
          sizeBytes: 100,
        });
        const rows = await documentsService.list(workspaceId, gift.id);
        assert.equal(rows.length, 1);
        assert.equal(rows[0]?.fileName, "Receipt.jpg");
        await assert.rejects(
          () => documentsService.list(otherWorkspaceId, gift.id),
          /not found or unauthorized/,
        );

        const otherDocument = await documentsService.create(workspaceId, gift.id, {
          storageKey: "supporting-documents/other.pdf",
          fileName: "other.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        });
        await documentsService.remove(workspaceId, gift.id, otherDocument.id);
        const [giftWithLegacyReceipt] = await db
          .select({ receiptStorageId: transactions.receiptStorageId })
          .from(transactions)
          .where(eq(transactions.id, gift.id));
        assert.equal(
          giftWithLegacyReceipt?.receiptStorageId,
          "receipts/legacy.jpg",
          "removing another document preserves the legacy receipt field",
        );

        await documentsService.remove(workspaceId, gift.id, legacy.id);
        const [updatedGift] = await db
          .select({ receiptStorageId: transactions.receiptStorageId })
          .from(transactions)
          .where(eq(transactions.id, gift.id));
        assert.equal(updatedGift?.receiptStorageId, null, "removing a backfilled receipt clears the legacy field");

        for (let index = 0; index < 9; index += 1) {
          await documentsService.create(workspaceId, gift.id, {
            storageKey: `supporting-documents/${index}.pdf`,
            fileName: `${index}.pdf`,
            mimeType: "application/pdf",
            sizeBytes: 100,
          });
        }
        const concurrentUploads = await Promise.allSettled([
          documentsService.create(workspaceId, gift.id, {
            storageKey: "supporting-documents/concurrent-a.pdf",
            fileName: "concurrent-a.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
          }),
          documentsService.create(workspaceId, gift.id, {
            storageKey: "supporting-documents/concurrent-b.pdf",
            fileName: "concurrent-b.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
          }),
        ]);
        assert.equal(concurrentUploads.filter((result) => result.status === "fulfilled").length, 1);
        assert.equal(concurrentUploads.filter((result) => result.status === "rejected").length, 1);
        assert.equal((await documentsService.list(workspaceId, gift.id)).length, 10);
        await assert.rejects(
          () => transactionsService.update(workspaceId, gift.id, { type: "expense" }),
          /Remove this gift's supporting documents/,
        );

        const concurrentGift = await transactionsService.create(workspaceId, {
          amount: 50,
          date: "2026-08-02",
          type: "giving",
          category: "Offering",
        });
        const typeChangeAndUpload = await Promise.allSettled([
          transactionsService.update(workspaceId, concurrentGift.id, { type: "expense" }),
          documentsService.create(workspaceId, concurrentGift.id, {
            storageKey: "supporting-documents/type-race.pdf",
            fileName: "type-race.pdf",
            mimeType: "application/pdf",
            sizeBytes: 100,
          }),
        ]);
        assert.equal(typeChangeAndUpload.filter((result) => result.status === "fulfilled").length, 1);
        const [concurrentGiftAfter] = await db
          .select({ type: transactions.type })
          .from(transactions)
          .where(eq(transactions.id, concurrentGift.id));
        const concurrentDocuments = await documentsService.listForTransactionDeletion(
          workspaceId,
          concurrentGift.id,
        );
        assert.ok(
          (concurrentGiftAfter?.type === "giving" && concurrentDocuments.length === 1) ||
            (concurrentGiftAfter?.type === "expense" && concurrentDocuments.length === 0),
          "a type change and upload cannot leave documents on a non-giving transaction",
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });

    it("finds only in-period gifts without legacy or supporting documents", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      await db.insert(users).values({
        id: userId,
        name: "Missing document test user",
        email: `missing-documents-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        { id: workspaceId, userId, name: "Personal", type: "personal", currency: "GBP", isDefault: true },
        { id: otherWorkspaceId, userId, name: "Other", type: "personal", currency: "GBP", isDefault: false },
      ]);

      try {
        await db.insert(storedObjects).values([
          { storageKey: "supporting-documents/evidence.pdf", workspaceId },
          { storageKey: "receipts/legacy.pdf", workspaceId },
        ]);
        const olderMissing = await transactionsService.create(workspaceId, {
          amount: 25,
          date: "2026-03-01",
          type: "giving",
          category: "Offering",
        });
        const newerMissing = await transactionsService.create(workspaceId, {
          amount: 50,
          date: "2026-05-01",
          type: "giving",
          category: "Offering",
        });
        const documented = await transactionsService.create(workspaceId, {
          amount: 75,
          date: "2026-04-01",
          type: "giving",
          category: "Offering",
        });
        await documentsService.create(workspaceId, documented.id, {
          storageKey: "supporting-documents/evidence.pdf",
          fileName: "evidence.pdf",
          mimeType: "application/pdf",
          sizeBytes: 100,
        });
        await transactionsService.create(workspaceId, {
          amount: 100,
          date: "2026-06-01",
          type: "giving",
          category: "Offering",
          receiptStorageId: "receipts/legacy.pdf",
        });
        await transactionsService.create(workspaceId, {
          amount: 20,
          date: "2025-12-31",
          type: "giving",
          category: "Offering",
        });
        await transactionsService.create(otherWorkspaceId, {
          amount: 30,
          date: "2026-02-01",
          type: "giving",
          category: "Offering",
        });
        await transactionsService.create(workspaceId, {
          amount: 10,
          date: "2026-01-01",
          type: "expense",
          category: "Food",
        });

        const firstPage = await documentsService.listMissingForGiving(
          workspaceId,
          "2026-01-01",
          "2026-12-31",
          0,
          1,
        );
        assert.equal(firstPage.total, 2);
        assert.equal(firstPage.hasMore, true);
        assert.deepEqual(firstPage.rows.map((row) => row.id), [newerMissing.id]);
        const secondPage = await documentsService.listMissingForGiving(
          workspaceId,
          "2026-01-01",
          "2026-12-31",
          1,
          1,
        );
        assert.equal(secondPage.hasMore, false);
        assert.deepEqual(secondPage.rows.map((row) => row.id), [olderMissing.id]);
        await assert.rejects(
          () => documentsService.listMissingForGiving(
            workspaceId,
            "2026-12-31",
            "2026-01-01",
          ),
          /period end must not be before period start/,
        );
      } finally {
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
