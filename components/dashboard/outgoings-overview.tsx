"use client";

import Link from "next/link";
import { Receipt, CalendarDays, Loader2, CheckCircle2, Clock } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getNextDueDate, isDueDatePassed } from "@/lib/outgoings-date";

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
  monthly_total: number;
  active_count: number;
  period_month: string;
}

export function OutgoingsOverview() {
  const { data, loading, error, refresh } = useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Monthly Outgoings</CardTitle>
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
          <CardTitle>Monthly Outgoings</CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load outgoings."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { outgoings, monthly_total } = data;
  const activeOutgoings = outgoings.filter((o) => o.is_active);
  const scheduledMonthlyOutgoings = activeOutgoings.filter((o) => o.frequency === "monthly");
  const unsupportedFrequencyCount = activeOutgoings.length - scheduledMonthlyOutgoings.length;

  // Payment stats
  const paidCount = scheduledMonthlyOutgoings.filter((o) => o.payment_status.paid).length;
  const overdueCount = scheduledMonthlyOutgoings.filter(
    (o) => !o.payment_status.paid && isDueDatePassed(o.day_of_month),
  ).length;

  const referenceDate = new Date();
  const startOfToday = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), referenceDate.getDate());

  // Sort by real upcoming due date and show the next few upcoming monthly outgoings
  const sorted = [...scheduledMonthlyOutgoings].sort(
    (a, b) => getNextDueDate(a.day_of_month, referenceDate).getTime() - getNextDueDate(b.day_of_month, referenceDate).getTime(),
  );
  const upcoming = sorted.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="text-base sm:text-lg">Monthly Outgoings</CardTitle>
        <Link href="/dashboard/outgoings">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {scheduledMonthlyOutgoings.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Receipt className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No outgoings tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add your regular bills to track them.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-xl bg-rose-50/50 dark:bg-rose-950/20 p-3">
              <span className="text-sm text-muted-foreground">Total per month</span>
              <span className="font-semibold tabular-nums text-expense">
                {formatCurrency(monthly_total)}
              </span>
            </div>

            {/* Payment progress */}
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1 text-foreground">
                <CheckCircle2 className="size-3" />
                {paidCount} paid
              </span>
              {overdueCount > 0 && (
                <span className="flex items-center gap-1 text-obligation">
                  <Clock className="size-3" />
                  {overdueCount} overdue
                </span>
              )}
              <span className="text-muted-foreground">
                {scheduledMonthlyOutgoings.length - paidCount - overdueCount} upcoming
              </span>
            </div>

            {unsupportedFrequencyCount > 0 && (
              <p className="text-xs text-muted-foreground">
                {unsupportedFrequencyCount} non-monthly outgoing{unsupportedFrequencyCount === 1 ? "" : "s"} not included in upcoming schedule.
              </p>
            )}

            <div className="space-y-1.5">
              {upcoming.map((item) => {
                const dueDate = getNextDueDate(item.day_of_month, referenceDate);
                const isToday = dueDate.getTime() === startOfToday.getTime();
                const isNextMonth = dueDate.getMonth() !== referenceDate.getMonth();
                const isPaid = item.payment_status.paid;
                const isOverdue = !isPaid && isDueDatePassed(item.day_of_month);

                return (
                  <div
                    key={item.id}
                    className={`flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm ${
                      isPaid
                        ? "border-emerald-200/50 dark:border-emerald-800/30 bg-emerald-50/30 dark:bg-emerald-950/10"
                        : isOverdue
                        ? "border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10"
                        : "border-border/50"
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {isPaid ? (
                        <CheckCircle2 className="size-3.5 text-muted-foreground" />
                      ) : isOverdue ? (
                        <Clock className="size-3.5 text-obligation" />
                      ) : (
                        <CalendarDays className={`size-3.5 ${isToday ? "text-obligation" : "text-muted-foreground"}`} />
                      )}
                      <span className={`font-medium ${isPaid ? "line-through text-muted-foreground" : ""}`}>
                        {item.name}
                      </span>
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
                      {!isPaid && !isOverdue && isToday && (
                        <span className="text-[10px] bg-amber-100 dark:bg-amber-950/40 text-obligation px-1.5 py-0.5 rounded-full font-medium">
                          Today
                        </span>
                      )}
                      {!isPaid && !isOverdue && !isToday && isNextMonth && (
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-full">
                          Next month
                        </span>
                      )}
                    </div>
                    <div className="text-right">
                      <p className={`font-medium tabular-nums ${isPaid ? "text-foreground" : "text-expense"}`}>
                        {formatCurrency(item.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {item.day_of_month}{getOrdinalSuffix(item.day_of_month)}
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
