import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The shapes the redesign repeats across pages. They were copied literally
 * between seven files, which is how a padding tweak reaches six of them and
 * misses the seventh.
 */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-5 py-12 text-center sm:px-6", className)}>
      <div className="mx-auto mb-3 flex size-11 items-center justify-center rounded-2xl bg-secondary">
        <Icon className="size-5 text-muted-foreground" />
      </div>
      <p className="font-medium">{title}</p>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/**
 * The treatment for a figure that navigates to the page it summarises.
 *
 * Nothing is added at rest — a stat that looks like a button would put chrome
 * on the one thing the page exists to show. The affordance arrives on hover as
 * a Wash fill behind the block and Ink on its label, and on focus as the
 * system's Mint ring. Per the Float-Or-Flat Rule it never lifts.
 *
 * The negative margin is what lets the fill breathe past the text without
 * moving anything at rest: padding for the hover surface, pulled back out of
 * the layout it sits in.
 */
export const navigableFigure =
  "-m-2 block rounded-xl p-2 transition-colors hover:bg-secondary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/**
 * A label over one figure. Not a Card: a tile holds a single number, so it
 * takes the tile radius and the tighter padding — see Shapes in DESIGN.md.
 */
export function StatTile({
  label,
  value,
  tone,
  note,
  className,
}: {
  label: string;
  value: string;
  /** A money token, when the figure is classified. Neutral otherwise. */
  tone?: string;
  note?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border/70 bg-card p-[18px] sm:px-5",
        className
      )}
    >
      <p className="text-xs text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1.5 font-display text-[26px] font-semibold tracking-[-0.02em] tabular-nums",
          tone
        )}
      >
        {value}
      </p>
      {note && (
        <p className="mt-0.5 text-xs font-medium text-muted-foreground tabular-nums">
          {note}
        </p>
      )}
    </div>
  );
}

/**
 * A band heading outside a card. Matches CardTitle's type so a section and a
 * card read at the same level — including its leading-none, which the
 * hand-rolled copies kept dropping.
 */
export function SectionHeading({
  title,
  aside,
  className,
}: {
  title: string;
  aside?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-3 flex items-baseline justify-between gap-4", className)}>
      <h2 className="font-display text-base font-semibold leading-none tracking-[-0.015em]">
        {title}
      </h2>
      {aside && (
        <span className="text-[12.5px] text-muted-foreground tabular-nums">
          {aside}
        </span>
      )}
    </div>
  );
}
