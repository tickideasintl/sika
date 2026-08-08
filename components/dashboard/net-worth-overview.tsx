"use client";

import { Landmark, Scale, Wallet } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import { formatCurrency } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface NetWorthResponse {
  assets: number;
  liabilities: number;
  netWorth: number;
  investmentsValue: number;
  loansReceivable: number;
  debtsOwed: number;
  investmentCount: number;
  loanCount: number;
  debtCount: number;
}

export function NetWorthOverview() {
  const { data, loading, error } = useApiQuery<NetWorthResponse>("/api/net-worth");

  if (loading || !data) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Net Worth</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {error ?? "Loading net worth..."}
        </CardContent>
      </Card>
    );
  }

  const positive = data.netWorth >= 0;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Net Worth</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className={`rounded-xl p-4 ${positive ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-rose-50/50 dark:bg-rose-950/20"}`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-muted-foreground">Current net worth</p>
              <p className={`text-2xl font-semibold tabular-nums ${positive ? "text-foreground" : "text-expense"}`}>
                {formatCurrency(data.netWorth)}
              </p>
            </div>
            <Wallet className={`size-6 ${positive ? "text-foreground" : "text-expense"}`} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-blue-50/50 p-3 dark:bg-blue-950/20">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Landmark className="size-3.5" /> Assets
            </div>
            <p className="font-semibold tabular-nums text-income">{formatCurrency(data.assets)}</p>
          </div>
          <div className="rounded-xl bg-amber-50/50 p-3 dark:bg-amber-950/20">
            <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
              <Scale className="size-3.5" /> Liabilities
            </div>
            <p className="font-semibold tabular-nums text-obligation">{formatCurrency(data.liabilities)}</p>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Investments</span>
            <span className="font-medium tabular-nums">{formatCurrency(data.investmentsValue)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Loans receivable</span>
            <span className="font-medium tabular-nums">{formatCurrency(data.loansReceivable)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Debts owed</span>
            <span className="font-medium tabular-nums">{formatCurrency(data.debtsOwed)}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
