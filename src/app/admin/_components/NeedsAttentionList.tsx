"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ExclamationTriangleIcon,
  IdentificationIcon,
  QueueListIcon,
  ReceiptPercentIcon,
  TruckIcon,
  WrenchScrewdriverIcon,
} from "@heroicons/react/24/outline";

export type NeedsAttentionRow = {
  label: string;
  count: number;
  href?: string;
  icon:
    | "portal-requests"
    | "overdue-pickups"
    | "overdue-deliveries"
    | "licenses"
    | "expenses"
    | "dumpsters"
    | "fleet";
  tone: "portal" | "danger" | "violet" | "amber";
};

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function OctagonAlert(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9.172 2.75h5.656a2 2 0 0 1 1.414.586l5.172 5.172a2 2 0 0 1 .586 1.414v4.156a2 2 0 0 1-.586 1.414l-5.172 5.172a2 2 0 0 1-1.414.586H9.172a2 2 0 0 1-1.414-.586l-5.172-5.172A2 2 0 0 1 2 14.078V9.922a2 2 0 0 1 .586-1.414L7.758 3.336a2 2 0 0 1 1.414-.586Z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.75v5.5" />
      <circle cx="12" cy="16.25" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

const ATTENTION_ROW_ICONS = {
  "portal-requests": QueueListIcon,
  "overdue-pickups": ExclamationTriangleIcon,
  "overdue-deliveries": OctagonAlert,
  licenses: IdentificationIcon,
  expenses: ReceiptPercentIcon,
  dumpsters: WrenchScrewdriverIcon,
  fleet: TruckIcon,
} satisfies Record<NeedsAttentionRow["icon"], React.ComponentType<React.SVGProps<SVGSVGElement>>>;

function getToneClasses(tone: NeedsAttentionRow["tone"]) {
  switch (tone) {
    case "danger":
      return {
        iconChip: "bg-rose-50 text-rose-700",
        value: "text-rose-700",
      };
    case "violet":
      return {
        iconChip: "bg-violet-50 text-violet-700",
        value: "text-violet-700",
      };
    case "amber":
      return {
        iconChip: "bg-amber-50 text-amber-700",
        value: "text-amber-700",
      };
    case "portal":
    default:
      return {
        iconChip: "bg-orange-50 text-[#F97316]",
        value: "text-[#F97316]",
      };
  }
}

function AttentionRowLink({ row }: { row: NeedsAttentionRow }) {
  const Icon = ATTENTION_ROW_ICONS[row.icon];
  const toneClasses = getToneClasses(row.tone);
  const content = (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <span className={joinClasses("flex h-8 w-8 shrink-0 items-center justify-center rounded-2xl", toneClasses.iconChip)}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="text-sm font-semibold text-slate-900">{row.label}</div>
      </div>
      <div className={joinClasses("shrink-0 text-lg font-semibold tracking-tight", toneClasses.value)}>
        {new Intl.NumberFormat("en-US").format(row.count)}
      </div>
    </>
  );

  if (row.href) {
    return (
      <Link
        href={row.href}
        className="flex items-center justify-between gap-4 rounded-2xl px-2 py-3 transition-colors duration-150 hover:bg-orange-50/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
      >
        {content}
      </Link>
    );
  }

  return <div className="flex items-center justify-between gap-4 rounded-2xl px-2 py-3">{content}</div>;
}

export function NeedsAttentionList({
  rows,
  initialVisibleCount = 5,
}: {
  rows: NeedsAttentionRow[];
  initialVisibleCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);

  if (rows.length === 0) {
    return (
      <div className="rounded-[24px] border border-dashed border-slate-300 bg-slate-50/70 px-5 py-10 text-sm text-slate-500">
        No items need attention right now.
      </div>
    );
  }

  const hasOverflow = rows.length > initialVisibleCount;
  const visibleRows = expanded || !hasOverflow ? rows : rows.slice(0, initialVisibleCount);
  const remainingCount = Math.max(rows.length - initialVisibleCount, 0);

  return (
    <div className="divide-y divide-slate-200/80">
      {visibleRows.map((row) => (
        <AttentionRowLink key={row.label} row={row} />
      ))}

      {hasOverflow ? (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          className="flex w-full items-center justify-between gap-4 rounded-2xl px-2 py-3 text-left text-sm font-semibold text-[#F97316] transition hover:bg-orange-50/55 hover:text-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/25 focus-visible:ring-offset-2"
        >
          <span>{expanded ? "Show fewer" : `View ${remainingCount} more →`}</span>
        </button>
      ) : null}
    </div>
  );
}
