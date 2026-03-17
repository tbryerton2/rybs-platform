"use client";

import Link from "next/link";
import {
  BanknotesIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  CreditCardIcon,
  HomeIcon,
  MapPinIcon,
  QueueListIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import type { AdminNavItem as AdminNavItemType } from "./admin-nav";

const iconMap = {
  home: HomeIcon,
  bookings: QueueListIcon,
  schedule: CalendarDaysIcon,
  customers: UsersIcon,
  financials: BanknotesIcon,
  analytics: MapPinIcon,
  pricing: CreditCardIcon,
  zips: MapPinIcon,
  docs: BookOpenIcon,
  system: WrenchScrewdriverIcon,
} as const;

export function AdminNavItem({
  item,
  isActive,
  collapsed,
}: {
  item: AdminNavItemType;
  isActive: boolean;
  collapsed: boolean;
}) {
  const Icon = iconMap[item.icon];

  return (
    <Link
      href={item.href}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={[
        "group relative flex items-center rounded-2xl text-sm font-medium transition-all duration-200",
        collapsed ? "justify-center px-2 py-2.5" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-slate-900 text-white shadow-sm"
          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
      ].join(" ")}
    >
      <Icon className={["h-5 w-5 shrink-0", isActive ? "text-white" : "text-slate-500 group-hover:text-slate-700"].join(" ")} />
      <span
        className={[
          "overflow-hidden whitespace-nowrap transition-all duration-200",
          collapsed ? "w-0 opacity-0" : "w-auto opacity-100",
        ].join(" ")}
      >
        {item.label}
      </span>

      {collapsed ? (
        <span className="pointer-events-none absolute left-full top-1/2 z-20 ml-3 -translate-y-1/2 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 opacity-0 shadow-lg transition-opacity duration-150 group-hover:opacity-100">
          {item.label}
        </span>
      ) : null}
    </Link>
  );
}
