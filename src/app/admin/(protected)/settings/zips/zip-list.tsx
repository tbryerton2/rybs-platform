"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  CheckCircleIcon,
  MagnifyingGlassIcon,
  MapPinIcon,
  NoSymbolIcon,
} from "@heroicons/react/24/outline";
import { ChevronRightIcon } from "@heroicons/react/24/solid";
import { ClickableTableRow } from "@/app/admin/(protected)/analytics/zip-heatmap/clickable-table-row";
import { adminSummaryCardShell } from "@/app/admin/_components/AdminSummaryCard";
import { EmptyState } from "./empty-state";

type ServiceZipRow = {
  id: number;
  zip: string;
  active: boolean;
  county: string | null;
  town: string | null;
  state: string | null;
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

type ZipFilter = "all" | "active" | "disabled";

function SummaryCard({
  label,
  value,
  tone,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  value: number;
  tone: "blue" | "green" | "amber";
  icon: typeof MapPinIcon;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={[
        tone === "green"
          ? "h-full w-full rounded-[14px] border border-slate-200 bg-white p-5 text-left shadow-sm ring-1 transition duration-200 ease-out"
          : adminSummaryCardShell(
              tone,
              "h-full w-full p-5 text-left ring-1 transition duration-200 ease-out",
            ),
        "cursor-pointer hover:-translate-y-0.5 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300",
        active
          ? tone === "blue"
            ? "ring-sky-300/90 shadow-[0_0_0_1px_rgba(125,211,252,0.5)] shadow-md"
            : tone === "green"
              ? "ring-slate-300/90 shadow-[0_0_0_1px_rgba(203,213,225,0.55)] shadow-md"
              : "ring-amber-300/90 shadow-[0_0_0_1px_rgba(252,211,77,0.4)] shadow-md"
          : "ring-white/50 hover:ring-slate-200/80",
      ].join(" ")}
    >
      <div className="flex gap-4">
        <span
          className={[
            "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/65 ring-1 ring-inset transition",
            tone === "blue"
              ? "bg-sky-100/95 text-sky-700 ring-sky-200/90"
              : tone === "green"
                ? "bg-slate-100/95 text-slate-600 ring-slate-200/90"
                : "bg-amber-100/95 text-amber-700 ring-amber-200/90",
            active ? "scale-[1.02]" : "",
          ].join(" ")}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">
            {label}
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">
            {value}
          </div>
        </div>
      </div>
    </button>
  );
}

export function ZipList({ rows }: { rows: ServiceZipRow[] }) {
  const [query, setQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<ZipFilter>("active");

  const totalCount = rows.length;
  const activeCount = rows.filter((row) => row.active).length;
  const disabledCount = totalCount - activeCount;
  const includeDisabled = selectedFilter !== "active";

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    return rows.filter((row) => {
      if (selectedFilter === "active" && !row.active) return false;
      if (selectedFilter === "disabled" && row.active) return false;
      if (!q) return true;

      const haystack = [
        row.zip,
        row.town ?? "",
        row.county ?? "",
        row.state ?? "",
        row.active ? "enabled active" : "disabled inactive",
        row.price_14_yard_override != null ? String(row.price_14_yard_override) : "default",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query, selectedFilter]);

  return (
    <div className="mt-8 space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Total ZIP codes"
          value={totalCount}
          tone="blue"
          icon={MapPinIcon}
          active={selectedFilter === "all"}
          onClick={() => setSelectedFilter("all")}
        />
        <SummaryCard
          label="Active ZIP codes"
          value={activeCount}
          tone="green"
          icon={CheckCircleIcon}
          active={selectedFilter === "active"}
          onClick={() => setSelectedFilter("active")}
        />
        <SummaryCard
          label="Disabled ZIP codes"
          value={disabledCount}
          tone="amber"
          icon={NoSymbolIcon}
          active={selectedFilter === "disabled"}
          onClick={() => setSelectedFilter("disabled")}
        />
      </section>

      <section className="rounded-[20px] bg-white px-6 pb-6 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-8 sm:pt-6">
        <div>
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">
            Search Zip Codes
          </h2>
        </div>

        <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative block flex-1">
            <span className="sr-only">Search ZIP codes</span>
            <MagnifyingGlassIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              id="zip-search"
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ZIP, town, or county"
              className="h-12 w-full rounded-[14px] border border-slate-300 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-[#F97316]"
            />
          </label>

          <label className="inline-flex h-12 items-center gap-3 rounded-[14px] border border-slate-200 bg-slate-50 px-4 text-sm font-medium text-slate-700 transition">
            <input
              type="checkbox"
              checked={includeDisabled}
              onChange={(event) =>
                setSelectedFilter(event.target.checked ? "all" : "active")
              }
              className="h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
            />
            Include disabled
          </label>
        </div>
      </section>

      <section className="overflow-hidden rounded-[20px] bg-white shadow-xl ring-1 ring-slate-200/70">
        <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-slate-900">
              ZIP codes
            </h2>
            <p className="text-sm text-slate-500">
              {filteredRows.length} of {rows.length} ZIPs shown
            </p>
          </div>
        </div>

        {filteredRows.length === 0 ? (
          <div className="p-6">
            {rows.length === 0 ? (
              <EmptyState />
            ) : (
              <div className="rounded-[14px] border border-dashed border-slate-300 bg-white p-10 text-center">
                <div className="text-base font-semibold text-slate-900">No matching ZIP codes</div>
                <div className="mt-2 text-sm text-slate-500">
                  Try a different ZIP, town, or county search, or include disabled ZIP codes.
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
                    <th className="px-6 py-4">State</th>
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
                        <div className="text-sm font-medium text-slate-900">{row.state ?? "—"}</div>
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
                        {[row.county ?? "County unavailable", row.state].filter(Boolean).join(" • ")}
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
      </section>
    </div>
  );
}
