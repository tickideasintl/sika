"use client";

import { useState } from "react";
import {
  Plus,
  Loader2,
  ChevronDown,
  ChevronUp,
  History,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiLoanRepayment } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface RepaymentSectionProps {
  loanId: string;
  onChanged: () => void;
}

export function RepaymentSection({ loanId, onChanged }: RepaymentSectionProps) {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<{ repayments: ApiLoanRepayment[] }>(
    `/api/loans-given/${loanId}/repayments`,
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    amount: "",
    repaymentDate: new Date().toISOString().split("T")[0],
    notes: "",
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/loans-given/${loanId}/repayments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount,
          repaymentDate: formData.repaymentDate,
          notes: formData.notes || null,
        }),
      });

      toast({ title: "Success", description: "Repayment recorded" });
      setIsAddOpen(false);
      setFormData({
        amount: "",
        repaymentDate: new Date().toISOString().split("T")[0],
        notes: "",
      });
      refresh();
      onChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to record repayment";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const repayments = data?.repayments ?? [];

  return (
    <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <History className="size-3.5" />
          Repayment History
        </h4>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="size-3 mr-1" />
              Add Repayment
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Record Repayment</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="repayment-amount">Amount</Label>
                <Input
                  id="repayment-amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.amount}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, amount: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repayment-date">Repayment Date</Label>
                <Input
                  id="repayment-date"
                  type="date"
                  value={formData.repaymentDate}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, repaymentDate: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="repayment-notes">Notes (optional)</Label>
                <Input
                  id="repayment-notes"
                  placeholder="e.g. Bank transfer"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Record Repayment"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="text-center py-3">
          <p className="text-xs text-muted-foreground">{error}</p>
          <Button variant="outline" size="sm" className="mt-2 h-7 text-xs" onClick={refresh}>
            Retry
          </Button>
        </div>
      ) : repayments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No repayments recorded yet
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {repayments.slice(0, 6).map((repayment, i) => {
            const prevRepayment = repayments[i + 1];
            const change = prevRepayment
              ? repayment.amount - prevRepayment.amount
              : null;
            return (
              <div
                key={repayment.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium tabular-nums text-foreground">
                    {formatCurrency(repayment.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(repayment.repayment_date).toLocaleDateString("en-GB")}
                    {repayment.notes && (
                      <span className="ml-2">{repayment.notes}</span>
                    )}
                  </p>
                </div>
                {change !== null && (
                  <span
                    className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${
                      change > 0
                        ? "text-foreground"
                        : change < 0
                        ? "text-expense"
                        : "text-muted-foreground"
                    }`}
                  >
                    {change > 0 ? (
                      <ChevronUp className="size-3" />
                    ) : change < 0 ? (
                      <ChevronDown className="size-3" />
                    ) : null}
                    {change !== 0
                      ? formatCurrency(Math.abs(change))
                      : "No change"}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
