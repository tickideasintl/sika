import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  aiProviderSettings,
  backupStatus,
  investmentEvents,
  investments,
  pushSubscriptions,
  storedObjects,
  transactionDocuments,
  transactions,
  users,
  workspaces,
} from "@/db/schema";
import { workspaceExportResponse } from "@/app/api/workspace-export/route";
import {
  createWorkspaceArchiveSource,
  createWorkspaceExport,
  WORKSPACE_EXPORT_DATASETS,
  WORKSPACE_EXPORT_FORMAT,
} from "./workspace-export";

describe(
  "workspace JSON export regression",
  { skip: process.env.DATABASE_URL ? false : "requires DATABASE_URL" },
  () => {
    it("exports every portable dataset from only the requested workspace", async () => {
      const userId = crypto.randomUUID();
      const workspaceId = crypto.randomUUID();
      const otherWorkspaceId = crypto.randomUUID();
      const transactionId = crypto.randomUUID();
      const otherTransactionId = crypto.randomUUID();
      const generatedAt = new Date("2026-08-14T10:30:00.000Z");

      await db.insert(users).values({
        id: userId,
        name: "Export test user",
        email: `workspace-export-${userId.slice(0, 8)}@example.com`,
      });
      await db.insert(workspaces).values([
        {
          id: workspaceId,
          userId,
          name: "Home & Family",
          type: "personal",
          currency: "GBP",
          isDefault: true,
        },
        {
          id: otherWorkspaceId,
          userId,
          name: "Private business",
          type: "business",
          currency: "USD",
        },
      ]);

      try {
        await db.insert(storedObjects).values({
          storageKey: "supporting-documents/document-object-key",
          workspaceId,
        });
        await db.insert(transactions).values([
          {
            id: transactionId,
            userId,
            workspaceId,
            amount: "25.00",
            date: "2026-08-01",
            type: "giving",
            category: "Community",
            receiptStorageId: "supporting-documents/document-object-key",
          },
          {
            id: otherTransactionId,
            userId,
            workspaceId: otherWorkspaceId,
            amount: "900.00",
            date: "2026-08-02",
            type: "income",
            category: "Secret client",
            receiptStorageId: "other-workspace/private-receipt",
          },
        ]);
        await db.insert(transactionDocuments).values({
          id: crypto.randomUUID(),
          userId,
          workspaceId,
          transactionId,
          storageKey: "supporting-documents/document-object-key",
          fileName: "receipt.pdf",
          mimeType: "application/pdf",
          sizeBytes: 1200,
        });

        const investmentId = crypto.randomUUID();
        await db.insert(investments).values({
          id: investmentId,
          userId,
          workspaceId,
          name: "Index fund",
          investmentType: "stock",
          costBasis: "100.00",
          currentValue: "105.00",
          purchaseDate: "2026-01-01",
        });
        await db.insert(investmentEvents).values({
          id: crypto.randomUUID(),
          investmentId,
          userId,
          eventType: "dividend",
          amount: "5.00",
          eventDate: "2026-08-01",
        });

        await db.insert(pushSubscriptions).values({
          id: crypto.randomUUID(),
          userId,
          workspaceId,
          endpoint: "https://push.example.test/private-capability",
          p256dh: "private-p256dh-key",
          auth: "private-push-auth",
        });
        await db.insert(aiProviderSettings).values({
          id: crypto.randomUUID(),
          userId,
          apiKey: "encrypted-private-ai-key",
        });
        await db.insert(backupStatus).values({
          id: crypto.randomUUID(),
          lastSuccessfulAt: generatedAt,
        });

        const exported = await createWorkspaceExport(workspaceId, generatedAt);
        assert.equal(exported.format, WORKSPACE_EXPORT_FORMAT);
        assert.equal(exported.version, 5);
        assert.equal(exported.generatedAt, generatedAt.toISOString());
        assert.equal(exported.workspace.id, workspaceId);
        assert.deepEqual(Object.keys(exported.data), [...WORKSPACE_EXPORT_DATASETS]);
        assert.deepEqual(
          exported.data.transactions.map((row) => (row as { id: string }).id),
          [transactionId],
        );
        assert.equal(exported.data.investmentEvents.length, 1, "includes child records via workspace parent");

        const serialized = JSON.stringify(exported);
        assert.doesNotMatch(serialized, /Secret client|private business/i);
        assert.doesNotMatch(serialized, /private\/receipt-storage-key|supporting-documents\/document-object-key/);
        assert.doesNotMatch(serialized, /private-capability|private-p256dh-key|private-push-auth/);
        assert.doesNotMatch(serialized, /encrypted-private-ai-key/);

        const archiveSource = await createWorkspaceArchiveSource(
          workspaceId,
          generatedAt,
        );
        assert.equal(archiveSource.files.length, 1, "does not duplicate a backfilled receipt");
        assert.equal(archiveSource.files[0]?.transactionId, transactionId);
        assert.equal(archiveSource.files[0]?.storageKey, "supporting-documents/document-object-key");
        assert.doesNotMatch(JSON.stringify(archiveSource.files), /other-workspace/);
        assert.doesNotMatch(
          JSON.stringify(archiveSource.workspaceExport),
          /supporting-documents\/document-object-key/,
        );

        await assert.rejects(
          createWorkspaceExport(crypto.randomUUID()),
          /not found or unauthorized/i,
        );

        const response = workspaceExportResponse(exported);
        assert.equal(response.headers.get("content-type"), "application/json; charset=utf-8");
        assert.equal(response.headers.get("cache-control"), "private, no-store");
        assert.equal(
          response.headers.get("content-disposition"),
          'attachment; filename="sika-home-family-2026-08-14.json"',
        );
        assert.equal((await response.json()).workspace.id, workspaceId);
      } finally {
        await db.delete(backupStatus);
        await db.delete(users).where(eq(users.id, userId));
      }
    });
  },
);
