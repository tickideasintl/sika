"use client";

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  CalendarDays,
  Receipt,
  Loader2,
  CheckCircle2,
  Circle,
  Clock,
  Undo2,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { getCurrentUtcDate, isDueDatePassed } from "@/lib/outgoings-date";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const OUTGOING_CATEGORIES = [
  "Housing",
  "Utilities",
  "Insurance",
  "Phone & Internet",
  "Subscriptions",
  "Transport",
  "Childcare",
  "Memberships",
  "Other",
];

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function getCurrentMonthLabel() {
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
  monthly_total: number;
  active_count: number;
  period_month: string;
}

export function RecurringOutgoingsManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");

  const outgoings = data?.outgoings;
  const monthlyTotal = data?.monthly_total ?? 0;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loggingPayment, setLoggingPayment] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<ApiRecurringOutgoing | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    amount: "",
    dayOfMonth: "",
    category: "",
    notes: "",
  });

  const resetForm = () => {
    setFormData({
      name: "",
      amount: "",
      dayOfMonth: "",
      category: "",
      notes: "",
    });
    setEditingItem(null);
  };

  const handleLogPayment = async (item: ApiRecurringOutgoing) => {
    setLoggingPayment(item.id);
    try {
      await apiFetch(`/api/recurring-outgoings/${item.id}/payment-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: item.amount,
          paidAt: getCurrentUtcDate(),
        }),
      });
      toast({
        title: "Payment logged",
        description: `${item.name} marked as paid for ${getCurrentMonthLabel()}. This will count as an expense.`,
      });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log payment";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setLoggingPayment(null);
    }
  };

  const handleUndoPayment = async (item: ApiRecurringOutgoing) => {
    if (!item.payment_status.paid || !item.payment_status.payment_id) return;
    try {
      await apiFetch(
        `/api/recurring-outgoings/${item.id}/payment-logs/${item.payment_status.payment_id}`,
        { method: "DELETE" },
      );
      toast({
        title: "Payment undone",
        description: `${item.name} marked as unpaid for ${getCurrentMonthLabel()}.`,
      });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to undo payment";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number.parseFloat(formData.amount);
    const dayOfMonth = Number.parseInt(formData.dayOfMonth, 10);

    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      toast({ title: "Error", description: "Day must be between 1 and 31", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/recurring-outgoings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          amount,
          dayOfMonth,
          frequency: "monthly",
          category: formData.category || null,
          notes: formData.notes || null,
        }),
      });
      toast({ title: "Success", description: "Outgoing added" });
      setIsAddOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to add outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    const amount = Number.parseFloat(formData.amount);
    const dayOfMonth = Number.parseInt(formData.dayOfMonth, 10);

    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }
    if (Number.isNaN(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
      toast({ title: "Error", description: "Day must be between 1 and 31", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/recurring-outgoings/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: formData.name,
          amount,
          dayOfMonth,
          frequency: "monthly",
          category: formData.category || null,
          notes: formData.notes || null,
        }),
      });
      toast({ title: "Success", description: "Outgoing updated" });
      setIsEditOpen(false);
      resetForm();
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: ApiRecurringOutgoing) => {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      await apiFetch(`/api/recurring-outgoings/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Outgoing deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete outgoing";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: ApiRecurringOutgoing) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      amount: item.amount.toString(),
      dayOfMonth: item.day_of_month.toString(),
      category: item.category ?? "",
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || outgoings === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load outgoings."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Compute payment summary for the month
  const activeOutgoings = outgoings.filter((o) => o.is_active);
  const paidCount = activeOutgoings.filter((o) => o.payment_status.paid).length;
  const paidTotal = activeOutgoings
    .filter((o) => o.payment_status.paid)
    .reduce((sum, o) => sum + (o.payment_status.amount_paid ?? o.amount), 0);
  const overdueCount = activeOutgoings.filter(
    (o) => !o.payment_status.paid && isDueDatePassed(o.day_of_month),
  ).length;

  const formFields = (
    <>
      <div className="space-y-2">
        <Label htmlFor="outgoing-name">Name</Label>
        <Input
          id="outgoing-name"
          placeholder="e.g. Rent, Phone bill"
          value={formData.name}
          onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
          required
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="outgoing-amount">Amount</Label>
          <Input
            id="outgoing-amount"
            type="number"
            min="0.01"
            step="0.01"
            placeholder="0.00"
            value={formData.amount}
            onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="outgoing-day">Day of Month</Label>
          <Input
            id="outgoing-day"
            type="number"
            min="1"
            max="31"
            placeholder="1-31"
            value={formData.dayOfMonth}
            onChange={(e) => setFormData((prev) => ({ ...prev, dayOfMonth: e.target.value }))}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outgoing-category">Category</Label>
        <Select
          value={formData.category}
          onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
        >
          <SelectTrigger id="outgoing-category" aria-label="Category">
            <SelectValue placeholder="Select..." />
          </SelectTrigger>
          <SelectContent>
            {OUTGOING_CATEGORIES.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="outgoing-notes">Notes (optional)</Label>
        <Input
          id="outgoing-notes"
          placeholder="Any extra details..."
          value={formData.notes}
          onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
        />
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Monthly Outgoings</p>
                <p className="text-2xl font-semibold text-expense tabular-nums">
                  {formatCurrency(monthlyTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {data?.active_count ?? 0} active {(data?.active_count ?? 0) === 1 ? "outgoing" : "outgoings"}
                </p>
              </div>
              <div className="rounded-xl bg-expense-surface p-3">
                <Receipt className="size-6 text-expense" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Paid This Month</p>
                <p className="text-2xl font-semibold text-foreground tabular-nums">
                  {formatCurrency(paidTotal)}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {paidCount} of {activeOutgoings.length} paid
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <CheckCircle2 className="size-6 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Overdue</p>
                <p className={`text-2xl font-semibold tabular-nums ${overdueCount > 0 ? "text-obligation" : "text-muted-foreground"}`}>
                  {overdueCount}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {overdueCount === 0 ? "All caught up" : "past due date, not logged"}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${overdueCount > 0 ? "bg-obligation-surface" : "bg-muted"}`}>
                <Clock className={`size-6 ${overdueCount > 0 ? "text-obligation" : "text-muted-foreground"}`} />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="size-4" />
        <span>Showing payment status for <strong className="text-foreground">{getCurrentMonthLabel()}</strong></span>
      </div>

      {/* Add button + dialogs */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Outgoing
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Regular Outgoing</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            {formFields}
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Adding..." : "Add Outgoing"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Outgoing</DialogTitle>
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

      {/* Outgoings list */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {outgoings.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No outgoings yet</p>
              <p className="text-sm mt-1">Add your regular bills and payments to track them.</p>
            </CardContent>
          </Card>
        ) : (
          outgoings.map((item) => {
            const isPaid = item.payment_status.paid;
            const isOverdue = !isPaid && item.is_active && isDueDatePassed(item.day_of_month);
            const isLogging = loggingPayment === item.id;

            return (
              <Card
                key={item.id}
                className={`${!item.is_active ? "opacity-60" : ""} ${
                  isPaid
                    ? "border-emerald-200 dark:border-emerald-800/50"
                    : isOverdue
                    ? "border-amber-200 dark:border-amber-800/50"
                    : ""
                }`}
              >
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`rounded-xl p-2 ${
                          isPaid
                            ? "bg-muted"
                            : isOverdue
                            ? "bg-obligation-surface"
                            : "bg-expense-surface"
                        }`}
                      >
                        {isPaid ? (
                          <CheckCircle2 className="size-4 text-muted-foreground" />
                        ) : isOverdue ? (
                          <Clock className="size-4 text-obligation" />
                        ) : (
                          <Receipt className="size-4 text-expense" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <div className="flex items-center gap-1.5">
                          {item.category && (
                            <p className="text-xs text-muted-foreground">{item.category}</p>
                          )}
                          {isPaid && (
                            <span className="text-[10px] bg-muted text-foreground px-1.5 py-0.5 rounded-full font-medium">
                              Paid
                            </span>
                          )}
                          {isOverdue && (
                            <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-obligation px-1.5 py-0.5 rounded-full font-medium">
                              Overdue
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        aria-label={`Edit ${item.name}`}
                        onClick={() => openEditDialog(item)}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${item.name}`}
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className="font-semibold tabular-nums text-expense">
                      {formatCurrency(item.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Due date
                    </span>
                    <span className="font-medium">
                      {item.day_of_month}{getOrdinalSuffix(item.day_of_month)} of each month
                    </span>
                  </div>
                  {item.frequency !== "monthly" && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Frequency</span>
                      <span className="capitalize font-medium">{item.frequency}</span>
                    </div>
                  )}
                  {item.notes && (
                    <p className="text-xs text-muted-foreground pt-1 border-t border-border/50">
                      {item.notes}
                    </p>
                  )}

                  {/* Payment action */}
                  {item.is_active && (
                    <div className="pt-2 border-t border-border/50">
                      {isPaid ? (
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <CheckCircle2 className="size-3" />
                            Paid on {new Date(item.payment_status.paid_at!).toLocaleDateString("en-GB")}
                          </p>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 text-xs text-muted-foreground"
                            onClick={() => handleUndoPayment(item)}
                          >
                            <Undo2 className="size-3 mr-1" />
                            Undo
                          </Button>
                        </div>
                      ) : (
                        <Button
                          size="sm"
                          variant={isOverdue ? "default" : "outline"}
                          className={`w-full h-8 text-xs ${
                            isOverdue
                              ? "bg-obligation hover:bg-obligation/90 text-obligation-foreground"
                              : ""
                          }`}
                          disabled={isLogging}
                          onClick={() => handleLogPayment(item)}
                        >
                          {isLogging ? (
                            <Loader2 className="size-3 mr-1 animate-spin" />
                          ) : (
                            <Circle className="size-3 mr-1" />
                          )}
                          {isOverdue ? "Log as Paid (Overdue)" : "Log as Paid"}
                        </Button>
                      )}
                    </div>
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
