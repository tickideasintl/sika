"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Camera, Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReceiptScanner } from "./receipt-scanner";
import { ClientPicker, NO_CLIENT } from "./clients/client-picker";
import {
  GivingPicker,
  NO_GIVING_DESIGNATION,
  NO_GIVING_RECIPIENT,
} from "./giving/giving-picker";
import { GivingSupportingDocuments } from "./giving/giving-supporting-documents";
import { useToast } from "@/hooks/use-toast";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import { receiptUpdate } from "@/lib/receipt-update";
import type {
  ApiFinancialAccount,
  ApiTransaction,
  TransactionStatus,
  TransactionType,
} from "@/types";

const NO_ACCOUNT = "__unassigned__";
const NO_REVIEWER = "__unassigned_reviewer__";

type Reviewer = { userId: string; name: string };
type ReviewEvent = {
  id: string;
  action: "assigned" | "unassigned" | "reviewed" | "reopened";
  actor_name: string;
  assigned_to_name: string | null;
  created_at: string;
};

interface ApiCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string | null;
}

interface ReceiptScanResult {
  amount?: number;
  date?: string;
  vendor?: string;
  category?: string;
  receiptUrl?: string;
  storageId?: string;
}

interface TransactionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction?: ApiTransaction | null;
  onSuccess?: () => void;
  defaultType?: TransactionType;
  defaultMode?: "manual" | "scan";
}

export function TransactionForm({
  open,
  onOpenChange,
  transaction,
  onSuccess,
  defaultType = "expense",
  defaultMode = "manual",
}: TransactionFormProps) {
  const { toast } = useToast();
  const { data: catData } = useApiQuery<{ categories: ApiCategory[] }>("/api/categories");
  const { data: accountData } = useApiQuery<{ accounts: ApiFinancialAccount[] }>(
    "/api/financial-accounts",
  );
  const categories = catData?.categories;
  const accounts = accountData?.accounts ?? [];
  const { data: reviewerData } = useApiQuery<{ reviewers: Reviewer[] }>(
    "/api/workspace-reviewers",
  );
  const { data: historyData } = useApiQuery<{ events: ReviewEvent[] }>(
    transaction?.id ? `/api/transactions/${transaction.id}/review-history` : null,
  );

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"manual" | "scan">(defaultMode);
  const [receiptStorageId, setReceiptStorageId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: defaultType,
    accountId: NO_ACCOUNT,
    status: "cleared" as TransactionStatus,
    assignedToUserId: NO_REVIEWER,
    category: "",
    payee: "",
    clientId: NO_CLIENT,
    givingRecipientId: NO_GIVING_RECIPIENT,
    givingDesignationId: NO_GIVING_DESIGNATION,
    notes: "",
    tags: "",
  });

  useEffect(() => {
    if (!open) return;

    if (transaction) {
      setFormData({
        amount: transaction.amount.toString(),
        date: transaction.date,
        type: transaction.type,
        accountId: transaction.account_id ?? NO_ACCOUNT,
        status: transaction.status,
        assignedToUserId: transaction.assigned_to_user_id ?? NO_REVIEWER,
        category: transaction.category,
        payee: transaction.payee ?? "",
        clientId: transaction.client_id ?? NO_CLIENT,
        givingRecipientId: transaction.giving_recipient_id ?? NO_GIVING_RECIPIENT,
        givingDesignationId: transaction.giving_designation_id ?? NO_GIVING_DESIGNATION,
        notes: transaction.notes ?? "",
        tags: transaction.tags.join(", "),
      });
      setReceiptStorageId(transaction.receipt_url ?? null);
      setMode("manual");
      return;
    }

    setFormData({
      amount: "",
      date: new Date().toISOString().split("T")[0],
      type: defaultType,
      accountId: NO_ACCOUNT,
      status: "cleared",
      assignedToUserId: NO_REVIEWER,
      category: "",
      payee: "",
      clientId: NO_CLIENT,
      givingRecipientId: NO_GIVING_RECIPIENT,
      givingDesignationId: NO_GIVING_DESIGNATION,
      notes: "",
      tags: "",
    });
    setReceiptStorageId(null);
    setMode(defaultMode);
  }, [open, transaction, defaultType, defaultMode]);

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((cat) => cat.type === formData.type),
    [categories, formData.type]
  );

  const handleScanComplete = (data: ReceiptScanResult) => {
    setFormData((prev) => ({
      ...prev,
      amount: data.amount ? data.amount.toString() : prev.amount,
      date: data.date || prev.date,
      type: "expense",
      category: data.category || prev.category,
      payee: data.vendor || prev.payee,
    }));

    const storageId = data.storageId ?? data.receiptUrl;
    setReceiptStorageId(storageId ?? null);
    setMode("manual");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    if (!formData.category) {
      toast({ title: "Error", description: "Please select a category", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        amount,
        date: formData.date,
        type: formData.type,
        accountId: formData.accountId === NO_ACCOUNT ? null : formData.accountId,
        status: formData.status,
        ...(transaction && { needsReview: false }),
        ...(transaction && {
          assignedToUserId:
            formData.assignedToUserId === NO_REVIEWER ? null : formData.assignedToUserId,
        }),
        category: formData.category,
        payee: formData.payee || null,
        // Explicit null rather than undefined so clearing the field on an edit
        // actually detaches the client instead of being read as "unchanged".
        clientId:
          formData.type === "giving" || formData.clientId === NO_CLIENT
            ? null
            : formData.clientId,
        givingRecipientId:
          formData.type === "giving" && formData.givingRecipientId !== NO_GIVING_RECIPIENT
            ? formData.givingRecipientId
            : null,
        givingDesignationId:
          formData.type === "giving" &&
          formData.givingRecipientId !== NO_GIVING_RECIPIENT &&
          formData.givingDesignationId !== NO_GIVING_DESIGNATION
            ? formData.givingDesignationId
            : null,
        notes: formData.notes || undefined,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        ...receiptUpdate(receiptStorageId, transaction),
      };

      if (transaction?.id) {
        await apiFetch(`/api/transactions/${transaction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/transactions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      toast({
        title: "Saved",
        description: transaction ? "Transaction updated" : "Transaction added",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to save transaction";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{transaction ? "Edit transaction" : "Add transaction"}</DialogTitle>
          <DialogDescription>
            Keep it simple. Add your income, expense, or giving in a few fields.
          </DialogDescription>
        </DialogHeader>

        {!transaction && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="lg"
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
            >
              <Pencil className="size-4" />
              Manual
            </Button>
            <Button
              type="button"
              size="lg"
              variant={mode === "scan" ? "default" : "outline"}
              onClick={() => setMode("scan")}
            >
              <Camera className="size-4" />
              Scan Receipt
            </Button>
          </div>
        )}

        {!transaction && mode === "scan" ? (
          <ReceiptScanner onScanComplete={handleScanComplete} onCancel={() => setMode("manual")} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {receiptStorageId && (
              <div className="flex items-center justify-between gap-3 rounded-[0.6875rem] border border-border/60 p-3">
                <p className="text-sm text-muted-foreground">Receipt attached</p>
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  disabled={loading}
                  onClick={() => setReceiptStorageId(null)}
                >
                  Remove receipt
                </Button>
              </div>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TransactionType) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value,
                      category: "",
                      givingRecipientId: NO_GIVING_RECIPIENT,
                      givingDesignationId: NO_GIVING_DESIGNATION,
                    }))
                  }
                >
                  <SelectTrigger id="type" aria-label="Transaction type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="income">Income</SelectItem>
                    <SelectItem value="expense">Expense</SelectItem>
                    <SelectItem value="giving">Giving</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="amount">Amount</Label>
                <Input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                  required
                />
              </div>
            </div>

            {transaction && (
              <div className="space-y-2">
                <Label>Review owner</Label>
                <Select
                  value={formData.assignedToUserId}
                  onValueChange={(value) =>
                    setFormData((previous) => ({ ...previous, assignedToUserId: value }))
                  }
                >
                  <SelectTrigger aria-label="Transaction review owner"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_REVIEWER}>Unassigned</SelectItem>
                    {(reviewerData?.reviewers ?? []).map((reviewer) => (
                      <SelectItem key={reviewer.userId} value={reviewer.userId}>
                        {reviewer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Account (optional)</Label>
                <Select
                  value={formData.accountId}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, accountId: value }))}
                  disabled={transaction?.status === "reconciled"}
                >
                  <SelectTrigger aria-label="Financial account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>Unassigned</SelectItem>
                    {accounts.map((account) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: TransactionStatus) =>
                    setFormData((prev) => ({ ...prev, status: value }))
                  }
                  disabled={transaction?.status === "reconciled"}
                >
                  <SelectTrigger aria-label="Transaction status">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="cleared">Cleared</SelectItem>
                    {transaction?.status === "reconciled" && (
                      <SelectItem value="reconciled">Reconciled</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Input
                  id="date"
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData((prev) => ({ ...prev, date: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="category">Category</Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
                >
                  <SelectTrigger id="category" aria-label="Category">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredCategories.map((cat) => (
                      <SelectItem key={cat.id} value={cat.name}>
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.type === "giving" ? (
              <GivingPicker
                recipientId={formData.givingRecipientId}
                designationId={formData.givingDesignationId}
                onRecipientChange={(value) => setFormData((prev) => ({
                  ...prev,
                  givingRecipientId: value,
                  givingDesignationId: NO_GIVING_DESIGNATION,
                }))}
                onDesignationChange={(value) => setFormData((prev) => ({
                  ...prev,
                  givingDesignationId: value,
                }))}
              />
            ) : (
              <ClientPicker
                value={formData.clientId}
                onChange={(value) => setFormData((prev) => ({ ...prev, clientId: value }))}
              />
            )}

            <div className="space-y-2">
              <Label htmlFor="payee">Payee or merchant (optional)</Label>
              <Input
                id="payee"
                value={formData.payee}
                onChange={(e) => setFormData((prev) => ({ ...prev, payee: e.target.value }))}
                placeholder="Who the money was paid to or received from"
                maxLength={200}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                rows={3}
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Optional note"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags (optional)</Label>
              <Input
                id="tags"
                value={formData.tags}
                onChange={(e) => setFormData((prev) => ({ ...prev, tags: e.target.value }))}
                placeholder="tax-deductible, reimbursable, vacation"
              />
            </div>

            {receiptStorageId && formData.type !== "giving" && (
              <p className="text-sm text-muted-foreground">Receipt attached</p>
            )}

            {(formData.type === "giving" || transaction?.type === "giving") && (
              transaction?.id ? (
                <div className="space-y-2">
                  {formData.type !== "giving" && (
                    <p className="text-xs text-muted-foreground">
                      Remove all supporting documents before changing this gift to another type.
                    </p>
                  )}
                  <GivingSupportingDocuments transactionId={transaction.id} />
                </div>
              ) : (
                <p className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                  Save this gift, then edit it to add receipts, acknowledgement letters, or payment evidence.
                </p>
              )
            )}

            {transaction && (historyData?.events.length ?? 0) > 0 && (
              <div className="space-y-2 rounded-xl border border-border/70 bg-secondary/20 p-4">
                <p className="text-sm font-medium">Review history</p>
                <div className="space-y-2">
                  {historyData!.events.map((event) => (
                    <p key={event.id} className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{event.actor_name}</span>{" "}
                      {event.action === "assigned"
                        ? `assigned this to ${event.assigned_to_name}`
                        : event.action === "unassigned"
                          ? "removed the reviewer"
                          : event.action === "reviewed"
                            ? "marked this reviewed"
                            : "reopened review"}{" "}
                      · {new Date(event.created_at).toLocaleString()}
                    </p>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                className="h-11"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" className="h-11" disabled={loading}>
                {loading && <Loader2 className="size-4 animate-spin" />}
                {transaction ? "Save changes" : "Add transaction"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
