"use client";

import {
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
} from "@heroicons/react/24/outline";
import Link from "next/link";
import { FormEvent, useState } from "react";

type QuickRange = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

type FinancialFiltersCardProps = {
  preset: string;
  startDate: string;
  endDate: string;
  zipFilter: string;
  statusScope: string;
  currentView: "table" | "chart";
  currentGranularity: "daily" | "weekly" | "monthly" | "annual";
  zipOptions: string[];
  quickRanges: QuickRange[];
  presetRanges: Array<{ key: string; start?: string; end?: string }>;
  advancedDefaultOpen: boolean;
};

export function FinancialFiltersCard({
  preset,
  startDate,
  endDate,
  zipFilter,
  statusScope,
  currentView,
  currentGranularity,
  zipOptions,
  quickRanges,
  presetRanges,
  advancedDefaultOpen,
}: FinancialFiltersCardProps) {
  const [expanded, setExpanded] = useState(advancedDefaultOpen);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const presetInput = form.elements.namedItem("preset");

    if (!(presetInput instanceof HTMLInputElement)) return;

    const startInput = form.elements.namedItem("start");
    const endInput = form.elements.namedItem("end");
    const start = startInput instanceof HTMLInputElement ? startInput.value : "";
    const end = endInput instanceof HTMLInputElement ? endInput.value : "";

    if (!start && !end) {
      presetInput.value = "all";
      return;
    }

    const matchingPreset = presetRanges.find(
      (range) => (range.start ?? "") === start && (range.end ?? "") === end
    );

    presetInput.value = matchingPreset?.key ?? "";
  }

  return (
    <section
      id="filters"
      className="mt-8 scroll-mt-32 rounded-[28px] bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200/70"
    >
      <div className={expanded ? "flex flex-col gap-5" : ""}>
        {expanded ? (
          <div className="flex w-full flex-wrap items-center gap-x-3 gap-y-2.5">
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-2.5">
              <div className="flex shrink-0 items-center gap-2">
                <AdjustmentsHorizontalIcon
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-slate-900">Filters</h2>
              </div>

              <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                {quickRanges.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                      item.active
                        ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(false)}
              aria-expanded={expanded}
              className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
            >
              <span>Less</span>
              <ChevronDownIcon
                className="h-4 w-4 rotate-180 transition-transform duration-200"
                aria-hidden="true"
              />
            </button>
          </div>
        ) : (
          <div className="flex w-full items-center gap-6">
            <div className="flex min-w-0 flex-1 items-center gap-6">
              <div className="flex shrink-0 items-center gap-2">
                <AdjustmentsHorizontalIcon
                  className="h-4 w-4 shrink-0 text-slate-400"
                  aria-hidden="true"
                />
                <h2 className="text-base font-semibold text-slate-900">Filters</h2>
              </div>

              <div className="flex min-w-0 flex-nowrap items-center gap-2 overflow-x-auto whitespace-nowrap">
                {quickRanges.map((item) => (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                      item.active
                        ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                        : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                    }`}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            </div>

            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded={false}
              className="ml-auto inline-flex h-8 shrink-0 items-center gap-1 rounded-full px-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
            >
              <span>More filters</span>
              <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        )}

        <div
          className={`grid overflow-hidden transition-all duration-300 ease-out ${
            expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="overflow-hidden">
            <div className="border-t border-slate-100 pt-5">
              <form
                method="GET"
                action="/admin/financials#filters"
                onSubmit={handleSubmit}
                className="grid gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.85fr)_minmax(0,0.95fr)_auto]"
              >
                <input type="hidden" name="preset" value={preset} />
                <input type="hidden" name="view" value={currentView} />
                <input type="hidden" name="granularity" value={currentGranularity} />

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Start date
                  </span>
                  <input
                    type="date"
                    name="start"
                    defaultValue={startDate}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    End date
                  </span>
                  <input
                    type="date"
                    name="end"
                    defaultValue={endDate}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    ZIP
                  </span>
                  <select
                    name="zip"
                    defaultValue={zipFilter}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
                  >
                    <option value="">All ZIPs</option>
                    {zipOptions.map((zip) => (
                      <option key={zip} value={zip}>
                        {zip}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Booking type
                  </span>
                  <select
                    name="status"
                    defaultValue={statusScope}
                    className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
                  >
                    <option value="revenue">Completed bookings</option>
                    <option value="all-active">All active bookings</option>
                  </select>
                </label>

                <div className="flex items-end gap-2.5 xl:justify-end">
                  <button
                    type="submit"
                    className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#F97316] px-4.5 text-sm font-medium text-white shadow-sm transition hover:bg-orange-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F97316]/30 focus-visible:ring-offset-2"
                  >
                    Apply filters
                  </button>

                  <Link
                    href={`/admin/financials?view=${currentView}&granularity=${currentGranularity}#filters`}
                    className="inline-flex h-11 items-center justify-center rounded-2xl px-3.5 text-sm font-medium text-slate-500 transition hover:bg-slate-50 hover:text-slate-700"
                  >
                    Reset
                  </Link>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
