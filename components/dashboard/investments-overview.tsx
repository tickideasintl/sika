"use client";

import Link from "next/link";
import { Landmark, TrendingUp, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiInvestment } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  stock: "Stock",
  crypto: "Crypto",
  forex: "Forex",
  property: "Property",
  business: "Business",
  savings: "Savings",
  other: "Other",
};

interface InvestmentsResponse {
  investments: ApiInvestment[];
  total_cost_basis: number;
  total_current_value: number;
  total_gain_loss: number;
  active_count: number;
}

export function InvestmentsOverview() {
  const { data, loading, error, refresh } = useApiQuery<InvestmentsResponse>("/api/investments");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Investments</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Investments</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load investments."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { investments, total_cost_basis, total_current_value, total_gain_loss } = data;
  const activeInvestments = investments.filter((i) => i.is_active);

  // Sort by current value descending
  const topInvestments = [...activeInvestments]
    .sort((a, b) => b.current_value - a.current_value)
    .slice(0, 4);

  const isGain = total_gain_loss >= 0;
  const totalReturnPct =
    total_cost_basis > 0 ? (total_gain_loss / total_cost_basis) * 100 : 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base sm:text-lg">Investments</CardTitle>
        <Link href="/dashboard/investments">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {activeInvestments.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Landmark className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No investments tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track stocks, crypto, property, and more.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 p-3">
                <p className="text-xs text-muted-foreground">Invested</p>
                <p className="font-semibold tabular-nums text-income">
                  {formatCurrency(total_cost_basis)}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 ${
                  isGain
                    ? "bg-emerald-50/50 dark:bg-emerald-950/20"
                    : "bg-rose-50/50 dark:bg-rose-950/20"
                }`}
              >
                <p className="text-xs text-muted-foreground">Current Value</p>
                <p
                  className={`font-semibold tabular-nums ${
                    isGain
                      ? "text-foreground"
                      : "text-expense"
                  }`}
                >
                  {formatCurrency(total_current_value)}
                </p>
              </div>
            </div>

            <p
              className={`text-center text-xs font-medium ${
                isGain
                  ? "text-foreground"
                  : "text-expense"
              }`}
            >
              Total Return: {isGain ? "+" : ""}
              {formatCurrency(total_gain_loss)} ({isGain ? "+" : ""}
              {totalReturnPct.toFixed(1)}%)
            </p>

            <div className="space-y-1.5">
              {topInvestments.map((item) => {
                const itemGain = item.gain_loss_pct >= 0;
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <TrendingUp
                        className={`size-3.5 ${itemGain ? "text-foreground" : "text-expense"}`}
                      />
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {INVESTMENT_TYPE_LABELS[item.investment_type] ?? item.investment_type}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-medium tabular-nums">
                        {formatCurrency(item.current_value)}
                      </p>
                      <p
                        className={`text-[10px] font-medium ${
                          itemGain
                            ? "text-foreground"
                            : "text-expense"
                        }`}
                      >
                        {itemGain ? "+" : ""}
                        {item.gain_loss_pct.toFixed(1)}%
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
