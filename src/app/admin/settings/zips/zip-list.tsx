"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { DeleteZipButton } from "./delete-zip-button";
import { toggleServiceZipAction, deleteServiceZipAction } from "./actions";
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
      Active
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

export function ZipList({ rows }: { rows: ServiceZipRow[] }) {
  const [query, setQuery] = useState("");

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();

    if (!q) return rows;

    return rows.filter((row) => {
      const haystack = [
        row.zip,
        row.town ?? "",
        row.county ?? "",
        row.active ? "active" : "disabled",
        row.price_14_yard_override != null ? String(row.price_14_yard_override) : "default",
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, query]);

  return (
    <div className="mt-8 rounded-[28px] border border-slate-200 bg-white shadow-sm">
      <div className="border-b border-slate-200 px-6 py-5">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">ZIP codes</h2>
            <p className="mt-1 text-sm text-slate-500">
              Active ZIPs can book online. Disabled ZIPs stay on file but cannot book.
            </p>
          </div>

          <div className="w-full md:max-w-xs">
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
                Try a different ZIP, town, or county search.
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
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Pricing</th>
                  <th className="px-6 py-4">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredRows.map((row) => (
                  <tr className="transition hover:bg-slate-50" key={row.id}>
                    <td className="px-6 py-4">
                      <div className="min-w-0">
                        <Link
                          href={`/admin/settings/zips/${row.id}`}
                          className="text-sm font-semibold text-[#F97316] hover:text-orange-600 hover:underline"
                        >
                          {row.zip}
                        </Link>

                        {row.town || row.county ? (
                          <div className="mt-1 text-xs text-slate-500">
                            {[row.town, row.county].filter(Boolean).join(" • ")}
                          </div>
                        ) : null}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <StatusBadge active={row.active} />
                    </td>

                    <td className="px-6 py-4">
                      <PricingBadge priceOverride={row.price_14_yard_override} />
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <form action={toggleServiceZipAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <button
                            type="submit"
                            className="text-sm font-medium text-slate-700 hover:text-slate-900"
                          >
                            {row.active ? "Disable" : "Enable"}
                          </button>
                        </form>

                        <form action={deleteServiceZipAction}>
                          <input type="hidden" name="id" value={row.id} />
                          <DeleteZipButton zip={row.zip} />
                        </form>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="divide-y divide-slate-200 md:hidden">
            {filteredRows.map((row) => (
              <div key={row.id} className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/settings/zips/${row.id}`}
                      className="text-base font-semibold text-[#F97316] hover:text-orange-600 hover:underline"
                    >
                      {row.zip}
                    </Link>

                    {row.town || row.county ? (
                      <div className="mt-1 text-xs text-slate-500">
                        {[row.town, row.county].filter(Boolean).join(" • ")}
                      </div>
                    ) : null}

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge active={row.active} />
                      <PricingBadge priceOverride={row.price_14_yard_override} />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <form action={toggleServiceZipAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button
                        type="submit"
                        className="text-sm font-medium text-slate-700 hover:text-slate-900"
                      >
                        {row.active ? "Disable" : "Enable"}
                      </button>
                    </form>

                    <form action={deleteServiceZipAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <DeleteZipButton zip={row.zip} />
                    </form>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}