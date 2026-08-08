"use client";

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  HandCoins,
  Clock,
  Users,
  CalendarDays,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiLoanGiven, LoanStatus } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { RepaymentSection } from "./loans/repayment-section";
import { LoanFormFields, type LoanFormData } from "./loans/loan-form-fields";

const STATUS_CONFIG: Record<LoanStatus, { label: string; color: string; bg: string }> = {
  active: {
    label: "Active",
    color: "text-income",
    bg: "bg-income-surface",
  },
  partially_repaid: {
    label: "Partially Repaid",
    color: "text-obligation",
    bg: "bg-obligation-surface",
  },
  fully_repaid: {
    label: "Fully Repaid",
    color: "text-foreground",
    bg: "bg-muted",
  },
  defaulted: {
    label: "Defaulted",
    color: "text-expense",
    bg: "bg-expense-surface",
  },
};

interface LoansGivenResponse {
  loans: ApiLoanGiven[];
  total_lent: number;
  total_outstanding: number;
  active_count: number;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export function LoansGivenManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<LoansGivenResponse>("/api/loans-given");

  const loans = data?.loans;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiLoanGiven | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<LoanFormData>({
    borrowerName: "",
    amount: "",
    loanDate: new Date().toISOString().split("T")[0],
    expectedPaybackDate: "",
    interestRate: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      borrowerName: "",
      amount: "",
      loanDate: new Date().toISOString().split("T")[0],
      expectedPaybackDate: "",
      interestRate: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const buildPayload = () => {
    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) return null;

    return {
      borrowerName: formData.borrowerName,
      amount,
      loanDate: formData.loanDate,
      expectedPaybackDate: formData.expectedPaybackDate || null,
      interestRate: formData.interestRate
        ? Number.parseFloat(formData.interestRate)
        : null,
      notes: formData.notes || null,
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/loans-given", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Loan added" });
      setIsAddOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/loans-given/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Loan updated" });
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiLoanGiven) => {
    if (!confirm(`Delete loan to "${item.borrower_name}"? This will also remove all repayment history.`)) return;
    try {
      await apiFetch(`/api/loans-given/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Loan deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: ApiLoanGiven) => {
    setEditingItem(item);
    setFormData({
      borrowerName: item.borrower_name,
      amount: item.amount.toString(),
      loanDate: item.loan_date,
      expectedPaybackDate: item.expected_payback_date ?? "",
      interestRate: item.interest_rate?.toString() ?? "",
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const isOverdue = (item: ApiLoanGiven) => {
    if (!item.expected_payback_date) return false;
    if (item.status === "fully_repaid") return false;
    return new Date(item.expected_payback_date) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || loans === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load loans given."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const formFields = (
    <LoanFormFields
      formData={formData}
      onChange={(updates) => setFormData((prev) => ({ ...prev, ...updates }))}
    />
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Lent</p>
                <p className="text-2xl font-semibold text-income tabular-nums">
                  {formatCurrency(data?.total_lent ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-income-surface p-3">
                <HandCoins className="size-6 text-income" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Outstanding</p>
                <p className="text-2xl font-semibold text-obligation tabular-nums">
                  {formatCurrency(data?.total_outstanding ?? 0)}
                </p>
              </div>
              <div className="rounded-xl bg-obligation-surface p-3">
                <Clock className="size-6 text-obligation" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Loans</p>
                <p className="text-2xl font-semibold tabular-nums">
                  {data?.active_count ?? 0}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <Users className="size-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Add button + dialogs */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Loan
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Loan Given</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Adding..." : "Add"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Loan</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Loans list */}
      <div className="grid gap-4 md:grid-cols-2">
        {loans.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No loans given</p>
              <p className="text-sm mt-1">Track money you&apos;ve lent to others.</p>
            </CardContent>
          </Card>
        ) : (
          loans.map((item) => {
            const statusConfig = STATUS_CONFIG[item.status];
            const repaidPercent =
              item.amount > 0
                ? Math.min(
                    ((item.amount - item.outstanding_balance) / item.amount) * 100,
                    100,
                  )
                : 0;
            const overdue = isOverdue(item);

            return (
              <Card
                key={item.id}
                className={item.status === "fully_repaid" ? "opacity-60" : ""}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 ${statusConfig.bg}`}>
                        <HandCoins className={`size-4 ${statusConfig.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.borrower_name}</CardTitle>
                        <span
                          className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${statusConfig.bg} ${statusConfig.color}`}
                        >
                          {statusConfig.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Edit loan to ${item.borrower_name}`}
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete loan to ${item.borrower_name}`}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount Lent</span>
                    <span className="font-semibold tabular-nums text-income">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Outstanding</span>
                    <span className="font-semibold tabular-nums text-obligation">
                      {formatCurrency(item.outstanding_balance)}
                    </span>
                  </div>

                  {/* Repayment progress bar */}
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        repaidPercent >= 100
                          ? "bg-emerald-500"
                          : repaidPercent >= 50
                          ? "bg-blue-500"
                          : "bg-amber-500"
                      }`}
                      style={{ width: `${repaidPercent}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {repaidPercent.toFixed(0)}% repaid
                  </p>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Loan Date
                    </span>
                    <span className="font-medium">
                      {new Date(item.loan_date).toLocaleDateString("en-GB")}
                    </span>
                  </div>

                  {item.expected_payback_date && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground flex items-center gap-1.5">
                        <Clock className="size-3.5" />
                        Expected Payback
                      </span>
                      <span
                        className={`font-medium flex items-center gap-1 ${
                          overdue ? "text-expense" : ""
                        }`}
                      >
                        {overdue && <AlertTriangle className="size-3" />}
                        {new Date(item.expected_payback_date).toLocaleDateString("en-GB")}
                        {overdue && (
                          <span className="text-xs ml-1">(overdue)</span>
                        )}
                      </span>
                    </div>
                  )}

                  {item.interest_rate != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Interest Rate</span>
                      <span className="font-medium tabular-nums">{item.interest_rate}%</span>
                    </div>
                  )}

                  {item.notes && (
                    <p className="text-xs text-muted-foreground italic pt-1">
                      {item.notes}
                    </p>
                  )}

                  {/* Expand/collapse repayment history */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground mt-2"
                    onClick={() =>
                      setExpandedId(expandedId === item.id ? null : item.id)
                    }
                  >
                    <History className="size-3 mr-1" />
                    {expandedId === item.id ? "Hide" : "Show"} Repayment History
                    {expandedId === item.id ? (
                      <ChevronUp className="size-3 ml-1" />
                    ) : (
                      <ChevronDown className="size-3 ml-1" />
                    )}
                  </Button>

                  {expandedId === item.id && (
                    <RepaymentSection loanId={item.id} onChanged={refresh} />
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
