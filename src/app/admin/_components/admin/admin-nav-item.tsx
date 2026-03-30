"use client";

import Link from "next/link";
import {
  AdjustmentsHorizontalIcon,
  BanknotesIcon,
  BookOpenIcon,
  CalendarDaysIcon,
  ChartBarSquareIcon,
  ClipboardDocumentCheckIcon,
  ClipboardDocumentListIcon,
  DocumentTextIcon,
  FunnelIcon,
  MapIcon,
  Squares2X2Icon,
  TagIcon,
  UsersIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";
import type { AdminNavItem as AdminNavItemType } from "./admin-nav";

const iconMap = {
  dashboard: Squares2X2Icon,
  bookings: ClipboardDocumentCheckIcon,
  schedule: CalendarDaysIcon,
  customers: UsersIcon,
  financials: BanknotesIcon,
  portalRequests: ClipboardDocumentListIcon,
  pricing: TagIcon,
  serviceArea: MapIcon,
  retailSiteSettings: AdjustmentsHorizontalIcon,
  retailSiteContent: DocumentTextIcon,
  leadFunnel: FunnelIcon,
  zipHeatmap: ChartBarSquareIcon,
  guides: BookOpenIcon,
  adminTools: WrenchScrewdriverIcon,
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
        "group relative flex h-[42px] items-center rounded-[18px] border text-sm transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/50 focus-visible:ring-offset-2",
        collapsed ? "justify-center px-2" : "gap-2.5 px-3",
        isActive
          ? "border-slate-900/90 bg-slate-900 text-white shadow-[0_8px_18px_rgba(15,23,42,0.12)]"
          : "border-transparent text-slate-600 hover:border-slate-200/90 hover:bg-white hover:text-slate-900 hover:shadow-[0_4px_10px_rgba(15,23,42,0.045)]",
      ].join(" ")}
    >
      <span
        className={[
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-[10px] border transition-colors duration-200",
          isActive
            ? "border-white/12 bg-white/8 text-white"
            : "border-slate-200/80 bg-slate-50 text-slate-500 group-hover:border-slate-200 group-hover:bg-slate-100 group-hover:text-slate-700",
        ].join(" ")}
      >
        <Icon className="h-4 w-4 shrink-0" />
      </span>
      <span
        className={[
          "overflow-hidden whitespace-nowrap font-medium transition-all duration-200",
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
