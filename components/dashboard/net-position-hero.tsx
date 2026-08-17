"use client";

import Link from "next/link";
import { cn, formatCurrency } from "@/lib/utils";
import { moneyTypeTone } from "@/lib/money-type";
import type { TransactionType } from "@/types";

interface NetPositionHeroProps {
  totalIncome: number;
  totalExpenses: number;
  totalGivings: number;
  netBalance: number;
  /** Rendered inside the hero, top right — usually the period picker. */
  periodControl?: React.ReactNode;
  periodLabel: string;
}

interface Tile {
  label: string;
  value: number;
  /** The money type itself — the token is derived, never hand-written, so a
   *  tile can't be coloured without also being classified. */
  type: TransactionType;
  note: string;
  /**
   * Where the figure leads. Income and expenses open the register already
   * filtered to that type; giving opens the giving workspace instead, because
   * giving is the one money type with somewhere of its own to go.
   */
  href: string;
}

/**
 * The dashboard's anchor: one figure large enough to answer "how did I do"
 * before you read anything else, with the in / out / kept split as a single
 * bar rather than three competing cards.
 */
export function NetPositionHero({
  totalIncome,
  totalExpenses,
  totalGivings,
  netBalance,
  periodControl,
  periodLabel,
}: NetPositionHeroProps) {
  const surplus = netBalance >= 0;
  // Shares are of money that came in. With no income there is nothing to
  // apportion, so the bar collapses rather than dividing by zero.
  const base = totalIncome > 0 ? totalIncome : 0;
  const pct = (n: number) => (base > 0 ? Math.max(0, (n / base) * 100) : 0);

  // Shown as they really are — spending 120% of income is the fact worth
  // reading, so the label is not clamped.
  const spentPct = pct(totalExpenses);
  const givenPct = pct(totalGivings);
  // With no income there is nothing to have kept — not 100% of nothing.
  const keptPct = base > 0 ? Math.max(0, 100 - spentPct - givenPct) : 0;

  // Drawn to fit. In a deficit month spent + given exceeds the track, so the
  // segments are scaled to fill it proportionally instead of overflowing and
  // being clipped into a misleading picture.
  const drawnTotal = Math.max(spentPct + givenPct, 100);
  const spentWidth = (spentPct / drawnTotal) * 100;
  const givenWidth = (givenPct / drawnTotal) * 100;
  const keptWidth = base > 0 ? Math.max(0, 100 - spentWidth - givenWidth) : 0;

  const tiles: Tile[] = [
    {
      label: "Income",
      value: totalIncome,
      type: "income",
      note: periodLabel,
      href: "/dashboard/transactions?type=income",
    },
    {
      label: "Expenses",
      value: totalExpenses,
      type: "expense",
      note: base > 0 ? `${Math.round(spentPct)}% of income` : "—",
      href: "/dashboard/transactions?type=expense",
    },
    {
      label: "Giving",
      value: totalGivings,
      type: "giving",
      note: base > 0 ? `${Math.round(givenPct)}% of income` : "—",
      href: "/dashboard/giving",
    },
  ];

  return (
    <section className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
      <div className="flex min-h-[220px] flex-col justify-between rounded-[20px] bg-hero p-6 sm:p-7">
        <div className="flex items-start justify-between gap-4">
          <p className="text-[12.5px] font-medium text-hero-accent">
            Net position · {periodLabel.toLowerCase()}
          </p>
          {periodControl}
        </div>

        <div className="py-6">
          <p className="font-display text-[42px] font-semibold leading-none tracking-[-0.035em] tabular-nums text-hero-ink sm:text-[60px]">
            {formatCurrency(Math.abs(netBalance))}
          </p>
          <p className="mt-2.5 text-[13.5px] text-hero-muted">
            {surplus ? "Surplus" : "Deficit"}
            {base > 0 && (
              <>
                {" · you kept "}
                <span className="font-semibold text-hero-accent">
                  {Math.round(keptPct)}%
                </span>
                {" of what came in"}
              </>
            )}
          </p>
        </div>

        <div>
          <div
            className="flex h-2 gap-0.5 overflow-hidden rounded-full"
            role="img"
            aria-label={`Spent ${Math.round(spentPct)} percent, given ${Math.round(
              givenPct
            )} percent, kept ${Math.round(keptPct)} percent of income`}
          >
            {spentWidth > 0 && (
              <div className="rounded-full bg-expense" style={{ width: `${spentWidth}%` }} />
            )}
            {givenWidth > 0 && (
              <div className="rounded-full bg-giving" style={{ width: `${givenWidth}%` }} />
            )}
            {keptWidth > 0 && (
              <div
                className="rounded-full bg-hero-ink/25"
                style={{ width: `${keptWidth}%` }}
              />
            )}
            {base === 0 && <div className="w-full rounded-full bg-hero-ink/15" />}
          </div>
          <div className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-hero-muted">
            <Legend swatch="bg-expense" label={`Spent ${Math.round(spentPct)}%`} />
            <Legend swatch="bg-giving" label={`Given ${Math.round(givenPct)}%`} />
            <Legend swatch="bg-hero-ink/25" label={`Kept ${Math.round(keptPct)}%`} />
          </div>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-1 lg:grid-rows-3">
        {tiles.map((tile) => (
          <Link
            key={tile.label}
            href={tile.href}
            className="group flex items-center justify-between gap-3 rounded-2xl border border-border/70 bg-card p-4 transition-colors hover:border-border hover:bg-secondary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background sm:px-[18px]"
          >
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground transition-colors group-hover:text-foreground">
                {tile.label}
              </p>
              <p
                className={cn(
                  "mt-1 font-display text-[23px] font-semibold tracking-[-0.02em] tabular-nums",
                  moneyTypeTone(tile.type).text
                )}
              >
                {formatCurrency(tile.value)}
              </p>
            </div>
            <span className="flex-none rounded-md bg-secondary px-2 py-1 text-[11.5px] font-medium text-muted-foreground tabular-nums">
              {tile.note}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={cn("size-[7px] rounded-full", swatch)} />
      {label}
    </span>
  );
}
