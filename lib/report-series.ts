export interface MonthlyTrend {
  month: string;
  income: number;
  expenses: number;
  givings: number;
}

export interface MonthlySeriesPoint {
  key: string;
  label: string;
  income: number;
  expenses: number;
  givings: number;
  isCurrent: boolean;
}

export function buildReportChartAxis(series: MonthlySeriesPoint[]) {
  const labels = new Map(series.map(({ key, label }) => [key, label]));

  return {
    dataKey: "key" as const,
    tickFormatter: (key: unknown) =>
      typeof key === "string" ? labels.get(key) ?? key : "",
  };
}

export function buildMonthlySeries(
  trends: MonthlyTrend[],
  startDate: string,
  endDate: string,
  currentDate = new Date(),
): MonthlySeriesPoint[] {
  const byMonth = new Map(trends.map((trend) => [trend.month, trend]));
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const currentKey = `${currentDate.getFullYear()}-${String(
    currentDate.getMonth() + 1,
  ).padStart(2, "0")}`;
  const series: MonthlySeriesPoint[] = [];

  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(
      cursor.getMonth() + 1,
    ).padStart(2, "0")}`;
    const trend = byMonth.get(key);

    series.push({
      key,
      label: cursor.toLocaleDateString("en-GB", { month: "short" }),
      income: trend?.income ?? 0,
      expenses: trend?.expenses ?? 0,
      givings: trend?.givings ?? 0,
      isCurrent: key === currentKey,
    });

    cursor.setMonth(cursor.getMonth() + 1);
  }

  return series;
}
