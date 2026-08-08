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
import { useToast } from "@/hooks/use-toast";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { TransactionType, ApiTransaction } from "@/types";

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
  const categories = catData?.categories;

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"manual" | "scan">(defaultMode);
  const [receiptStorageId, setReceiptStorageId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    amount: "",
    date: new Date().toISOString().split("T")[0],
    type: defaultType,
    category: "",
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
        category: transaction.category,
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
      category: "",
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
      notes: data.vendor ? `Vendor: ${data.vendor}` : prev.notes,
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
        category: formData.category,
        notes: formData.notes || undefined,
        tags: formData.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        receiptStorageId: receiptStorageId ?? undefined,
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
              variant={mode === "manual" ? "default" : "outline"}
              onClick={() => setMode("manual")}
            >
              <Pencil className="mr-2 size-4" />
              Manual
            </Button>
            <Button
              type="button"
              variant={mode === "scan" ? "default" : "outline"}
              onClick={() => setMode("scan")}
            >
              <Camera className="mr-2 size-4" />
              Scan Receipt
            </Button>
          </div>
        )}

        {!transaction && mode === "scan" ? (
          <ReceiptScanner onScanComplete={handleScanComplete} onCancel={() => setMode("manual")} />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: TransactionType) =>
                    setFormData((prev) => ({ ...prev, type: value, category: "" }))
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

            {receiptStorageId && (
              <p className="text-sm text-muted-foreground">Receipt attached</p>
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
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                {transaction ? "Save changes" : "Add transaction"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
