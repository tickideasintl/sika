import { createHash } from "node:crypto";
import { zipSync } from "fflate";
import {
  createWorkspaceArchiveSource,
  type WorkspaceExport,
  type WorkspaceExportFile,
} from "@/lib/db/workspace-export";
import { getStoredDocument, isStorageConfigured } from "@/lib/storage";

export const WORKSPACE_ARCHIVE_FORMAT = "sika-workspace-archive";
export const WORKSPACE_ARCHIVE_VERSION = 1;

type StoredFile = Awaited<ReturnType<typeof getStoredDocument>>;
type LoadStoredFile = (workspaceId: string, storageKey: string) => Promise<StoredFile>;

export class WorkspaceArchiveError extends Error {
  constructor(
    message: string,
    readonly code: "storage_unavailable" | "external_file" | "file_unavailable",
    readonly documentId: string | null = null,
  ) {
    super(message);
    this.name = "WorkspaceArchiveError";
  }
}

function archivePart(value: string, fallback: string): string {
  return value
    .normalize("NFKD")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^[-.]|[-.]$/g, "")
    .slice(0, 100) || fallback;
}

function extensionForMime(mimeType: string | undefined): string {
  return {
    "application/pdf": ".pdf",
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
    "image/gif": ".gif",
  }[mimeType ?? ""] ?? "";
}

function archivePath(file: WorkspaceExportFile, storedContentType: string | undefined): string {
  const transactionId = archivePart(file.transactionId, "transaction");
  const fileId = archivePart(file.documentId ?? "legacy-receipt", "file");
  let fileName = archivePart(file.fileName, "document");
  if (!/\.[a-zA-Z0-9]{1,8}$/.test(fileName)) {
    fileName += extensionForMime(file.mimeType ?? storedContentType);
  }
  return `attachments/${transactionId}/${fileId}-${fileName}`;
}

export async function buildWorkspaceArchive(
  workspaceExport: WorkspaceExport,
  sourceFiles: WorkspaceExportFile[],
  loadStoredFile: LoadStoredFile,
): Promise<Uint8Array> {
  const entries: Record<string, Uint8Array> = {};
  const fileIndex = [];

  for (const sourceFile of sourceFiles) {
    if (/^https?:\/\//i.test(sourceFile.storageKey)) {
      throw new WorkspaceArchiveError(
        "An attached file uses an external URL and cannot be packaged safely",
        "external_file",
        sourceFile.documentId,
      );
    }

    let stored: StoredFile;
    try {
      stored = await loadStoredFile(workspaceExport.workspace.id, sourceFile.storageKey);
    } catch {
      throw new WorkspaceArchiveError(
        "An attached file could not be read from storage",
        "file_unavailable",
        sourceFile.documentId,
      );
    }
    if (stored.bytes.length === 0) {
      throw new WorkspaceArchiveError(
        "An attached file is empty",
        "file_unavailable",
        sourceFile.documentId,
      );
    }

    const path = archivePath(sourceFile, stored.contentType);
    entries[path] = stored.bytes;
    fileIndex.push({
      source: sourceFile.source,
      documentId: sourceFile.documentId,
      transactionId: sourceFile.transactionId,
      originalFileName: sourceFile.fileName,
      archivePath: path,
      mimeType: sourceFile.mimeType ?? stored.contentType ?? null,
      sizeBytes: stored.bytes.length,
      sha256: createHash("sha256").update(stored.bytes).digest("hex"),
    });
  }

  const encoder = new TextEncoder();
  entries["workspace.json"] = encoder.encode(`${JSON.stringify(workspaceExport, null, 2)}\n`);
  entries["attachments.json"] = encoder.encode(
    `${JSON.stringify(
      {
        format: WORKSPACE_ARCHIVE_FORMAT,
        version: WORKSPACE_ARCHIVE_VERSION,
        generatedAt: workspaceExport.generatedAt,
        workspaceId: workspaceExport.workspace.id,
        files: fileIndex,
      },
      null,
      2,
    )}\n`,
  );

  return zipSync(entries, { level: 6 });
}

export async function createWorkspaceArchive(
  workspaceId: string,
  loadStoredFile?: LoadStoredFile,
): Promise<{ bytes: Uint8Array; workspaceName: string; generatedAt: string }> {
  const source = await createWorkspaceArchiveSource(workspaceId);
  const externalFile = source.files.find((file) => /^https?:\/\//i.test(file.storageKey));
  if (externalFile) {
    throw new WorkspaceArchiveError(
      "An attached file uses an external URL and cannot be packaged safely",
      "external_file",
      externalFile.documentId,
    );
  }
  if (source.files.length > 0 && !loadStoredFile && !isStorageConfigured()) {
    throw new WorkspaceArchiveError(
      "File storage is not configured on this Sika instance",
      "storage_unavailable",
    );
  }
  const bytes = await buildWorkspaceArchive(
    source.workspaceExport,
    source.files,
    loadStoredFile ?? getStoredDocument,
  );
  return {
    bytes,
    workspaceName: source.workspaceExport.workspace.name,
    generatedAt: source.workspaceExport.generatedAt,
  };
}
