"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { ClickableTableRow } from "@/app/admin/analytics/zip-heatmap/clickable-table-row";
import { EmptyState } from "./empty-state";

type ServiceZipRow = {
  id: number;
  zip: string;
  active: boolean;
  county: string | null;
  town: string | null;
  price_14_yard_override: number | null;
};

function StatusBadge({ active }: { active: boolean }) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 ring-1 ring-inset ring-emerald-200">
      Enabled
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 ring-1 ring-inset ring-slate-200">
      Disabled
    </span>
  );
}

function PricingBadge({
  priceOverride,
}: {
  priceOverride: number | null;
}) {
  if (priceOverride == null) {
    return <span className="text-sm text-slate-500">Default</span>;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700 ring-1 ring-inset ring-amber-200">
      Override: ${priceOverride}
    </span>
  );
}

type StatusFilter = "all" | "enabled" | "disabled";

export function ZipList({ rows }: { rows: ServiceZipRow[] }) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      if (statusFilter === "enabled" && !row.active) return false;
      if (statusFilter === "disabled" && row.active) return false;
      if (!q) return true;
      const haystack = [
        row.zip,
        row.town ?? "",
        row.county ?? "",
        row.active ? "enabled active" : "disabled inactive",
        row.price_14_yard_override != null ? String(row.price_14_yard_override) : "default",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, statusFilter]);

  const filterOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: "all", label: "All" },
    { value: "enabled", label: "Enabled" },
    { value: "disabled", label: "Disabled" },
  ];

  return (
    <div className="mt-8 rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start lg:gap-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ZIP codes</h2>
            <p className="mt-1 text-sm text-slate-500">
              {filteredRows.length} of {rows.length} ZIPs shown
            </p>
          </div>

          <div className="w-full min-w-0 max-w-[35rem] lg:justify-self-end">
            <div className="grid gap-4 sm:grid-cols-[19rem_max-content] sm:items-start sm:justify-end sm:gap-3">
              <div className="min-w-0">
                <label
                  htmlFor="zip-search"
                  className="mb-2 block text-sm font-medium text-slate-700"
                >
                  Search ZIP codes
                </label>
                <input
                  id="zip-search"
                  type="text"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search ZIP, town, county..."
                  className="w-full rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
                />
              </div>

              <div className="sm:w-fit">
                <div className="mb-2 text-sm font-medium text-slate-700">Status</div>
                <div className="inline-flex flex-nowrap gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 p-1 whitespace-nowrap">
                  {filterOptions.map((option) => {
                    const isActive = statusFilter === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={isActive}
                        onClick={() => setStatusFilter(option.value)}
                        className={[
                          "inline-flex min-w-[80px] items-center justify-center rounded-xl px-2.5 py-2 text-sm font-medium transition",
                          isActive
                            ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                            : "text-slate-600 hover:bg-white hover:text-slate-900",
                        ].join(" ")}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {filteredRows.length === 0 ? (
        <div className="p-6">
          {rows.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center">
              <div className="text-base font-semibold text-slate-900">No matching ZIP codes</div>
              <div className="mt-2 text-sm text-slate-500">
                Try a different ZIP, town, or county search, or change the status filter.
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="hidden md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th className="px-6 py-4">ZIP code</th>
                  <th className="px-6 py-4">Town</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Pricing</th>
                  <th className="px-6 py-4 text-right">
                    <span className="sr-only">Open details</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filteredRows.map((row) => (
                  <ClickableTableRow
                    key={row.id}
                    href={`/admin/settings/zips/${row.id}`}
                    ariaLabel={`Open ZIP ${row.zip} details`}
                    className="group cursor-pointer transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-inset"
                  >
                    <td className="px-6 py-4 align-top">
                      <div className="text-sm font-semibold text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
                        {row.zip}
                      </div>
                    </td>

                    <td className="px-6 py-4 align-top">
                      <div className="text-sm font-medium text-slate-900">{row.town ?? "—"}</div>
                      <div className="mt-1 text-sm text-slate-500">{row.county ?? "—"}</div>
                    </td>

                    <td className="px-6 py-4 align-top">
                      <StatusBadge active={row.active} />
                    </td>

                    <td className="px-6 py-4 align-top">
                      <PricingBadge priceOverride={row.price_14_yard_override} />
                    </td>

                    <td className="px-6 py-4 align-middle text-right">
                      <span
                        aria-hidden="true"
                        className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                      >
                        <ChevronRightIcon className="h-6 w-6" />
                      </span>
                    </td>
                  </ClickableTableRow>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 md:hidden">
            {filteredRows.map((row) => (
              <Link
                key={row.id}
                href={`/admin/settings/zips/${row.id}`}
                className="group flex items-start justify-between gap-4 p-5 transition hover:bg-slate-50 focus-visible:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-inset"
              >
                <div className="min-w-0">
                  <div className="text-base font-semibold text-slate-900 transition group-hover:text-slate-950 group-focus-visible:text-slate-950">
                    {row.zip}
                  </div>

                  <div className="mt-2">
                    <div className="text-sm font-medium text-slate-900">
                      {row.town ?? "—"}
                    </div>
                    <div className="mt-1 text-sm text-slate-500">
                      {row.county ?? "County unavailable"}
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusBadge active={row.active} />
                    <PricingBadge priceOverride={row.price_14_yard_override} />
                  </div>
                </div>

                <span
                  aria-hidden="true"
                  className="mt-1 inline-flex shrink-0 items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                >
                  <ChevronRightIcon className="h-6 w-6" />
                </span>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
