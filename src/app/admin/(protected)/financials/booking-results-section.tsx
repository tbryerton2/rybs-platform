"use client";

import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/outline";

type SortDirection = "asc" | "desc";

type BookingResultsRow = {
  id: string;
  customerName: string;
  customerZip: string;
  customerCity: string;
  deliveryDate: string;
  pickupDate: string;
  statusLabel: string;
  statusTone: string;
  priceLabel: string;
  detailHref: string;
};

type SortColumn = {
  key: string;
  label: string;
  href: string;
  active: boolean;
  direction: SortDirection;
  align?: "left" | "right";
};

type ChartPoint = {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  bookings: number;
};

type BookingResultsSectionProps = {
  rows: BookingResultsRow[];
  sortColumns: SortColumn[];
  chartPoints: ChartPoint[];
  currentView: "table" | "chart";
  tableHref: string;
  chartHref: string;
  currentGranularity: "daily" | "weekly" | "monthly" | "annual";
  granularityOptions: Array<{
    key: "daily" | "weekly" | "monthly" | "annual";
    label: string;
    href: string;
  }>;
  totalValueLabel: string;
  bookingsLabel: string;
  averageValueLabel: string;
  bucketLabel: string;
};

export function BookingResultsSection({
  rows,
  sortColumns,
  chartPoints,
  currentView,
  tableHref,
  chartHref,
  currentGranularity,
  granularityOptions,
  totalValueLabel,
  bookingsLabel,
  averageValueLabel,
  bucketLabel,
}: BookingResultsSectionProps) {
  const maxValue = Math.max(...chartPoints.map((point) => point.value), 0);
  const hasRows = rows.length > 0;
  const chartTicks = maxValue > 0 ? [1, 0.75, 0.5, 0.25, 0] : [1, 0.5, 0];
  const barPalettes = [
    {
      fill: "bg-emerald-300",
      highlight: "bg-emerald-100/80",
    },
    {
      fill: "bg-sky-300",
      highlight: "bg-sky-100/80",
    },
    {
      fill: "bg-violet-200",
      highlight: "bg-violet-100/80",
    },
    {
      fill: "bg-orange-200",
      highlight: "bg-orange-100/80",
    },
    {
      fill: "bg-amber-200",
      highlight: "bg-amber-100/80",
    },
    {
      fill: "bg-slate-300",
      highlight: "bg-slate-100/80",
    },
  ];

  return (
    <section
      id="booking-results"
      className="mt-6 scroll-mt-24 overflow-hidden rounded-[28px] bg-white shadow-sm ring-1 ring-slate-200/70"
    >
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/80 px-6 py-5">
        <h2 className="text-lg font-semibold text-slate-900">Booking results</h2>

        <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-100/80 p-1">
          <Link
            href={tableHref}
            aria-pressed={currentView === "table"}
            className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition ${
              currentView === "table"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Table
          </Link>
          <Link
            href={chartHref}
            aria-pressed={currentView === "chart"}
            className={`inline-flex h-8 items-center rounded-full px-3.5 text-sm font-medium transition ${
              currentView === "chart"
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Chart
          </Link>
        </div>
      </div>

      {currentView === "table" ? (
        hasRows ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50/80">
                <tr>
                  {sortColumns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-6 py-4 text-xs font-semibold uppercase tracking-wide text-slate-500 ${
                        column.align === "right" ? "text-right" : "text-left"
                      }`}
                    >
                      <Link
                        href={column.href}
                        className={`inline-flex items-center gap-1.5 rounded-full transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 ${
                          column.active ? "text-slate-900" : ""
                        } ${column.align === "right" ? "justify-end" : ""}`}
                      >
                        <span>{column.label}</span>
                        <span
                          aria-hidden="true"
                          className={`text-[11px] leading-none ${
                            column.active ? "text-slate-700" : "text-slate-400"
                          }`}
                        >
                          {column.active ? (column.direction === "asc" ? "↑" : "↓") : "↕"}
                        </span>
                      </Link>
                    </th>
                  ))}
                  <th className="px-6 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    <span className="sr-only">Open booking</span>
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200 bg-white">
                {rows.map((row) => (
                  <tr key={row.id} className="group hover:bg-slate-50 transition">
                    <td className="px-6 py-4 text-sm font-semibold text-slate-900">
                      {row.customerName}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.customerZip}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.customerCity}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.deliveryDate}</td>
                    <td className="px-6 py-4 text-sm text-slate-700">{row.pickupDate}</td>
                    <td className="px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.statusTone}`}
                      >
                        {row.statusLabel}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-semibold text-slate-900">
                      {row.priceLabel}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Link
                        href={row.detailHref}
                        aria-label={`Open booking for ${row.customerName}`}
                        className="inline-flex items-center justify-center rounded-full p-2 text-slate-500 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-900 hover:text-slate-900 focus-visible:translate-x-0.5 focus-visible:scale-110 focus-visible:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="px-6 py-12 text-sm text-slate-500">
            No bookings matched the current filters.
          </div>
        )
      ) : hasRows ? (
        <div className="space-y-6 px-6 py-6">
          <div className="flex items-center justify-end">
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 p-1">
              {granularityOptions.map((option) => (
                <Link
                  key={option.key}
                  href={option.href}
                  className={`inline-flex h-8 items-center rounded-full px-3 text-sm font-medium transition ${
                    currentGranularity === option.key
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {option.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {[
              { label: "Total value", value: totalValueLabel },
              { label: "Bookings", value: bookingsLabel },
              { label: "Average booking value", value: averageValueLabel },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-slate-200 bg-slate-50/80 px-4 py-3"
              >
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                  {stat.label}
                </div>
                <div className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-white px-4 py-5">
            <div className="mb-5 flex items-center justify-between gap-4">
              <div className="text-sm font-medium text-slate-600">Revenue over time</div>
              <div className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
                {bucketLabel}
              </div>
            </div>

            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
              <div className="flex h-72 flex-col justify-between pb-7 text-xs text-slate-400">
                {chartTicks.map((tick, index) => (
                  <span key={`${tick}-${index}`}>
                    {maxValue > 0 ? `$${Math.round((maxValue * tick) / 100) * 100}` : tick === 0 ? "$0" : ""}
                  </span>
                ))}
              </div>

              <div className="relative">
                <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
                  {chartTicks.map((tick, index) => (
                    <div key={`${tick}-${index}`} className="border-t border-dashed border-slate-200" />
                  ))}
                </div>

                <div className="relative flex h-72 items-stretch gap-2 overflow-x-auto pt-2">
                  {chartPoints.map((point, index) => {
                    const height = maxValue > 0 ? Math.max((point.value / maxValue) * 100, 3) : 0;
                    const palette =
                      barPalettes[
                        Math.floor((index / Math.max(chartPoints.length - 1, 1)) * (barPalettes.length - 1))
                      ];

                    return (
                      <div
                        key={point.key}
                        className="flex h-full min-w-[52px] flex-1 flex-col items-center"
                      >
                        <div className="group relative flex min-h-0 flex-1 w-full items-end justify-center">
                          <div
                            className="relative w-full transition"
                            style={{ height: `${height}%` }}
                            aria-hidden="true"
                          >
                            <div
                              className={`absolute inset-0 rounded-t-[12px] ${palette.fill} shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(15,23,42,0.03)] transition`}
                            />
                            <div
                              className={`absolute left-[8%] right-[8%] top-[2px] h-px rounded-full ${palette.highlight}`}
                            />
                          </div>
                          <div className="pointer-events-none absolute bottom-full mb-2 rounded-xl bg-slate-900 px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                            <div>{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(point.value)}</div>
                            <div className="text-[11px] text-slate-300">
                              {point.bookings} {point.bookings === 1 ? "booking" : "bookings"}
                            </div>
                          </div>
                        </div>
                        <div
                          className="pt-2 text-center text-xs font-medium text-slate-500"
                          title={point.fullLabel}
                        >
                          {point.label}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="px-6 py-12 text-sm text-slate-500">
          No bookings match the current filters.
        </div>
      )}
    </section>
  );
}
