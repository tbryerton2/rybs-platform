"use client";

import Link from "next/link";

type ChartPoint = {
  key: string;
  label: string;
  fullLabel: string;
  value: number;
  bookings: number;
};

type RevenueReportSectionProps = {
  chartPoints: ChartPoint[];
  currentGranularity: "daily" | "weekly" | "monthly" | "annual";
  granularityOptions: Array<{
    key: "daily" | "weekly" | "monthly" | "annual";
    label: string;
    href: string;
  }>;
};

export function RevenueReportSection({
  chartPoints,
  currentGranularity,
  granularityOptions,
}: RevenueReportSectionProps) {
  const maxValue = Math.max(...chartPoints.map((point) => point.value), 0);
  const hasRows = chartPoints.length > 0;
  const chartTicks = maxValue > 0 ? [1, 0.75, 0.5, 0.25, 0] : [1, 0.5, 0];

  return (
    <section
      id="revenue-report"
      className="mt-6 scroll-mt-24 overflow-hidden rounded-[20px] bg-white shadow-sm ring-1 ring-slate-200/70"
    >
      <div className="flex flex-col gap-3 border-b border-slate-200/80 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Revenue over time</h2>

        <div className="inline-flex items-center gap-2 sm:justify-end">
          <span className="text-sm font-medium text-slate-500">Group by:</span>
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
      </div>

      {hasRows ? (
        <div className="px-6 py-6">
          <div className="rounded-[14px] border border-slate-200 bg-white px-4 py-5">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4">
              <div className="flex h-72 flex-col justify-between pb-7 text-xs text-slate-400">
                {chartTicks.map((tick, index) => (
                  <span key={`${tick}-${index}`}>
                    {maxValue > 0
                      ? `$${Math.round((maxValue * tick) / 100) * 100}`
                      : tick === 0
                        ? "$0"
                        : ""}
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
                  {chartPoints.map((point) => {
                    const height = maxValue > 0 ? Math.max((point.value / maxValue) * 100, 3) : 0;

                    return (
                      <div
                        key={point.key}
                        className="flex h-full min-w-[52px] flex-1 flex-col items-center"
                      >
                        <div className="group relative flex min-h-0 w-full flex-1 items-end justify-center">
                          <div
                            className="relative w-full transition"
                            style={{ height: `${height}%` }}
                            aria-hidden="true"
                          >
                            <div
                              className="absolute inset-0 rounded-t-[12px] bg-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.08),inset_0_-1px_0_rgba(15,23,42,0.03)] transition"
                            />
                            <div
                              className="absolute left-[8%] right-[8%] top-[2px] h-px rounded-full bg-emerald-100/80"
                            />
                          </div>
                          <div className="pointer-events-none absolute bottom-full mb-2 rounded-lg bg-slate-900 px-2.5 py-1.5 text-center text-xs font-medium text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                            <div>
                              {new Intl.NumberFormat("en-US", {
                                style: "currency",
                                currency: "USD",
                                maximumFractionDigits: 0,
                              }).format(point.value)}
                            </div>
                            <div className="text-[11px] text-slate-300">
                              {point.bookings} {point.bookings === 1 ? "job" : "jobs"}
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
          No revenue-producing jobs match the current date range.
        </div>
      )}
    </section>
  );
}
