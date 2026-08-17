"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, MoreHorizontal, Search } from "lucide-react";
import { SikaLogo } from "@/components/sika-logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import {
  mobileMoreGroups,
  mobileTabItems,
  settingsItem,
} from "@/components/dashboard/nav-items";
import { useDueOutgoingsCount } from "@/hooks/use-due-outgoings";
import { WorkspaceSwitcher } from "@/components/dashboard/workspace-switcher";
import { AccountMenu, type AccountUser } from "@/components/dashboard/account-menu";
import { useNotifications } from "@/hooks/use-notifications";
import { usePartyLabels } from "@/hooks/use-party-labels";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

/**
 * Shared by the four tab links and the More trigger so they cannot drift apart.
 * The focus ring is the system's button treatment — a Mint ring offset against
 * the bar's own fill — because the slots had none and the browser default is
 * a 1px near-black outline, invisible on this surface.
 */
const slotClasses =
  "relative flex h-[50px] flex-col items-center justify-center gap-1 rounded-[13px] text-[10.5px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card";

/** Logo, workspace, theme and account — the chrome the sidebar carries on desktop. */
export function DashboardMobileHeader({ user }: { user: AccountUser }) {
  const initial = (user.name || user.email).charAt(0).toUpperCase();
  const { data: notifications } = useNotifications();

  return (
    <div className="flex items-center justify-between gap-3 lg:hidden">
      <div className="flex min-w-0 flex-1 items-center gap-2.5">
        <Link href="/dashboard">
          <SikaLogo size="sm" />
        </Link>
        <WorkspaceSwitcher variant="compact" />
      </div>

      <div className="flex flex-none items-center gap-2">
        <Link
          href="/dashboard/notifications"
          aria-label={`${notifications?.unread ?? 0} unread notifications`}
          className="relative flex size-[38px] items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Bell className="size-4" />
          {(notifications?.unread ?? 0) > 0 && (
            <span className="absolute -right-1 -top-1 flex size-[16px] items-center justify-center rounded-full bg-obligation text-[9px] font-bold text-obligation-foreground">
              {notifications?.unread}
            </span>
          )}
        </Link>
        <Link
          href="/dashboard/transactions#transaction-search"
          aria-label="Search transactions"
          className="flex size-[38px] items-center justify-center rounded-[11px] border border-border bg-card text-muted-foreground transition-colors hover:bg-secondary/60 hover:text-foreground"
        >
          <Search className="size-4" />
        </Link>
        <ThemeToggle />
        <AccountMenu user={user} align="end">
          <button
            aria-label="Account menu"
            className="flex size-9 items-center justify-center rounded-full bg-track text-xs font-semibold"
          >
            {initial}
          </button>
        </AccountMenu>
      </div>
    </div>
  );
}

/**
 * Floating five-slot tab bar. Replaces the sidebar below lg.
 *
 * Four destinations plus an overflow menu, rather than five destinations: with
 * twelve pages in the rail, a fifth link left eight of them with no route at all
 * below `lg` — Giving, Accounts, Debts, Loans given and Investments were
 * unreachable on a phone. Settings gave up its slot because the account menu in
 * the header already reaches it.
 */
export function DashboardTabBar() {
  const pathname = usePathname();
  const dueCount = useDueOutgoingsCount();
  const { data: notifications } = useNotifications();
  const partyLabels = usePartyLabels();

  const moreItems = [...mobileMoreGroups.flatMap((group) => group.items), settingsItem];
  const moreActive = moreItems.some((item) => item.href === pathname);

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-2.5 z-50 mt-auto grid grid-cols-5 gap-0.5 rounded-[18px] border border-border bg-card/95 p-1.5 shadow-[0_14px_34px_rgba(0,0,0,.2)] backdrop-blur-xl lg:hidden dark:shadow-[0_14px_34px_rgba(0,0,0,.55)]"
    >
      {mobileTabItems.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              slotClasses,
              active
                ? "bg-secondary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="size-[19px]" />
            {item.shortLabel ?? item.label}
            {item.showsDueBadge && dueCount > 0 && (
              <span className="absolute right-[calc(50%-20px)] top-1.5 flex size-[15px] items-center justify-center rounded-full bg-obligation text-[9.5px] font-bold text-obligation-foreground tabular-nums">
                {dueCount}
                <span className="sr-only"> due or overdue</span>
              </span>
            )}
          </Link>
        );
      })}

      <DropdownMenu>
        <DropdownMenuTrigger
          className={cn(
            slotClasses,
            moreActive
              ? "bg-secondary text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <MoreHorizontal className="size-[19px]" />
          More
        </DropdownMenuTrigger>
        {/* Anchored to the bar, so it opens upward over the content it covers.
            The cap is Radix's own measurement of the gap between the trigger and
            the viewport edge, not a fixed height: nine destinations fit a phone
            outright, and only a short viewport — browser chrome, a keyboard —
            makes it scroll. */}
        <DropdownMenuContent
          side="top"
          align="end"
          className="max-h-[var(--radix-dropdown-menu-content-available-height)] w-56 overflow-y-auto"
        >
          {mobileMoreGroups.map((group) => (
            <div key={group.heading ?? "ungrouped"}>
              {group.heading && (
                <DropdownMenuLabel className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted-foreground">
                  {group.heading}
                </DropdownMenuLabel>
              )}
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                const badge = item.showsNotificationBadge ? notifications?.unread : undefined;
                return (
                  <DropdownMenuItem key={item.href} asChild>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn("gap-2.5", active && "bg-accent text-foreground")}
                    >
                      <Icon className="size-4 flex-none" />
                      {item.usesPartyLabel ? partyLabels.plural : item.label}
                      {badge != null && badge > 0 && (
                        <span className="ml-auto rounded-md bg-obligation-surface px-1.5 py-0.5 text-[11px] font-semibold text-obligation tabular-nums">
                          {badge}
                          <span className="sr-only"> unread</span>
                        </span>
                      )}
                    </Link>
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
            </div>
          ))}
          <DropdownMenuItem asChild>
            <Link
              href={settingsItem.href}
              aria-current={pathname === settingsItem.href ? "page" : undefined}
              className={cn(
                "gap-2.5",
                pathname === settingsItem.href && "bg-accent text-foreground"
              )}
            >
              <settingsItem.icon className="size-4 flex-none" />
              {settingsItem.label}
            </Link>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </nav>
  );
}
