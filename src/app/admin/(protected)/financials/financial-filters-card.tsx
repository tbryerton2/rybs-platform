"use client";

import {
  AdjustmentsHorizontalIcon,
  ArrowDownTrayIcon,
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
  currentGranularity: "daily" | "weekly" | "monthly" | "annual";
  customActive: boolean;
  exportHref: string;
  quickRanges: QuickRange[];
  presetRanges: Array<{ key: string; start?: string; end?: string }>;
  advancedDefaultOpen: boolean;
};

export function FinancialFiltersCard({
  preset,
  startDate,
  endDate,
  currentGranularity,
  customActive,
  exportHref,
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
      className="mt-8 scroll-mt-32 rounded-[20px] bg-white px-6 py-4 shadow-sm ring-1 ring-slate-200/70"
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
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                    customActive
                      ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  Custom range
                </button>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <a
                href={exportHref}
                download
                className="admin-btn admin-btn-primary admin-btn-sm h-8 gap-1.5 px-3"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                <span>Export CSV</span>
              </a>

              <button
                type="button"
                onClick={() => setExpanded(false)}
                aria-expanded={expanded}
                className="admin-btn admin-btn-secondary admin-btn-sm h-8 shrink-0 gap-1 px-2"
              >
                <span>Less</span>
                <ChevronDownIcon
                  className="h-4 w-4 rotate-180 transition-transform duration-200"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex w-full flex-wrap items-center gap-x-6 gap-y-3">
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
                <button
                  type="button"
                  onClick={() => setExpanded(true)}
                  className={`inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-medium transition ${
                    customActive
                      ? "bg-[#F97316] text-white shadow-sm shadow-orange-100/80"
                      : "border border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-white"
                  }`}
                >
                  Custom range
                </button>
              </div>
            </div>

            <div className="ml-auto flex shrink-0 items-center gap-2">
              <a
                href={exportHref}
                download
                className="admin-btn admin-btn-primary admin-btn-sm h-8 gap-1.5 px-3"
              >
                <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
                <span>Export CSV</span>
              </a>

              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-expanded={false}
                className="admin-btn admin-btn-secondary admin-btn-sm h-8 shrink-0 gap-1 px-2"
              >
                <span>Dates</span>
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
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
                className="grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
              >
                <input type="hidden" name="preset" value={customActive ? "custom" : preset} />
                <input type="hidden" name="granularity" value={currentGranularity} />

                <label className="block">
                  <span className="mb-2 block text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Start date
                  </span>
                  <input
                    type="date"
                    name="start"
                    defaultValue={startDate}
                    className="h-11 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
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
                    className="h-11 w-full rounded-[14px] border border-slate-200 bg-white px-4 text-sm text-slate-900 shadow-sm outline-none transition focus:border-[#F97316]/40 focus:ring-4 focus:ring-[#F97316]/10"
                  />
                </label>

                <div className="flex items-end gap-2.5 xl:justify-end">
                  <button
                    type="submit"
                    className="admin-btn admin-btn-primary h-11 px-4.5 font-medium"
                  >
                    Apply filters
                  </button>

                  <Link
                    href={`/admin/financials?granularity=${currentGranularity}#filters`}
                    className="admin-btn admin-btn-secondary h-11 px-3.5 font-medium"
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
