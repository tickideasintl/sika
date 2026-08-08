"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, History, Loader2, Plus } from "lucide-react";
import { apiFetch, useApiQuery } from "@/hooks/use-api";
import type { ApiBalanceLog } from "@/types";
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

interface BalanceLogSectionProps {
  debtId: string;
  onChanged: () => void;
}

export function BalanceLogSection({ debtId, onChanged }: BalanceLogSectionProps) {
  const { toast } = useToast();
  const {
    data,
    loading,
    error,
    refresh,
  } = useApiQuery<{ logs: ApiBalanceLog[] }>(
    `/api/debts-credits/${debtId}/balance-logs`,
  );

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    balance: "",
    paymentMade: "",
    notes: "",
    loggedAt: new Date().toISOString().split("T")[0],
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const balance = Number.parseFloat(formData.balance);
    if (Number.isNaN(balance) || balance < 0) {
      toast({ title: "Error", description: "Enter a valid balance", variant: "destructive" });
      return;
    }

    const paymentMade = formData.paymentMade
      ? Number.parseFloat(formData.paymentMade)
      : null;

    setSaving(true);
    try {
      await apiFetch(`/api/debts-credits/${debtId}/balance-logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          balance,
          paymentMade: paymentMade !== null && !Number.isNaN(paymentMade) ? paymentMade : null,
          notes: formData.notes || null,
          loggedAt: formData.loggedAt,
        }),
      });

      toast({ title: "Success", description: "Balance logged" });
      setIsAddOpen(false);
      setFormData({
        balance: "",
        paymentMade: "",
        notes: "",
        loggedAt: new Date().toISOString().split("T")[0],
      });
      refresh();
      onChanged();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to log balance";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const logs = data?.logs ?? [];

  return (
    <div className="space-y-3 border-t border-border/50 pt-3 mt-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium flex items-center gap-1.5">
          <History className="size-3.5" />
          Balance History
        </h4>
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="h-7 text-xs">
              <Plus className="size-3 mr-1" />
              Log Balance
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Log Current Balance</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="log-balance">Current Balance</Label>
                <Input
                  id="log-balance"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.balance}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, balance: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-payment">Payment Made (optional)</Label>
                <Input
                  id="log-payment"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={formData.paymentMade}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, paymentMade: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-date">Date</Label>
                <Input
                  id="log-date"
                  type="date"
                  value={formData.loggedAt}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, loggedAt: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="log-notes">Notes (optional)</Label>
                <Input
                  id="log-notes"
                  placeholder="e.g. Monthly statement"
                  value={formData.notes}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, notes: e.target.value }))
                  }
                />
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Saving..." : "Log Balance"}
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
      ) : logs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">
          No balance history yet
        </p>
      ) : (
        <div className="space-y-1.5 max-h-48 overflow-y-auto">
          {logs.slice(0, 6).map((log, i) => {
            const prevLog = logs[i + 1];
            const change = prevLog ? log.balance - prevLog.balance : null;
            return (
              <div
                key={log.id}
                className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 text-sm"
              >
                <div>
                  <p className="font-medium tabular-nums">
                    {formatCurrency(log.balance)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(log.logged_at).toLocaleDateString("en-GB")}
                    {(log.payment_made ?? 0) > 0 && (
                      <span className="ml-2">
                        Paid: {formatCurrency(log.payment_made!)}
                        <span className="ml-1 text-foreground">
                          → counted as expense
                        </span>
                      </span>
                    )}
                  </p>
                </div>
                {change !== null && (
                  <span
                    className={`text-xs font-medium tabular-nums flex items-center gap-0.5 ${
                      change < 0
                        ? "text-foreground"
                        : change > 0
                        ? "text-expense"
                        : "text-muted-foreground"
                    }`}
                  >
                    {change < 0 ? (
                      <ChevronDown className="size-3" />
                    ) : change > 0 ? (
                      <ChevronUp className="size-3" />
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
