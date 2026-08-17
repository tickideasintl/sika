import {
  ArrowLeftRight,
  BarChart3,
  Bell,
  CalendarDays,
  CreditCard,
  HandCoins,
  HeartHandshake,
  Landmark,
  LayoutDashboard,
  Repeat,
  Settings,
  WalletCards,
  Users,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  /** Shorter label for the mobile tab bar, where five items share the width. */
  shortLabel?: string;
  /** Earns a slot in the mobile tab bar. Five is the most a thumb row holds. */
  mobileTab?: boolean;
  /** Carries the count of outgoings that are due or overdue. */
  showsDueBadge?: boolean;
  /** Carries the count of unread live notifications. */
  showsNotificationBadge?: boolean;
  /**
   * Label comes from the workspace vocabulary rather than `label`: "Clients"
   * in a business workspace, "People" in a personal one. See
   * `lib/party-labels.ts`.
   */
  usesPartyLabel?: boolean;
}

export interface NavGroup {
  /** Group heading. Null renders the items with no heading above them. */
  heading: string | null;
  items: NavItem[];
}

/**
 * The destinations, grouped. The flat bar this replaced gave every destination
 * equal weight; splitting them into "what moved" and "what you hold" means the
 * sidebar can be read as two short lists instead of one long one.
 */
export const navGroups: NavGroup[] = [
  {
    heading: null,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Overview", mobileTab: true },
    ],
  },
  {
    heading: "Money in & out",
    items: [
      {
        href: "/dashboard/transactions",
        icon: ArrowLeftRight,
        label: "Transactions",
        shortLabel: "Activity",
        mobileTab: true,
      },
      {
        href: "/dashboard/outgoings",
        icon: Repeat,
        label: "Outgoings",
        mobileTab: true,
        showsDueBadge: true,
      },
      { href: "/dashboard/calendar", icon: CalendarDays, label: "Calendar" },
      {
        href: "/dashboard/notifications",
        icon: Bell,
        label: "Notifications",
        showsNotificationBadge: true,
      },
      {
        href: "/dashboard/clients",
        icon: Users,
        // Overridden per workspace type; this is the fallback and the value the
        // mobile tab bar would use if it ever earned a slot.
        label: "Clients",
        usesPartyLabel: true,
      },
      { href: "/dashboard/giving", icon: HeartHandshake, label: "Giving" },
      { href: "/dashboard/reports", icon: BarChart3, label: "Reports", mobileTab: true },
    ],
  },
  {
    heading: "Balance sheet",
    items: [
      { href: "/dashboard/accounts", icon: WalletCards, label: "Accounts" },
      { href: "/dashboard/debts", icon: CreditCard, label: "Debts" },
      { href: "/dashboard/loans", icon: HandCoins, label: "Loans given" },
      { href: "/dashboard/investments", icon: Landmark, label: "Investments" },
    ],
  },
];

/**
 * Settings does not hold a thumb slot: it is one tap away in the account menu
 * that sits in the mobile header, and the fifth slot buys reachability for the
 * eight destinations that would otherwise have no route below `lg`.
 */
export const settingsItem: NavItem = {
  href: "/dashboard/settings",
  icon: Settings,
  label: "Settings",
};

export const allNavItems: NavItem[] = [
  ...navGroups.flatMap((group) => group.items),
  settingsItem,
];

/** The four that earn a slot in the mobile tab bar, in nav order. */
export const mobileTabItems: NavItem[] = allNavItems.filter((item) => item.mobileTab);

/**
 * Everything the thumb row cannot hold, kept in the sidebar's own grouping so
 * the overflow menu reads as the same map rather than a second one. Settings
 * is appended by the menu itself; it belongs to no group.
 */
export const mobileMoreGroups: NavGroup[] = navGroups
  .map((group) => ({ ...group, items: group.items.filter((item) => !item.mobileTab) }))
  .filter((group) => group.items.length > 0);
