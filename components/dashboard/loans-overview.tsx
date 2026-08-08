"use client";

import Link from "next/link";
import { HandCoins, Clock, Loader2 } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiLoanGiven } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

const STATUS_LABELS: Record<string, string> = {
  active: "Active",
  partially_repaid: "Partial",
  fully_repaid: "Repaid",
  defaulted: "Defaulted",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-income-surface text-income",
  partially_repaid: "bg-obligation-surface text-obligation",
  fully_repaid: "bg-muted text-foreground",
  defaulted: "bg-expense-surface text-expense",
};

interface LoansResponse {
  loans: ApiLoanGiven[];
  total_lent: number;
  total_outstanding: number;
  active_count: number;
}

export function LoansOverview() {
  const { data, loading, error, refresh } = useApiQuery<LoansResponse>("/api/loans-given");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Loans Given</CardTitle>
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
          <CardTitle>Loans Given</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load loans."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { loans, total_lent, total_outstanding } = data;
  const activeLoans = loans.filter((l) => l.status === "active" || l.status === "partially_repaid");

  // Sort by outstanding balance descending
  const topLoans = [...activeLoans]
    .sort((a, b) => b.outstanding_balance - a.outstanding_balance)
    .slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base sm:text-lg">Loans Given</CardTitle>
        <Link href="/dashboard/loans">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {activeLoans.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <HandCoins className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No loans tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Track money you&apos;ve lent to others.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-blue-50/50 dark:bg-blue-950/20 p-3">
                <p className="text-xs text-muted-foreground">Total Lent</p>
                <p className="font-semibold tabular-nums text-income">
                  {formatCurrency(total_lent)}
                </p>
              </div>
              <div className="rounded-xl bg-amber-50/50 dark:bg-amber-950/20 p-3">
                <p className="text-xs text-muted-foreground">Outstanding</p>
                <p className="font-semibold tabular-nums text-obligation">
                  {formatCurrency(total_outstanding)}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              {topLoans.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2.5 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Clock className="size-3.5 text-obligation" />
                    <div>
                      <p className="font-medium">{item.borrower_name}</p>
                      <span
                        className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${STATUS_COLORS[item.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {STATUS_LABELS[item.status] ?? item.status}
                      </span>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium tabular-nums text-obligation">
                      {formatCurrency(item.outstanding_balance)}
                    </p>
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
