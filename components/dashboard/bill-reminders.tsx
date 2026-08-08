"use client";

import Link from "next/link";
import { Bell, Calendar, CheckCircle2, Clock, Loader2, AlertCircle } from "lucide-react";
import { useApiQuery } from "@/hooks/use-api";
import type { ApiRecurringOutgoing } from "@/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { getNextDueDate, getDaysUntilDue, getDueUrgency, formatDaysUntilDue, type DueUrgency } from "@/lib/outgoings-date";
import { cn } from "@/lib/utils";

interface OutgoingsResponse {
  outgoings: ApiRecurringOutgoing[];
  monthly_total: number;
  active_count: number;
  period_month: string;
}

interface BillWithUrgency {
  outgoing: ApiRecurringOutgoing;
  dueDate: Date;
  daysUntilDue: number;
  urgency: DueUrgency;
}

const URGENCY_CONFIG: Record<DueUrgency, { label: string; color: string; bgColor: string; icon: typeof Clock }> = {
  overdue: { label: "Overdue", color: "text-expense", bgColor: "bg-expense-surface", icon: AlertCircle },
  today: { label: "Due today", color: "text-obligation", bgColor: "bg-obligation-surface", icon: Clock },
  soon: { label: "Due soon", color: "text-obligation", bgColor: "bg-obligation-surface", icon: Clock },
  upcoming: { label: "Upcoming", color: "text-blue-700 dark:text-blue-400", bgColor: "bg-blue-50 dark:bg-blue-950/30", icon: Calendar },
  future: { label: "Later", color: "text-muted-foreground", bgColor: "bg-muted", icon: Calendar },
};

function getOrdinalSuffix(day: number) {
  if (day >= 11 && day <= 13) return "th";
  switch (day % 10) {
    case 1: return "st";
    case 2: return "nd";
    case 3: return "rd";
    default: return "th";
  }
}

function formatDueDate(date: Date) {
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function BillReminders() {
  const { data, loading, error, refresh } = useApiQuery<OutgoingsResponse>("/api/recurring-outgoings");

  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Upcoming Bills
          </CardTitle>
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
          <CardTitle className="flex items-center gap-2">
            <Bell className="size-5" />
            Upcoming Bills
          </CardTitle>
        </CardHeader>
        <CardContent className="py-6 text-center">
          <p className="text-sm text-muted-foreground">{error ?? "Failed to load bills."}</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={refresh}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  const { outgoings, monthly_total } = data;
  const activeOutgoings = outgoings.filter((o) => o.is_active);
  const unpaidOutgoings = activeOutgoings.filter((o) => !o.payment_status.paid);

  // Calculate urgency for each unpaid bill
  const now = new Date();
  const billsWithUrgency: BillWithUrgency[] = unpaidOutgoings
    .map((outgoing) => {
      const dueDate = getNextDueDate(outgoing.day_of_month, now);
      const daysUntilDue = getDaysUntilDue(dueDate, now);
      const urgency = getDueUrgency(daysUntilDue);
      return { outgoing, dueDate, daysUntilDue, urgency };
    })
    .sort((a, b) => a.daysUntilDue - b.daysUntilDue);

  // Group by urgency
  const overdueBills = billsWithUrgency.filter((b) => b.urgency === "overdue");
  const dueTodayBills = billsWithUrgency.filter((b) => b.urgency === "today");
  const dueSoonBills = billsWithUrgency.filter((b) => b.urgency === "soon");
  const upcomingBills = billsWithUrgency.filter((b) => b.urgency === "upcoming" || b.urgency === "future").slice(0, 3);

  const displayBills = [...overdueBills, ...dueTodayBills, ...dueSoonBills, ...upcomingBills].slice(0, 6);

  const totalUnpaid = billsWithUrgency.reduce((sum, b) => sum + b.outgoing.amount, 0);
  const urgentCount = overdueBills.length + dueTodayBills.length + dueSoonBills.length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
          <Bell className="size-5" />
          Upcoming Bills
          {urgentCount > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-semibold text-white">
              {urgentCount}
            </span>
          )}
        </CardTitle>
        <Link href="/dashboard/outgoings">
          <Button variant="ghost" size="sm" className="text-muted-foreground">
            View All
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {activeOutgoings.length === 0 ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <Bell className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium">No bills tracked</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Add recurring bills to get reminders.
            </p>
          </div>
        ) : displayBills.length === 0 ? (
          <div className="py-6 text-center">
            <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-muted">
              <CheckCircle2 className="size-5 text-muted-foreground" />
            </div>
            <p className="font-medium text-foreground">All caught up!</p>
            <p className="mt-1 text-sm text-muted-foreground">
              No upcoming bills due.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-rose-50/50 dark:bg-rose-950/20 p-3">
                <p className="text-xs text-muted-foreground">Unpaid this month</p>
                <p className="mt-1 text-lg font-semibold tabular-nums text-expense">
                  {formatCurrency(totalUnpaid)}
                </p>
              </div>
              <div className="rounded-xl bg-muted p-3">
                <p className="text-xs text-muted-foreground">Monthly total</p>
                <p className="mt-1 text-lg font-semibold tabular-nums">
                  {formatCurrency(monthly_total)}
                </p>
              </div>
            </div>

            {/* Bills list */}
            <div className="space-y-2">
              {displayBills.map((bill) => {
                const { outgoing, dueDate, daysUntilDue, urgency } = bill;
                const config = URGENCY_CONFIG[urgency];
                const Icon = config.icon;

                return (
                  <div
                    key={outgoing.id}
                    className={cn(
                      "flex items-center justify-between rounded-lg border px-3 py-2.5 text-sm transition-colors",
                      urgency === "overdue" && "border-rose-200/50 dark:border-rose-800/30 bg-rose-50/30 dark:bg-rose-950/10",
                      urgency === "today" && "border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10",
                      urgency === "soon" && "border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10",
                      urgency === "upcoming" && "border-blue-200/50 dark:border-blue-800/30 bg-blue-50/30 dark:bg-blue-950/10",
                      urgency === "future" && "border-border/50"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-lg", config.bgColor)}>
                        <Icon className={cn("size-4", config.color)} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{outgoing.name}</p>
                        <p className={cn("text-xs", config.color)}>
                          {formatDaysUntilDue(daysUntilDue)} • {formatDueDate(dueDate)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={cn("font-semibold tabular-nums", config.color)}>
                        {formatCurrency(outgoing.amount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {outgoing.day_of_month}{getOrdinalSuffix(outgoing.day_of_month)} monthly
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Quick actions */}
            {urgentCount > 0 && (
              <div className="rounded-xl border border-amber-200/50 dark:border-amber-800/30 bg-amber-50/30 dark:bg-amber-950/10 p-3">
                <p className="text-sm font-medium text-obligation">
                  {urgentCount} bill{urgentCount === 1 ? "" : "s"} need{urgentCount === 1 ? "s" : ""} attention
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Review and mark payments in the Outgoings page.
                </p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
