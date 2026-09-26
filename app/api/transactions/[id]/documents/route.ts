import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as documentsService from "@/lib/db/transaction-documents";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  deleteStoredDocument,
  isStorageConfigured,
  uploadSupportingDocument,
} from "@/lib/storage";
import {
  detectSupportingDocumentMime,
  MAX_SUPPORTING_DOCUMENT_SIZE,
  SUPPORTING_DOCUMENT_MIME_TYPES,
} from "@/lib/supporting-documents";

function toDocument(transactionId: string, row: Awaited<ReturnType<typeof documentsService.list>>[number]) {
  return {
    id: row.id,
    file_name: row.fileName,
    mime_type: row.mimeType,
    size_bytes: row.sizeBytes,
    created_at: row.createdAt.toISOString(),
    download_url: `/api/transactions/${transactionId}/documents/${row.id}`,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;
    const rows = await documentsService.list(workspaceId, id);
    return NextResponse.json({
      documents: rows.map((row) => toDocument(id, row)),
      storage_configured: isStorageConfigured(),
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("only available")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to fetch supporting documents");
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const rateLimit = checkRateLimit(`${actorUserId}:supporting-documents`, {
      limit: 20,
      windowMs: 60_000,
    });
    if (!rateLimit.success) {
      return NextResponse.json({ error: "Too many uploads. Please wait a minute." }, { status: 429 });
    }
    await documentsService.assertCanUpload(workspaceId, id);
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: "File storage is not configured on this Sika instance" },
        { status: 503 },
      );
    }

    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }
    if (file.size === 0 || file.size > MAX_SUPPORTING_DOCUMENT_SIZE) {
      return NextResponse.json(
        { error: "Documents must be between 1 byte and 10 MB" },
        { status: file.size > MAX_SUPPORTING_DOCUMENT_SIZE ? 413 : 400 },
      );
    }
    if (!SUPPORTING_DOCUMENT_MIME_TYPES.has(file.type)) {
      return NextResponse.json({ error: "Accepted document types are PDF, JPG, PNG, and WebP" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const detectedMime = detectSupportingDocumentMime(buffer);
    if (!detectedMime || detectedMime !== file.type) {
      return NextResponse.json({ error: "The file content does not match its declared type" }, { status: 400 });
    }

    const uploaded = await uploadSupportingDocument(buffer, detectedMime, workspaceId);
    try {
      const row = await documentsService.create(workspaceId, id, {
        storageKey: uploaded.key,
        fileName: file.name,
        mimeType: detectedMime,
        sizeBytes: file.size,
      });
      return NextResponse.json({ document: toDocument(id, row) }, { status: 201 });
    } catch (error) {
      await deleteStoredDocument(workspaceId, uploaded.key).catch((cleanupError) => {
        console.error("Failed to clean up supporting document upload:", cleanupError);
      });
      throw error;
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("only be added")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof Error && error.message.includes("at most")) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    return errorResponse(error, "Failed to upload supporting document");
  }
}
