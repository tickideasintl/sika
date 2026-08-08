"use client";

import Link from "next/link";
import { useMemo } from "react";
import { AlertTriangle, Plus, TrendingDown, TrendingUp } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiBudget } from "@/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/utils";

function BudgetSkeleton() {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-28" />
      </div>
      <Skeleton className="h-2.5 w-full rounded-full" />
      <Skeleton className="h-3 w-24" />
    </div>
  );
}

export function BudgetOverview() {
  const { data, loading } = useApiQuery<{ budgets: ApiBudget[] }>("/api/budgets?period=monthly");
  const budgets = data?.budgets;

  const topBudgets = useMemo(() => {
    if (!budgets) return [];

    return budgets
      .map((budget) => ({
        id: budget.id,
        category: budget.category,
        amount: budget.amount,
        spent: budget.spent,
        remaining: budget.remaining,
        type: budget.type,
        percentage: budget.percentage,
        status: budget.status,
      }))
      .sort((a, b) => b.percentage - a.percentage)
      .slice(0, 3);
  }, [budgets]);

  if (loading || budgets === undefined) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <BudgetSkeleton />
          <BudgetSkeleton />
          <BudgetSkeleton />
        </CardContent>
      </Card>
    );
  }

  if (topBudgets.length === 0) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Budget Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-10">
          <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
            <TrendingDown className="size-5 text-muted-foreground" />
          </div>
          <p className="font-medium">No budgets set</p>
          <p className="mt-1 text-sm text-muted-foreground">Create your first budget to track progress.</p>
          <Link href="/dashboard/settings" className="mt-4 inline-flex">
            <Button size="sm">
              <Plus className="size-4 mr-2" />
              Create Budget
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle>Budget Overview</CardTitle>
        <Link href="/dashboard/settings">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent className="space-y-5">
        {topBudgets.map((budget) => (
          <div key={budget.id} className="space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-medium">
                {budget.type === "expense" ? (
                  <div className="rounded-lg p-1.5 bg-expense-surface">
                    <TrendingDown className="size-3.5 text-expense" />
                  </div>
                ) : (
                  <div className={`rounded-lg p-1.5 ${budget.type === "income" ? "bg-income-surface" : "bg-giving-surface"}`}>
                    <TrendingUp
                      className={`size-3.5 ${budget.type === "income" ? "text-income" : "text-giving"}`}
                    />
                  </div>
                )}
                {budget.category}
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                {(budget.status === "warning" || budget.status === "exceeded") && (
                  <AlertTriangle
                    className={`size-3.5 ${budget.status === "exceeded" ? "text-expense" : "text-obligation"}`}
                  />
                )}
                <span className="tabular-nums">
                  {formatCurrency(budget.spent)} / {formatCurrency(budget.amount)}
                </span>
              </div>
            </div>

            <div
              role="progressbar"
              aria-valuenow={Math.min(Math.round(budget.percentage), 100)}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${budget.category} budget used`}
              className="h-2.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  budget.status === "exceeded"
                    ? "bg-rose-500"
                    : budget.status === "warning"
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                }`}
                style={{ width: `${Math.min(budget.percentage, 100)}%` }}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {/* The bar's colour also encodes status, so name the status in text. */}
              <span className="font-medium text-foreground">
                {budget.status === "exceeded"
                  ? "Over budget"
                  : budget.status === "warning"
                  ? "Near limit"
                  : "On track"}
              </span>
              {" · "}
              {budget.remaining >= 0
                ? `${formatCurrency(budget.remaining)} remaining`
                : `${formatCurrency(Math.abs(budget.remaining))} over budget`}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
