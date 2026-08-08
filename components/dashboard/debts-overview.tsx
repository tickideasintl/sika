"use client";

import Link from "next/link";
import { CreditCard, TrendingDown, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiDebtCredit } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const DEBT_TYPE_LABELS: Record<string, string> = {
  credit_card: "Credit Card",
  loan: "Loan",
  mortgage: "Mortgage",
  overdraft: "Overdraft",
  other: "Other",
};

interface DebtsResponse {
  debts: ApiDebtCredit[];
  total_balance: number;
  total_min_payment: number;
  active_count: number;
}

export function DebtsOverview() {
  const { data, loading, error, refresh } = useApiQuery<DebtsResponse>("/api/debts-credits");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Debts & Credit</CardTitle>
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
          <CardTitle>Debts & Credit</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load debts."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { debts, total_balance, total_min_payment } = data;
  const activeDebts = debts.filter((d) => d.is_active);

  // Sort by balance descending
  const topDebts = [...activeDebts]
    .sort((a, b) => b.current_balance - a.current_balance)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base sm:text-lg">Debts & Credit</CardTitle>
        <Link href="/dashboard/debts">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {activeDebts.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <CreditCard className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No debts tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add credit cards or loans to monitor them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-rose-50/50 dark:bg-rose-950/20 p-3">
                <p className="text-xs text-muted-foreground">Total Owed</p>
                <p className="font-semibold tabular-nums text-expense">
                  {formatCurrency(total_balance)}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-muted-foreground">Monthly Min.</p>
                <p className="font-semibold tabular-nums text-obligation">
                  {formatCurrency(total_min_payment)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {topDebts.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    {item.debt_type === "credit_card" ? (
                      <CreditCard className="size-3.5 text-purple-500" />
                    ) : (
                      <TrendingDown className="size-3.5 text-expense" />
                    )}
                    <div>
                      <p className="font-medium">{item.name}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {DEBT_TYPE_LABELS[item.debt_type] ?? item.debt_type}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums text-expense">
                      {formatCurrency(item.current_balance)}
                    </p>
                    {item.minimum_payment != null && (
                      <p className="text-[10px] text-muted-foreground">
                        min {formatCurrency(item.minimum_payment)}/mo
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
