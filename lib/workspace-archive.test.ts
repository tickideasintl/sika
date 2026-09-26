import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { unzipSync } from "fflate";
import { workspaceArchiveResponse } from "@/app/api/workspace-export/archive/route";
import type { WorkspaceExport, WorkspaceExportFile } from "@/lib/db/workspace-export";
import {
  buildWorkspaceArchive,
  WORKSPACE_ARCHIVE_FORMAT,
  WorkspaceArchiveError,
} from "./workspace-archive";

const workspaceExport: WorkspaceExport = {
  format: "sika-workspace-export",
  version: 5,
  generatedAt: "2026-08-14T10:30:00.000Z",
  workspace: {
    id: "workspace-1",
    userId: "user-1",
    name: "Home & Family",
    type: "personal",
    currency: "GBP",
    envelopeBudgetingEnabled: false,
    categoriesSeeded: true,
    isDefault: true,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z"),
  },
  data: {
    workspaceMemberships: [],
    transactionReviewEvents: [],
    onboardingStatus: [],
    notificationStates: [],
    pushNotificationPreferences: [],
    emailNotificationPreferences: [],
    goals: [],
    goalActivities: [],
    clients: [],
    givingRecipients: [],
    givingDesignations: [],
    givingCommitments: [],
    financialAccounts: [],
    transactionImportProfiles: [],
    transactionRules: [],
    accountTransfers: [],
    transactions: [],
    transactionDocuments: [],
    categories: [],
    budgets: [],
    recurringOutgoings: [],
    recurringMoneyOccurrences: [],
    recurringMoneySettlements: [],
    debtsCredits: [],
    debtBalanceLogs: [],
    debtPayments: [],
    debtStatements: [],
    loansGiven: [],
    loanRepayments: [],
    investments: [],
    investmentEvents: [],
  },
};

const sourceFile: WorkspaceExportFile = {
  documentId: "document-1",
  transactionId: "transaction-1",
  storageKey: "private/document-1.pdf",
  fileName: "../../Giving receipt",
  mimeType: "application/pdf",
  sizeBytes: 4,
  source: "supporting_document",
};

describe("workspace ZIP archive", () => {
  it("packages the workspace, files, checksums, and a safe attachment index", async () => {
    const bytes = await buildWorkspaceArchive(workspaceExport, [sourceFile], async (workspaceId, key) => {
      assert.equal(workspaceId, workspaceExport.workspace.id);
      assert.equal(key, sourceFile.storageKey);
      return { bytes: Uint8Array.from([1, 2, 3, 4]), contentType: "application/pdf" };
    });
    const entries = unzipSync(bytes);
    assert.ok(entries["workspace.json"]);
    assert.ok(entries["attachments.json"]);

    const exportedWorkspace = JSON.parse(new TextDecoder().decode(entries["workspace.json"]));
    assert.equal(exportedWorkspace.workspace.id, workspaceExport.workspace.id);
    const attachmentIndex = JSON.parse(new TextDecoder().decode(entries["attachments.json"]));
    assert.equal(attachmentIndex.format, WORKSPACE_ARCHIVE_FORMAT);
    assert.equal(attachmentIndex.files.length, 1);
    assert.equal(
      attachmentIndex.files[0].sha256,
      "9f64a747e1b97f131fabb6b447296c9b6f0201e79fb3c5356e6c77e89b6a806a",
    );
    const path = attachmentIndex.files[0].archivePath as string;
    assert.match(path, /^attachments\/transaction-1\/document-1-/);
    assert.match(path, /\.pdf$/);
    assert.doesNotMatch(path, /\/(?:\.\.?)(?:\/|$)/);
    assert.deepEqual(entries[path], Uint8Array.from([1, 2, 3, 4]));

    const response = workspaceArchiveResponse({
      bytes,
      workspaceName: workspaceExport.workspace.name,
      generatedAt: workspaceExport.generatedAt,
    });
    assert.equal(response.headers.get("content-type"), "application/zip");
    assert.equal(response.headers.get("cache-control"), "private, no-store");
    assert.equal(
      response.headers.get("content-disposition"),
      'attachment; filename="sika-home-family-2026-08-14.zip"',
    );
  });

  it("fails rather than producing an incomplete archive", async () => {
    await assert.rejects(
      buildWorkspaceArchive(workspaceExport, [sourceFile], async () => {
        throw new Error("NoSuchKey: private details");
      }),
      (error) =>
        error instanceof WorkspaceArchiveError &&
        error.code === "file_unavailable" &&
        !error.message.includes("private details"),
    );
    await assert.rejects(
      buildWorkspaceArchive(
        workspaceExport,
        [{ ...sourceFile, storageKey: "https://files.example.test/receipt.pdf" }],
        async () => ({ bytes: new Uint8Array([1]), contentType: undefined }),
      ),
      (error) => error instanceof WorkspaceArchiveError && error.code === "external_file",
    );
  });
});
