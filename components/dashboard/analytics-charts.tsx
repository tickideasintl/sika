"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";
import { Download, Calendar, TrendingDown, TrendingUp, Wallet, PiggyBank, Sparkles, Target, Receipt, AlertCircle, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Period = "weekly" | "monthly" | "quarterly" | "yearly" | "custom";

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AnalyticsComparisons {
  expensesChange: number | null;
  givingsChange: number | null;
  incomeChange: number | null;
  netBalanceChange: number | null;
  transactionCountChange: number | null;
}

interface SafeToSpendBreakdown {
  available: number;
  committedExpenses: number;
  activeGoalsAllocation: number;
  remaining: number;
}

interface SpendingPrediction {
  projectedMonthlyExpenses: number;
  projectedMonthlyIncome: number;
  daysOfRunway: number | null;
  trendDirection: "improving" | "stable" | "declining";
  insight: string;
}

interface AnalyticsData {
  totalExpenses: number;
  totalGivings: number;
  totalIncome: number;
  netBalance: number;
  safeToSpend: number;
  safeToSpendBreakdown: SafeToSpendBreakdown;
  spendingPrediction: SpendingPrediction;
  transactionCount: number;
  expensesByCategoryArray: { name: string; value: number }[];
  givingsByCategoryArray: { name: string; value: number }[];
  incomeByCategoryArray: { name: string; value: number }[];
  dailyTrends: { date: string; expenses: number; givings: number; income: number }[];
  monthlyTrends: { month: string; expenses: number; givings: number; income: number }[];
  period: DateRange;
  previousPeriod: DateRange;
  comparisons: AnalyticsComparisons;
}

// Money types resolve through the semantic tokens so the series match the figures
// they explain, and follow the palette into dark mode. The trailing two extend the
// set when a breakdown needs more slices than there are money types.
const CHART_COLORS = [
  "var(--color-income)",
  "var(--color-giving)",
  "var(--color-expense)",
  "var(--color-obligation)",
  "#8b5cf6",
  "#06b6d4",
];

const PERIOD_OPTIONS: { value: Period; label: string }[] = [
  { value: "weekly", label: "Last 7 days" },
  { value: "monthly", label: "Last 30 days" },
  { value: "quarterly", label: "Last 3 months" },
  { value: "yearly", label: "Last 12 months" },
  { value: "custom", label: "Custom range" },
];

function formatChangeLabel(value: number | null) {
  if (value === null) return "No prior data";
  if (Math.abs(value) < 0.05) return "No change";
  const direction = value > 0 ? "up" : "down";
  return `${Math.abs(value).toFixed(1)}% ${direction}`;
}

function getComparisonTone(value: number | null, positiveIsGood = true) {
  if (value === null || Math.abs(value) < 0.05) return "text-muted-foreground";
  const improved = positiveIsGood ? value > 0 : value < 0;
  return improved ? "text-foreground" : "text-expense";
}

function ComparisonHint({
  value,
  positiveIsGood,
}: {
  value: number | null;
  positiveIsGood?: boolean;
}) {
  const tone = getComparisonTone(value, positiveIsGood);

  return <p className={`mt-1 text-xs ${tone}`}>{formatChangeLabel(value)}</p>;
}

function LoadingState() {
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-9 w-28" />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-36" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[280px] w-full" />
        </CardContent>
      </Card>
    </div>
  );
}

function CategoryList({
  title,
  items,
}: {
  title: string;
  items: { name: string; value: number }[];
}) {
  const topItems = items.slice(0, 5);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {topItems.length === 0 ? (
          <p className="text-sm text-muted-foreground">No data yet.</p>
        ) : (
          <div className="space-y-2">
            {topItems.map((item) => (
              <div key={item.name} className="flex items-center justify-between text-sm">
                <span className="truncate pr-3">{item.name}</span>
                <span className="font-medium">{formatCurrency(item.value)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function AnalyticsCharts() {
  const { toast } = useToast();
  const [period, setPeriod] = useState<Period>("monthly");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    try {
      let url = `/api/analytics?period=${period}`;
      if (period === "custom" && startDate && endDate) {
        url += `&startDate=${startDate}&endDate=${endDate}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error("Failed to load analytics");
      }

      const data = (await response.json()) as AnalyticsData;
      setAnalytics(data);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to load analytics";
      toast({ title: "Error", description: message, variant: "destructive" });
      setAnalytics(null);
    } finally {
      setLoading(false);
    }
  }, [period, startDate, endDate, toast]);

  useEffect(() => {
    if (period === "custom" && (!startDate || !endDate)) {
      return;
    }
    fetchAnalytics();
  }, [fetchAnalytics, period, startDate, endDate]);

  const netBalance = useMemo(() => {
    if (!analytics) return 0;
    return analytics.netBalance;
  }, [analytics]);

  const periodSummary = useMemo(() => {
    if (!analytics) return null;

    const currentStart = new Date(`${analytics.period.startDate}T00:00:00`);
    const currentEnd = new Date(`${analytics.period.endDate}T00:00:00`);
    const previousStart = new Date(`${analytics.previousPeriod.startDate}T00:00:00`);
    const previousEnd = new Date(`${analytics.previousPeriod.endDate}T00:00:00`);

    return {
      current: `${currentStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${currentEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
      previous: `${previousStart.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} - ${previousEnd.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}`,
    };
  }, [analytics]);

  const chartData = useMemo(() => {
    if (!analytics) return [];

    if (period === "yearly") {
      return analytics.monthlyTrends.map((item) => ({
        label: item.month,
        income: item.income,
        expenses: item.expenses,
        givings: item.givings,
      }));
    }

    return analytics.dailyTrends.map((item) => ({
      label: item.date,
      income: item.income,
      expenses: item.expenses,
      givings: item.givings,
    }));
  }, [analytics, period]);

  const exportCsv = () => {
    if (!analytics) return;

    const rows = [
      ["Category", "Type", "Amount"],
      ...analytics.incomeByCategoryArray.map((item) => [item.name, "Income", item.value.toString()]),
      ...analytics.expensesByCategoryArray.map((item) => [item.name, "Expense", item.value.toString()]),
      ...analytics.givingsByCategoryArray.map((item) => [item.name, "Giving", item.value.toString()]),
    ];

    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `sika-report-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();

    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <LoadingState />;
  }

  if (!analytics) {
    return <p className="text-sm text-muted-foreground">No report data available.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2">
            <Calendar className="size-4 text-muted-foreground" />
          <Select value={period} onValueChange={(value) => setPeriod(value as Period)}>
            <SelectTrigger className="h-9 w-[170px]" aria-label="Reporting period">
              <SelectValue placeholder="Select period" />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          </div>

          {period === "custom" && (
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
              <span className="text-sm text-muted-foreground">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="h-9 rounded-md border bg-background px-2 text-sm"
              />
            </div>
          )}
        </div>

        <Button variant="outline" size="sm" onClick={exportCsv}>
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>
      </div>

      {periodSummary && (
        <p className="text-sm text-muted-foreground">
          Comparing <span className="font-medium text-foreground">{periodSummary.current}</span> with <span className="font-medium text-foreground">{periodSummary.previous}</span>
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Income</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-income">
            {formatCurrency(analytics.totalIncome)}
            <ComparisonHint value={analytics.comparisons.incomeChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Expenses</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-expense">
            {formatCurrency(analytics.totalExpenses)}
            <ComparisonHint value={analytics.comparisons.expensesChange} positiveIsGood={false} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Giving</CardTitle>
          </CardHeader>
          <CardContent className="text-xl font-semibold text-giving">
            {formatCurrency(analytics.totalGivings)}
            <ComparisonHint value={analytics.comparisons.givingsChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Net</CardTitle>
          </CardHeader>
          <CardContent className={`text-xl font-semibold ${netBalance >= 0 ? "text-foreground" : "text-expense"}`}>
            {netBalance >= 0 ? <Wallet className="mr-1 inline size-4" /> : <TrendingDown className="mr-1 inline size-4" />}
            {formatCurrency(Math.abs(netBalance))}
            <span className="ml-1 text-xs text-muted-foreground">{netBalance >= 0 ? "surplus" : "deficit"}</span>
            <ComparisonHint value={analytics.comparisons.netBalanceChange} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Safe to spend</CardTitle>
          </CardHeader>
          <CardContent className={`text-xl font-semibold ${analytics.safeToSpend >= 0 ? "text-foreground" : "text-expense"}`}>
            <PiggyBank className="mr-1 inline size-4" />
            {formatCurrency(Math.abs(analytics.safeToSpend))}
            <span className="ml-1 text-xs text-muted-foreground">{analytics.safeToSpend >= 0 ? "available" : "overcommitted"}</span>
          </CardContent>
        </Card>
      </div>

      {/* Spending Prediction Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="size-5 text-primary" />
            Spending Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Projected Monthly Income</p>
              <p className="mt-2 text-lg font-semibold text-income">
                {formatCurrency(analytics.spendingPrediction.projectedMonthlyIncome)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Projected Monthly Expenses</p>
              <p className="mt-2 text-lg font-semibold text-expense">
                {formatCurrency(analytics.spendingPrediction.projectedMonthlyExpenses)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Trend Direction</p>
              <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${
                analytics.spendingPrediction.trendDirection === "improving"
                  ? "text-foreground"
                  : analytics.spendingPrediction.trendDirection === "declining"
                    ? "text-expense"
                    : "text-obligation"
              }`}>
                {analytics.spendingPrediction.trendDirection === "improving" && <TrendingUp className="size-5" />}
                {analytics.spendingPrediction.trendDirection === "declining" && <TrendingDown className="size-5" />}
                {analytics.spendingPrediction.trendDirection === "stable" && <CheckCircle2 className="size-5" />}
                {analytics.spendingPrediction.trendDirection.charAt(0).toUpperCase() +
                  analytics.spendingPrediction.trendDirection.slice(1)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Days of Runway</p>
              <p className={`mt-2 text-lg font-semibold ${
                analytics.spendingPrediction.daysOfRunway === null
                  ? "text-foreground"
                  : analytics.spendingPrediction.daysOfRunway > 30
                    ? "text-obligation"
                    : "text-expense"
              }`}>
                {analytics.spendingPrediction.daysOfRunway === null
                  ? "∞"
                  : `${analytics.spendingPrediction.daysOfRunway} days`}
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-start gap-2 rounded-lg bg-muted p-3">
            <AlertCircle className="mt-0.5 size-4 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">{analytics.spendingPrediction.insight}</p>
          </div>
        </CardContent>
      </Card>

      {/* Safe to Spend Breakdown Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="size-5 text-muted-foreground" />
            Safe to Spend Breakdown
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Available</p>
              <p className="mt-2 text-lg font-semibold text-income">
                {formatCurrency(analytics.safeToSpendBreakdown.available)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Receipt className="size-3" />
                Committed Expenses
              </p>
              <p className="mt-2 text-lg font-semibold text-expense">
                -{formatCurrency(analytics.safeToSpendBreakdown.committedExpenses)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Target className="size-3" />
                Active Goals
              </p>
              <p className="mt-2 text-lg font-semibold text-obligation">
                -{formatCurrency(analytics.safeToSpendBreakdown.activeGoalsAllocation)}
              </p>
            </div>
            <div className="rounded-xl border border-border/60 p-4">
              <p className="text-sm text-muted-foreground">Remaining</p>
              <p className={`mt-2 text-lg font-semibold ${
                analytics.safeToSpendBreakdown.remaining >= 0 ? "text-foreground" : "text-expense"
              }`}>
                {formatCurrency(analytics.safeToSpendBreakdown.remaining)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Period comparison</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">Income</p>
            <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${getComparisonTone(analytics.comparisons.incomeChange)}`}>
              <TrendingUp className="size-4" />
              {formatChangeLabel(analytics.comparisons.incomeChange)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">Expenses</p>
            <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${getComparisonTone(analytics.comparisons.expensesChange, false)}`}>
              <TrendingDown className="size-4" />
              {formatChangeLabel(analytics.comparisons.expensesChange)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">Net balance</p>
            <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${getComparisonTone(analytics.comparisons.netBalanceChange)}`}>
              <Wallet className="size-4" />
              {formatChangeLabel(analytics.comparisons.netBalanceChange)}
            </p>
          </div>
          <div className="rounded-xl border border-border/60 p-4">
            <p className="text-sm text-muted-foreground">Activity</p>
            <p className={`mt-2 flex items-center gap-2 text-lg font-semibold ${getComparisonTone(analytics.comparisons.transactionCountChange)}`}>
              <Calendar className="size-4" />
              {formatChangeLabel(analytics.comparisons.transactionCountChange)}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Trend</CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="text-sm text-muted-foreground">No trend data for this period.</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                <Legend />
                <Line dataKey="income" stroke="var(--color-income)" strokeWidth={2} name="Income" dot={false} />
                <Line dataKey="expenses" stroke="var(--color-expense)" strokeWidth={2} name="Expenses" dot={false} />
                <Line dataKey="givings" stroke="var(--color-giving)" strokeWidth={2} name="Giving" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.expensesByCategoryArray.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense categories for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie
                    data={analytics.expensesByCategoryArray.slice(0, 6)}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={60}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {analytics.expensesByCategoryArray.slice(0, 6).map((entry, index) => (
                      <Cell key={entry.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Top Categories</CardTitle>
          </CardHeader>
          <CardContent>
            {analytics.expensesByCategoryArray.length === 0 ? (
              <p className="text-sm text-muted-foreground">No expense categories for this period.</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={analytics.expensesByCategoryArray.slice(0, 6)} layout="vertical" margin={{ left: 16 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" tick={{ fontSize: 12 }} />
                  <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => formatCurrency(Number(value ?? 0))} />
                  <Bar dataKey="value" fill="var(--color-expense)" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CategoryList title="Income Categories" items={analytics.incomeByCategoryArray} />
        <CategoryList title="Expense Categories" items={analytics.expensesByCategoryArray} />
        <CategoryList title="Giving Categories" items={analytics.givingsByCategoryArray} />
      </div>

      <p className="text-sm text-muted-foreground">Transactions in report: {analytics.transactionCount}</p>
    </div>
  );
}
