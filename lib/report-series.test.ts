import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMonthlySeries, buildReportChartAxis } from "./report-series";

describe("buildMonthlySeries", () => {
  it("covers custom ranges longer than 36 months without truncation", () => {
    const series = buildMonthlySeries(
      [],
      "2022-01-01",
      "2026-01-01",
      new Date("2026-01-10T00:00:00"),
    );

    assert.equal(series.length, 49);
    assert.equal(series[0]?.key, "2022-01");
    assert.equal(series.at(-1)?.key, "2026-01");
    assert.equal(series.at(-1)?.isCurrent, true);
  });

  it("fills missing months while preserving returned totals", () => {
    const series = buildMonthlySeries(
      [
        {
          month: "2026-02",
          income: 1000,
          expenses: 400,
          givings: 100,
        },
      ],
      "2026-01-15",
      "2026-03-20",
      new Date("2026-03-01T00:00:00"),
    );

    assert.deepEqual(
      series.map(({ key, income, expenses, givings }) => ({
        key,
        income,
        expenses,
        givings,
      })),
      [
        { key: "2026-01", income: 0, expenses: 0, givings: 0 },
        { key: "2026-02", income: 1000, expenses: 400, givings: 100 },
        { key: "2026-03", income: 0, expenses: 0, givings: 0 },
      ],
    );
  });
});

describe("buildReportChartAxis", () => {
  it("targets the correct report values when the opening and closing months have the same display label", () => {
    const series = buildMonthlySeries(
      [{ month: "2026-11", expenses: 42.35, givings: 12.75, income: 82.5 }],
      "2025-11-25",
      "2026-11-25",
      new Date("2026-11-25T00:00:00"),
    );
    const { dataKey, tickFormatter } = buildReportChartAxis(series);
    const firstKey = series[0][dataKey];
    const lastKey = series[series.length - 1][dataKey];

    assert.equal(tickFormatter(firstKey), "Nov");
    assert.equal(tickFormatter(lastKey), "Nov");
    assert.equal(new Set(series.map((point) => point[dataKey])).size, series.length);
    assert.deepEqual(
      series.find((point) => point[dataKey] === lastKey),
      { key: "2026-11", label: "Nov", expenses: 42.35, givings: 12.75, income: 82.5, isCurrent: true },
    );
  });
});
