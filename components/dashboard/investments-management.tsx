"use client";

import { useState } from "react";
import {
  Plus,
  Edit2,
  Trash2,
  Landmark,
  TrendingUp,
  TrendingDown,
  History,
  Loader2,
  ChevronDown,
  ChevronUp,
  CalendarDays,
} from "lucide-react";
import { useApiQuery, apiFetch } from "@/hooks/use-api";
import type { ApiInvestment } from "@/types";
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
import { EventHistorySection } from "./investments/event-history-section";
import {
  InvestmentFormFields,
  INVESTMENT_TYPE_LABELS,
  type InvestmentFormData,
} from "./investments/investment-form-fields";

interface InvestmentsResponse {
  investments: ApiInvestment[];
  total_cost_basis: number;
  total_current_value: number;
  total_gain_loss: number;
  active_count: number;
}

const EMPTY_FORM: InvestmentFormData = {
  name: "",
  investmentType: "stock",
  platform: "",
  costBasis: "",
  currentValue: "",
  quantity: "",
  purchaseDate: "",
  notes: "",
};

// ── Main Component ──────────────────────────────────────────────────────

export function InvestmentsManagement() {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<InvestmentsResponse>("/api/investments");

  const investments = data?.investments;

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingItem, setEditingItem] = useState<ApiInvestment | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [formData, setFormData] = useState<InvestmentFormData>({ ...EMPTY_FORM });

  const resetForm = () => {
    setFormData({ ...EMPTY_FORM });
    setEditingItem(null);
  };

  const buildPayload = () => {
    const costBasis = Number.parseFloat(formData.costBasis);
    const currentValue = Number.parseFloat(formData.currentValue);
    if (Number.isNaN(costBasis) || costBasis < 0) return null;
    if (Number.isNaN(currentValue) || currentValue < 0) return null;

    return {
      name: formData.name,
      investmentType: formData.investmentType,
      platform: formData.platform || null,
      costBasis,
      currentValue,
      quantity: formData.quantity ? Number.parseFloat(formData.quantity) : null,
      purchaseDate: formData.purchaseDate,
      notes: formData.notes || null,
    };
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      toast({ title: "Error", description: "Enter valid cost basis and current value", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch("/api/investments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Investment added" });
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
      toast({ title: "Error", description: "Enter valid cost basis and current value", variant: "destructive" });
      return;
    }

    setSaving(true);
    try {
      await apiFetch(`/api/investments/${editingItem.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      toast({ title: "Success", description: "Investment updated" });
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

  const handleDelete = async (item: ApiInvestment) => {
    if (!confirm(`Delete "${item.name}"? This will also remove all event history.`)) return;
    try {
      await apiFetch(`/api/investments/${item.id}`, { method: "DELETE" });
      toast({ title: "Success", description: "Investment deleted" });
      refresh();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to delete";
      toast({ title: "Error", description: message, variant: "destructive" });
    }
  };

  const openEditDialog = (item: ApiInvestment) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      investmentType: item.investment_type,
      platform: item.platform ?? "",
      costBasis: item.cost_basis.toString(),
      currentValue: item.current_value.toString(),
      quantity: item.quantity?.toString() ?? "",
      purchaseDate: item.purchase_date,
      notes: item.notes ?? "",
    });
    setIsEditOpen(true);
  };

  const handleFormChange = (updates: Partial<InvestmentFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || investments === undefined) {
    return (
      <Card>
        <CardContent className="py-8 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load investments."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const totalGainLoss = data?.total_gain_loss ?? 0;
  const totalCostBasis = data?.total_cost_basis ?? 0;
  const totalCurrentValue = data?.total_current_value ?? 0;
  const totalReturnPct = totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0;
  const isPositiveReturn = totalGainLoss >= 0;

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Invested</p>
                <p className="text-2xl font-semibold text-income tabular-nums">
                  {formatCurrency(totalCostBasis)}
                </p>
              </div>
              <div className="rounded-xl bg-income-surface p-3">
                <Landmark className="size-6 text-income" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Current Value</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isPositiveReturn
                      ? "text-foreground"
                      : "text-expense"
                  }`}
                >
                  {formatCurrency(totalCurrentValue)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  isPositiveReturn
                    ? "bg-muted"
                    : "bg-expense-surface"
                }`}
              >
                {isPositiveReturn ? (
                  <TrendingUp
                    className={`size-6 ${
                      isPositiveReturn
                        ? "text-foreground"
                        : "text-expense"
                    }`}
                  />
                ) : (
                  <TrendingDown className="size-6 text-expense" />
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Return</p>
                <p
                  className={`text-2xl font-semibold tabular-nums ${
                    isPositiveReturn
                      ? "text-foreground"
                      : "text-expense"
                  }`}
                >
                  {totalGainLoss >= 0 ? "+" : ""}
                  {formatCurrency(totalGainLoss)}
                </p>
                <p
                  className={`text-xs font-medium tabular-nums ${
                    isPositiveReturn
                      ? "text-foreground"
                      : "text-expense"
                  }`}
                >
                  {totalReturnPct >= 0 ? "+" : ""}
                  {totalReturnPct.toFixed(2)}%
                </p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  isPositiveReturn
                    ? "bg-muted"
                    : "bg-expense-surface"
                }`}
              >
                {isPositiveReturn ? (
                  <TrendingUp className="size-6 text-foreground" />
                ) : (
                  <TrendingDown className="size-6 text-expense" />
                )}
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
            Add Investment
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Investment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAdd} className="space-y-4">
            <InvestmentFormFields formData={formData} onChange={handleFormChange} />
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
            <DialogTitle>Edit Investment</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <InvestmentFormFields formData={formData} onChange={handleFormChange} />
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

      {/* Investments list */}
      <div className="grid gap-4 md:grid-cols-2">
        {investments.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <p className="font-medium text-foreground">No investments</p>
              <p className="text-sm mt-1">Add stocks, crypto, or other investments to track them.</p>
            </CardContent>
          </Card>
        ) : (
          investments.map((item) => {
            const gainLoss = item.gain_loss;
            const gainLossPct = item.gain_loss_pct;
            const isPositive = gainLoss >= 0;

            return (
              <Card key={item.id} className={!item.is_active ? "opacity-60" : ""}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl p-2 bg-income-surface">
                        <Landmark className="size-4 text-income" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <p className="text-xs text-muted-foreground">
                          <span className="inline-flex items-center rounded-md bg-muted px-1.5 py-0.5 text-xs font-medium">
                            {INVESTMENT_TYPE_LABELS[item.investment_type]}
                          </span>
                          {item.platform && (
                            <span className="ml-1.5">· {item.platform}</span>
                          )}
                        </p>
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
                    <span className="text-muted-foreground">Cost Basis</span>
                    <span className="font-medium tabular-nums">
                      {formatCurrency(item.cost_basis)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Current Value</span>
                    <span className="font-semibold tabular-nums">
                      {formatCurrency(item.current_value)}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Gain / Loss</span>
                    <span
                      className={`font-semibold tabular-nums flex items-center gap-1 ${
                        isPositive
                          ? "text-foreground"
                          : "text-expense"
                      }`}
                    >
                      {isPositive ? (
                        <TrendingUp className="size-3.5" />
                      ) : (
                        <TrendingDown className="size-3.5" />
                      )}
                      {gainLoss >= 0 ? "+" : ""}
                      {formatCurrency(gainLoss)} ({gainLossPct >= 0 ? "+" : ""}
                      {gainLossPct.toFixed(2)}%)
                    </span>
                  </div>

                  {item.quantity != null && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Quantity</span>
                      <span className="font-medium tabular-nums">{item.quantity}</span>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1.5">
                      <CalendarDays className="size-3.5" />
                      Purchased
                    </span>
                    <span className="font-medium">
                      {new Date(item.purchase_date).toLocaleDateString("en-GB")}
                    </span>
                  </div>

                  {/* Expand/collapse event history */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full h-8 text-xs text-muted-foreground mt-2"
                    onClick={() =>
                      setExpandedId(expandedId === item.id ? null : item.id)
                    }
                  >
                    <History className="size-3 mr-1" />
                    {expandedId === item.id ? "Hide" : "Show"} Event History
                    {expandedId === item.id ? (
                      <ChevronUp className="size-3 ml-1" />
                    ) : (
                      <ChevronDown className="size-3 ml-1" />
                    )}
                  </Button>

                  {expandedId === item.id && (
                    <EventHistorySection investmentId={item.id} onChanged={refresh} />
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
