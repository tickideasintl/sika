import { NextRequest, NextResponse } from "next/server";
import { requireAuthWithWorkspace } from "@/lib/auth-server";
import { errorResponse } from "@/lib/api-errors";
import * as documentsService from "@/lib/db/transaction-documents";
import { deleteStoredDocument, getStoredDocument, isStorageConfigured } from "@/lib/storage";
import { SUPPORTING_DOCUMENT_MIME_TYPES } from "@/lib/supporting-documents";

type RouteParams = { params: Promise<{ id: string; documentId: string }> };

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id, documentId } = await params;
    const document = await documentsService.get(workspaceId, id, documentId);
    if (!isStorageConfigured()) {
      return NextResponse.json(
        { error: "File storage is not configured on this Sika instance" },
        { status: 503 },
      );
    }
    const stored = await getStoredDocument(workspaceId, document.storageKey);
    const contentType =
      (document.mimeType && SUPPORTING_DOCUMENT_MIME_TYPES.has(document.mimeType)
        ? document.mimeType
        : null) ??
      (stored.contentType && SUPPORTING_DOCUMENT_MIME_TYPES.has(stored.contentType)
        ? stored.contentType
        : "application/octet-stream");
    return new Response(Buffer.from(stored.bytes), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes("only available")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to download supporting document");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id, documentId } = await params;
    const document = await documentsService.remove(workspaceId, id, documentId);
    if (!/^https?:\/\//i.test(document.storageKey) && isStorageConfigured()) {
      await deleteStoredDocument(workspaceId, document.storageKey).catch((error) => {
        console.error("Failed to delete stored supporting document:", error);
      });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message.includes("only available")) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return errorResponse(error, "Failed to remove supporting document");
  }
}
