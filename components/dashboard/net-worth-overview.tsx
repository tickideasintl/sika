"use client";

import Link from "next/link";
import { useApiQuery } from "@/hooks/use-api";
import { cn, formatCurrency } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { navigableFigure } from "@/components/dashboard/panel";

interface NetWorthResponse {
  assets: number;
  liabilities: number;
  netWorth: number;
  investmentsValue: number;
  loansReceivable: number;
  accountAssets: number;
  accountLiabilities: number;
  debtsOwed: number;
  accountCount: number;
  investmentCount: number;
  loanCount: number;
  debtCount: number;
}

/**
 * The balance sheet in one figure and one bar.
 *
 * Net-worth components are stocks, not flows, so the four money tokens mostly
 * do not apply — only "debts owed" is a money type (an obligation). The asset
 * segments are graduated neutral instead, which keeps them distinguishable
 * without claiming a meaning they do not have. The prototype coloured loans
 * out with the giving token; that would say a loan receivable is a tithe.
 */
export function NetWorthOverview() {
  const { data, loading, error } = useApiQuery<NetWorthResponse>("/api/net-worth");

  if (loading || !data) {
    return (
      <Card>
        <CardContent className="py-8 text-sm text-muted-foreground">
          {error ?? "Loading net worth…"}
        </CardContent>
      </Card>
    );
  }

  const positive = data.netWorth >= 0;
  const cashAndOther = Math.max(
    data.assets - data.investmentsValue - data.loansReceivable,
    0
  );

  // The bar apportions everything on the balance sheet, both sides, so the
  // liability reads as a share of the whole rather than as a negative width.
  const total =
    data.investmentsValue + cashAndOther + data.loansReceivable + data.liabilities;
  const share = (n: number) => (total > 0 ? (n / total) * 100 : 0);

  const segments = [
    { value: data.investmentsValue, className: "bg-foreground/70" },
    { value: cashAndOther, className: "bg-foreground/40" },
    { value: data.loansReceivable, className: "bg-foreground/25" },
    { value: data.liabilities, className: "bg-obligation" },
  ];

  // Each column is the summary of a page, so each one opens it. "Cash & other"
  // is the only label that does not name its destination, so it carries the
  // accessible name the visible text cannot.
  const columns = [
    {
      label: "Investments",
      value: data.investmentsValue,
      tone: "",
      href: "/dashboard/investments",
      title: "Investments",
    },
    {
      label: "Cash & other",
      value: cashAndOther,
      tone: "",
      href: "/dashboard/accounts",
      title: "Cash and other assets — open Accounts",
    },
    {
      label: "Loans out",
      value: data.loansReceivable,
      tone: "",
      href: "/dashboard/loans",
      title: "Loans given",
    },
    {
      label: "Debts owed",
      value: -data.liabilities,
      tone: data.liabilities > 0 ? "text-obligation" : "",
      href: "/dashboard/debts",
      title: "Debts",
    },
  ];

  return (
    <Card>
      <CardContent className="flex flex-wrap items-start justify-between gap-8 pt-5 sm:pt-6">
        <div>
          <p className="text-xs text-muted-foreground">Net worth</p>
          <p
            className={cn(
              "mt-1.5 font-display text-[30px] font-semibold leading-none tracking-[-0.03em] tabular-nums sm:text-4xl",
              positive ? "text-foreground" : "text-expense"
            )}
          >
            {formatCurrency(data.netWorth)}
          </p>
          <p className="mt-2 text-[12.5px] text-muted-foreground tabular-nums">
            {formatCurrency(data.assets)} in assets against{" "}
            {formatCurrency(data.liabilities)} owed
          </p>
        </div>

        <div className="min-w-full flex-1 sm:min-w-[340px]">
          <div
            className="mb-3.5 flex h-2.5 gap-[3px]"
            role="img"
            aria-label={`Balance sheet: investments ${Math.round(
              share(data.investmentsValue)
            )}%, cash and other ${Math.round(share(cashAndOther))}%, loans out ${Math.round(
              share(data.loansReceivable)
            )}%, debts owed ${Math.round(share(data.liabilities))}%`}
          >
            {segments.map((seg, i) =>
              seg.value > 0 ? (
                <div
                  key={i}
                  className={cn("rounded-full", seg.className)}
                  style={{ width: `${share(seg.value)}%` }}
                />
              ) : null
            )}
            {total === 0 && <div className="w-full rounded-full bg-track" />}
          </div>

          <div className="grid grid-cols-2 gap-x-5 gap-y-4 sm:grid-cols-4">
            {columns.map((col) => (
              <Link
                key={col.label}
                href={col.href}
                aria-label={col.title}
                className={cn(navigableFigure, "group")}
              >
                <p className="text-[11.5px] text-muted-foreground transition-colors group-hover:text-foreground">
                  {col.label}
                </p>
                <p
                  className={cn(
                    "mt-1 text-[15px] font-semibold tabular-nums",
                    col.tone
                  )}
                >
                  {col.value < 0 ? "−" : ""}
                  {formatCurrency(Math.abs(col.value))}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
