import { requireAuthWithWorkspace } from "@/lib/auth-server";
import * as txService from "@/lib/db/transactions";
import * as documentsService from "@/lib/db/transaction-documents";
import { RecurringMoneyConstraintError } from "@/lib/recurring-money-occurrences";
import { deleteStoredDocument, isStorageConfigured } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";

/** Map DB row → stable API response shape. */
function toTransaction(row: NonNullable<Awaited<ReturnType<typeof txService.getById>>>) {
  return {
    id: row.id,
    amount: Number(row.amount),
    date: row.date,
    type: row.type,
    account_id: row.accountId ?? null,
    status: row.status,
    needs_review: row.needsReview,
    assigned_to_user_id: row.assignedToUserId ?? null,
    reviewed_at: row.reviewedAt ? new Date(row.reviewedAt).toISOString() : null,
    reviewed_by_user_id: row.reviewedByUserId ?? null,
    category: row.category,
    payee: row.payee ?? null,
    client_id: row.clientId ?? null,
    giving_recipient_id: row.givingRecipientId ?? null,
    giving_designation_id: row.givingDesignationId ?? null,
    notes: row.notes ?? null,
    tags: Array.isArray(row.tags) ? row.tags : [],
    receipt_url: row.receiptStorageId ?? null,
    created_at: row.createdAt ? new Date(row.createdAt).toISOString() : null,
    updated_at: row.updatedAt ? new Date(row.updatedAt).toISOString() : null,
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace("viewer");
    const { id } = await params;

    const row = await txService.getById(workspaceId, id);
    if (!row) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ transaction: toTransaction(row) });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("Failed to fetch transaction:", error);
    return NextResponse.json(
      { error: "Failed to fetch transaction" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { actorUserId, workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;
    const body = await request.json();

    const receiptStorageId = body.receiptStorageId !== undefined
      ? body.receiptStorageId
      : body.receipt_url !== undefined
        ? body.receipt_url
        : undefined;

    const row = await txService.update(workspaceId, id, {
      ...(body.amount !== undefined && { amount: body.amount }),
      ...(body.date !== undefined && { date: body.date }),
      ...(body.type !== undefined && { type: body.type }),
      ...("accountId" in body && { accountId: body.accountId }),
      ...("account_id" in body && { accountId: body.account_id }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.needsReview !== undefined && { needsReview: body.needsReview }),
      ...("assignedToUserId" in body && { assignedToUserId: body.assignedToUserId }),
      ...("assigned_to_user_id" in body && { assignedToUserId: body.assigned_to_user_id }),
      ...(body.category !== undefined && { category: body.category }),
      ...("payee" in body && { payee: body.payee }),
      // `in` rather than `??` so an explicit null clears the attribution.
      ...("clientId" in body && { clientId: body.clientId }),
      ...("client_id" in body && { clientId: body.client_id }),
      ...("givingRecipientId" in body && { givingRecipientId: body.givingRecipientId }),
      ...("giving_recipient_id" in body && { givingRecipientId: body.giving_recipient_id }),
      ...("givingDesignationId" in body && {
        givingDesignationId: body.givingDesignationId,
      }),
      ...("giving_designation_id" in body && {
        givingDesignationId: body.giving_designation_id,
      }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.tags !== undefined && { tags: body.tags }),
      ...(receiptStorageId !== undefined && { receiptStorageId }),
    }, actorUserId);

    return NextResponse.json({
      success: true,
      transaction: toTransaction(row),
    });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Validation error" },
        { status: 400 },
      );
    }
    if (error instanceof txService.GivingAttributionError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof RecurringMoneyConstraintError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to update transaction:", error);
    return NextResponse.json(
      { error: "Failed to update transaction" },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuthWithWorkspace();
    const { id } = await params;

    const documents = await documentsService.listForTransactionDeletion(workspaceId, id);
    await txService.remove(workspaceId, id);
    if (isStorageConfigured()) {
      await Promise.all(
        documents.map(async (document) => {
          if (/^https?:\/\//i.test(document.storageKey)) return;
          await deleteStoredDocument(workspaceId, document.storageKey).catch((error) => {
            console.error("Failed to delete stored transaction document:", error);
          });
        }),
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (
      error instanceof Error &&
      (error.message.includes("not found") ||
        error.message.includes("unauthorized"))
    ) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    console.error("Failed to delete transaction:", error);
    return NextResponse.json(
      { error: "Failed to delete transaction" },
      { status: 500 },
    );
  }
}
