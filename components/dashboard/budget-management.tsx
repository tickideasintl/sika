"use client";

import { useMemo, useState } from "react";
import { Plus, Edit2, Trash2, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiBudget, TransactionType } from "@/types";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type BudgetType = "expense" | "giving" | "income";
type BudgetPeriod = "monthly" | "quarterly" | "yearly";

interface ApiCategory {
  id: string;
  name: string;
  type: TransactionType;
  color: string;
  icon: string | null;
  is_default: boolean;
  created_at: string | null;
}

const getBudgetStatus = (percentage: number) => {
  if (percentage >= 100) return "exceeded" as const;
  if (percentage >= 80) return "warning" as const;
  return "ok" as const;
};

export function BudgetManagement() {
  const { toast } = useToast();
  const {
    data: budgetData,
    loading: budgetsLoading,
    refresh: refreshBudgets,
  } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets");
  const { data: catData, loading: categoriesLoading } = useApiQuery<{ categories: ApiCategory[] }>("/api/categories");

  const budgets = budgetData?.budgets;
  const categories = catData?.categories;

  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBudget, setEditingBudget] = useState<ApiBudget | null>(null);

  const [formData, setFormData] = useState({
    category: "",
    amount: "",
    period: "monthly" as BudgetPeriod,
    type: "expense" as BudgetType,
  });

  const filteredCategories = useMemo(
    () => (categories ?? []).filter((c) => c.type === formData.type),
    [categories, formData.type]
  );

  const calculateDateRange = (period: BudgetPeriod) => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    let end: Date;

    switch (period) {
      case "monthly":
        end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
      case "quarterly": {
        const quarter = Math.floor(now.getMonth() / 3);
        end = new Date(now.getFullYear(), (quarter + 1) * 3, 0);
        break;
      }
      case "yearly":
        end = new Date(now.getFullYear(), 11, 31);
        break;
    }

    return {
      startDate: start.toISOString().split("T")[0],
      endDate: end.toISOString().split("T")[0],
    };
  };

  const resetForm = () => {
    setFormData({ category: "", amount: "", period: "monthly", type: "expense" });
    setEditingBudget(null);
  };

  const handleAddBudget = async (e: React.FormEvent) => {
    e.preventDefault();

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      const { startDate, endDate } = calculateDateRange(formData.period);
      await apiFetch("/api/budgets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: formData.category,
          amount,
          period: formData.period,
          startDate,
          endDate,
          type: formData.type,
        }),
      });

      toast({ title: "Success", description: "Budget created" });
      setIsAddDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleEditBudget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBudget) return;

    const amount = Number.parseFloat(formData.amount);
    if (Number.isNaN(amount) || amount <= 0) {
      toast({ title: "Error", description: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/budgets/${editingBudget.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });
      toast({ title: "Success", description: "Budget updated" });
      setIsEditDialogOpen(false);
      resetForm();
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to update budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteBudget = async (budget: ApiBudget) => {
    if (!confirm(`Delete budget for "${budget.category}"?`)) return;

    try {
      await apiFetch(`/api/budgets/${budget.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Budget deleted" });
      refreshBudgets();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete budget";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (budget: ApiBudget) => {
    setEditingBudget(budget);
    setFormData({
      category: budget.category,
      amount: budget.amount.toString(),
      period: budget.period,
      type: budget.type,
    });
    setIsEditDialogOpen(true);
  };

  if (budgetsLoading || categoriesLoading || budgets === undefined || categories === undefined) {
    return <p className="text-sm text-muted-foreground">Loading budgets...</p>;
  }

  return (
    <div className="space-y-6">
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full sm:w-auto">
            <Plus className="h-4 w-4 mr-2" />
            Add Budget
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Budget</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddBudget} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="budget-type">Type</Label>
              <Select
                value={formData.type}
                onValueChange={(value: BudgetType) =>
                  setFormData((prev) => ({
                    ...prev,
                    type: value,
                    category: "",
                  }))
                }
              >
                <SelectTrigger id="budget-type" aria-label="Budget type">
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
              <Label htmlFor="budget-category">Category</Label>
              <Select
                value={formData.category}
                onValueChange={(value) => setFormData((prev) => ({ ...prev, category: value }))}
              >
                <SelectTrigger id="budget-category" aria-label="Budget category">
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

            <div className="space-y-2">
              <Label htmlFor="budget-amount">Amount</Label>
              <Input
                id="budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="budget-period">Period</Label>
              <Select
                value={formData.period}
                onValueChange={(value: BudgetPeriod) => setFormData((prev) => ({ ...prev, period: value }))}
              >
                <SelectTrigger id="budget-period" aria-label="Budget period">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">Monthly</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                  <SelectItem value="yearly">Yearly</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Creating..." : "Create Budget"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Budget</DialogTitle>
          </DialogHeader>

          <form onSubmit={handleEditBudget} className="space-y-4">
            <div className="space-y-2">
              <Label>Category</Label>
              <Input value={formData.category} disabled />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-budget-amount">Amount</Label>
              <Input
                id="edit-budget-amount"
                type="number"
                min="0.01"
                step="0.01"
                value={formData.amount}
                onChange={(e) => setFormData((prev) => ({ ...prev, amount: e.target.value }))}
                required
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={saving}>
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsEditDialogOpen(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {budgets.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No budgets yet</p>
              <p className="text-sm mt-1">Create one to track your progress.</p>
            </CardContent>
          </Card>
        ) : (
          budgets.map((budget) => {
            const status = getBudgetStatus(budget.percentage);
            return (
              <Card key={budget.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-xl p-2 ${budget.type === "expense" ? "bg-expense-surface" : budget.type === "income" ? "bg-income-surface" : "bg-giving-surface"}`}>
                        {budget.type === "expense" ? (
                          <TrendingDown className="size-4 text-expense" />
                        ) : (
                          <TrendingUp className={`size-4 ${budget.type === "income" ? "text-income" : "text-giving"}`} />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-base">{budget.category}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">
                          {budget.period} {budget.type}
                        </p>
                      </div>
                    </div>

                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" aria-label={`Edit ${budget.category} budget`} onClick={() => openEditDialog(budget)}>
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        aria-label={`Delete ${budget.category} budget`}
                        onClick={() => handleDeleteBudget(budget)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Spent</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(budget.spent)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Budget</span>
                    <span className="font-semibold tabular-nums">{formatCurrency(budget.amount)}</span>
                  </div>

                  <div
                    role="progressbar"
                    aria-valuenow={Math.min(Math.round(budget.percentage), 100)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-label={`${budget.category} budget used`}
                    className="h-2.5 w-full overflow-hidden rounded-full bg-muted"
                  >
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        status === "exceeded"
                          ? "bg-rose-500"
                          : status === "warning"
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">
                      {budget.remaining >= 0
                        ? `${formatCurrency(budget.remaining)} remaining`
                        : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
                    </span>
                    {(status === "warning" || status === "exceeded") && (
                      <span className={`inline-flex items-center gap-1 ${status === "exceeded" ? "text-expense" : "text-obligation"}`}>
                        <AlertTriangle className="h-3 w-3" />
                        {status === "exceeded" ? "Over" : "Near limit"}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
