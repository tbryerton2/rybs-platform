export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd } from "@/lib/money";
import { ZipAnalyticsStatCard } from "../zip-analytics-stat-card";
import { ZipAnalyticsViewTabs } from "../zip-analytics-view-tabs";
import { ClickableTableRow } from "./clickable-table-row";
import {
  CubeIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  FireIcon,
  TrophyIcon,
  ChevronRightIcon,
} from "@heroicons/react/24/solid";

type SearchParams = {
  range?: string;
  sort?: string;
  dir?: string;
};

type ZipSettingRow = {
  id: string;
  zip: string | null;
  town: string | null;
  county: string | null;
  active: boolean | null;
  price_14_yard_override: number | null;
};

type BookingRow = {
  id: string;
  created_at: string | null;
  customer_zip: string | null;
  customer_city: string | null;
  status: string | null;
  total_price_cents: number | null;
  delivery_date: string | null;
};

type ZipAnalyticsRow = {
  zip: string;
  zipSettingId: string | null;
  town: string | null;
  county: string | null;
  active: boolean | null;
  pricingMode: "default" | "custom";
  bookingCount: number;
  revenue: number;
  avgBookingValue: number;
  existsInSettings: boolean;
};

const RANGE_OPTIONS = [
  { key: "1d", label: "Last 1 day", days: 1 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

function getRangeMeta(range: string | undefined) {
  return RANGE_OPTIONS.find((option) => option.key === range) ?? RANGE_OPTIONS[1];
}

function startDateFromDays(days: number | null) {
  if (!days) return null;

  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function isWithinSelectedRange(
  value: string | null | undefined,
  days: number | null,
  referenceDate: Date
) {
  if (!value) return false;
  if (!days) return true;

  const inputDate = new Date(value);
  if (Number.isNaN(inputDate.getTime())) return false;

  const rangeStart = new Date(referenceDate);
  rangeStart.setDate(rangeStart.getDate() - days);

  return inputDate >= rangeStart && inputDate <= referenceDate;
}

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getSortKey(sort: string | undefined) {
  if (sort === "revenue") return "revenue";
  if (sort === "avg") return "avg";
  return "bookings";
}

function getSortDir(dir: string | undefined) {
  return dir === "asc" ? "asc" : "desc";
}

function sortRows(
  rows: ZipAnalyticsRow[],
  sortKey: "bookings" | "revenue" | "avg",
  sortDir: "asc" | "desc"
) {
  const sorted = [...rows].sort((a, b) => {
    let comparison = 0;

    if (sortKey === "bookings") {
      comparison = a.bookingCount - b.bookingCount;
    } else if (sortKey === "revenue") {
      comparison = a.revenue - b.revenue;
    } else {
      comparison = a.avgBookingValue - b.avgBookingValue;
    }

    if (comparison !== 0) {
      return sortDir === "asc" ? comparison : -comparison;
    }

    if (b.bookingCount !== a.bookingCount) {
      return b.bookingCount - a.bookingCount;
    }

    if (b.revenue !== a.revenue) {
      return b.revenue - a.revenue;
    }

    return a.zip.localeCompare(b.zip);
  });

  return sorted;
}

function nextSortDir(
  currentSort: "bookings" | "revenue" | "avg",
  currentDir: "asc" | "desc",
  clickedSort: "bookings" | "revenue" | "avg"
) {
  if (currentSort !== clickedSort) return "desc";
  return currentDir === "desc" ? "asc" : "desc";
}

function normalizeZip(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 5);
}

function getMaxBookingCount(rows: ZipAnalyticsRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.bookingCount), 0);
}

function getMaxRevenue(rows: ZipAnalyticsRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.revenue), 0);
}

function getHeatLevel(value: number, max: number) {
  if (max <= 0 || value <= 0) return 0;
  return value / max;
}

function getRowHeatClasses(level: number) {
  if (level >= 0.6) {
    return "bg-slate-50/70";
  }
  if (level > 0) {
    return "bg-white";
  }
  return "bg-white";
}

function RevenueCell({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const width =
    max > 0 && value > 0 ? Math.max(10, Math.round((value / max) * 100)) : 0;

  return (
    <div className="flex w-[96px] flex-col items-center">
      <div className="text-[18px] font-semibold leading-none text-slate-900">
        {formatUsd(value, { maximumFractionDigits: 0 })}
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-400"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function BookingCountCell({
  value,
  max,
}: {
  value: number;
  max: number;
}) {
  const width =
    max > 0 && value > 0 ? Math.max(10, Math.round((value / max) * 100)) : 0;

  return (
    <div className="flex w-[96px] flex-col items-center">
      <div className="text-[18px] font-semibold leading-none text-slate-900">
        {number(value)}
      </div>

      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-slate-500"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function RangeTabs({ activeRange }: { activeRange: string }) {
  return (
    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
      {RANGE_OPTIONS.map((option) => {
        const active = option.key === activeRange;

        return (
          <Link
            key={option.key}
            href={`/admin/analytics/zip-heatmap?range=${option.key}`}
            className={[
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-medium transition",
              active
                ? "border border-orange-200 bg-orange-50 text-[#F97316]"
                : "border border-slate-200/80 bg-white/80 text-slate-600 hover:border-slate-300 hover:text-slate-900",
            ].join(" ")}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}

function StatusBadge({ active }: { active: boolean | null }) {
  if (active === true) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-3 text-xs font-semibold text-slate-700">
        Active
      </span>
    );
  }

  if (active === false) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-600">
        Disabled
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3 text-xs font-semibold text-slate-500">
        Unknown
      </span>
  );
}

function IntensityBadge({ level }: { level: number }) {
  if (level >= 0.85) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-3 text-[11px] font-semibold text-slate-700">
        Very high
      </span>
    );
  }

  if (level >= 0.6) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-300 bg-slate-100 px-3 text-[11px] font-semibold text-slate-700">
        High
      </span>
    );
  }

  if (level >= 0.35) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 text-[11px] font-semibold text-slate-600">
        Moderate
      </span>
    );
  }

  if (level > 0) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[11px] font-semibold text-slate-600">
        Low
      </span>
    );
  }

  return (
    <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-3 text-[11px] font-semibold text-slate-600">
      No activity
    </span>
  );
}

function PricingBadge({ mode }: { mode: "default" | "custom" }) {
  if (mode === "custom") {
    return (
      <span className="inline-flex min-w-[96px] items-center justify-center rounded-full border border-slate-300 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-700">
        Custom pricing
      </span>
    );
  }

  return (
    <span className="inline-flex min-w-[96px] items-center justify-center rounded-full border border-slate-200 bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">
        Default
    </span>
  );
}

function SortableHeader({
  label,
  sortKey,
  currentSort,
  currentDir,
  range,
}: {
  label: string;
  sortKey: "bookings" | "revenue" | "avg";
  currentSort: "bookings" | "revenue" | "avg";
  currentDir: "asc" | "desc";
  range: string;
}) {
  const active = currentSort === sortKey;
  const nextDir = nextSortDir(currentSort, currentDir, sortKey);

  return (
    <Link
      href={`/admin/analytics/zip-heatmap?range=${range}&sort=${sortKey}&dir=${nextDir}`}
      className={[
        "inline-flex items-center gap-1.5 rounded-full transition hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2",
        active ? "text-slate-900" : "text-slate-500",
      ].join(" ")}
    >
      <span className="leading-none">{label}</span>
      <span
        aria-hidden="true"
        className={`text-[11px] leading-none ${
          active ? "text-slate-700" : "text-slate-400"
        }`}
      >
        {active ? (currentDir === "asc" ? "↑" : "↓") : "↕"}
      </span>
    </Link>
  );
}

export default async function ZipHeatMapPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const sp = await Promise.resolve(searchParams);
  const now = new Date();
  const selectedRange = getRangeMeta(sp?.range);
  const selectedSort = getSortKey(sp?.sort);
  const selectedDir = getSortDir(sp?.dir);
  const startDateISO = startDateFromDays(selectedRange.days);

  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select(
      "id, created_at, customer_zip, customer_city, status, total_price_cents, delivery_date"
    )
    .neq("status", "cancelled")
    .not("customer_zip", "is", null);

  if (startDateISO) {
    bookingsQuery = bookingsQuery.gte("created_at", startDateISO);
  }

  const [{ data: zipSettings, error: zipError }, { data: bookings, error: bookingsError }] =
    await Promise.all([
      supabaseAdmin
        .from("service_area_zips")
        .select("id, zip, town, county, active, price_14_yard_override")
        .order("zip", { ascending: true }),
      bookingsQuery,
    ]);

  if (zipError) throw new Error(zipError.message);
  if (bookingsError) throw new Error(bookingsError.message);

  const zipRows = (zipSettings ?? []) as ZipSettingRow[];
  const rawBookingRows = (bookings ?? []) as BookingRow[];
  const bookingRows = rawBookingRows.filter((booking) =>
    isWithinSelectedRange(booking.created_at, selectedRange.days, now)
  );

  const settingsByZip = new Map<string, ZipSettingRow>();
  for (const row of zipRows) {
    const zip = normalizeZip(row.zip);
    if (!zip) continue;
    settingsByZip.set(zip, row);
  }

  const analyticsMap = new Map<string, ZipAnalyticsRow>();

  for (const booking of bookingRows) {
    const zip = normalizeZip(booking.customer_zip);
    if (!zip) continue;

    const settings = settingsByZip.get(zip);

    const current =
      analyticsMap.get(zip) ??
      {
        zip,
        zipSettingId: settings?.id ?? null,
        town: settings?.town ?? booking.customer_city ?? null,
        county: settings?.county ?? null,
        active: settings?.active ?? null,
        pricingMode: settings?.price_14_yard_override != null ? "custom" : "default",
        bookingCount: 0,
        revenue: 0,
        avgBookingValue: 0,
        existsInSettings: !!settings,
      };

    current.bookingCount += 1;
    current.revenue += centsToDollars(booking.total_price_cents) ?? 0;

    analyticsMap.set(zip, current);
  }

  for (const zipRow of zipRows) {
    const zip = normalizeZip(zipRow.zip);
    if (!zip) continue;

    if (!analyticsMap.has(zip)) {
      analyticsMap.set(zip, {
        zip,
        zipSettingId: zipRow.id,
        town: zipRow.town ?? null,
        county: zipRow.county ?? null,
        active: zipRow.active ?? null,
        pricingMode: zipRow.price_14_yard_override != null ? "custom" : "default",
        bookingCount: 0,
        revenue: 0,
        avgBookingValue: 0,
        existsInSettings: true,
      });
    }
  }

  const rows = sortRows(
    Array.from(analyticsMap.values()).map((row) => ({
      ...row,
      avgBookingValue: row.bookingCount > 0 ? row.revenue / row.bookingCount : 0,
    })),
    selectedSort,
    selectedDir
  );

  const totalBookings = rows.reduce((sum, row) => sum + row.bookingCount, 0);
  const totalRevenue = rows.reduce((sum, row) => sum + row.revenue, 0);
  const activeZipsWithBookings = rows.filter(
    (row) => row.existsInSettings && row.active === true && row.bookingCount > 0
  ).length;

  const topZipByBookings = rows.find((row) => row.bookingCount > 0) ?? null;
  const topZipByRevenue =
    [...rows].sort((a, b) => b.revenue - a.revenue).find((row) => row.revenue > 0) ?? null;

  const maxBookings = getMaxBookingCount(rows);
  const maxRevenue = getMaxRevenue(rows);

  return (
    <AdminPage width="wide" className="space-y-6">
      <AdminPageHeader
        title="Heatmap"
        description="Compare ZIP performance across bookings, revenue, and service coverage."
        className="mb-0"
        actions={
          <div className="pt-2 lg:pt-0">
            <ZipAnalyticsViewTabs active="heat" />
          </div>
        }
      />

      <section className="-mt-3">
        <div className="flex flex-col gap-2 lg:items-end">
          <RangeTabs activeRange={selectedRange.key} />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold uppercase tracking-[0.16em] text-slate-700">
              Snapshot
            </h2>
          </div>
        </div>

        <div className="grid auto-rows-fr gap-4 md:grid-cols-2 xl:grid-cols-5">
          <ZipAnalyticsStatCard
            label="Total bookings"
            value={number(totalBookings)}
            hint="bookings in selected period"
            icon={CubeIcon}
            accent="orange"
          />

          <ZipAnalyticsStatCard
            label="Total revenue"
            value={formatUsd(totalRevenue, { maximumFractionDigits: 0 })}
            hint="booking totals"
            icon={CurrencyDollarIcon}
            accent="emerald"
          />

          <ZipAnalyticsStatCard
            label="Active ZIPs with bookings"
            value={number(activeZipsWithBookings)}
            hint="Supported ZIPs producing work"
            icon={MapPinIcon}
            accent="slate"
          />

          <ZipAnalyticsStatCard
            label="Top ZIP by bookings"
            value={topZipByBookings ? topZipByBookings.zip : "—"}
            hint={
              topZipByBookings
                ? `${number(topZipByBookings.bookingCount)} bookings`
                : "No bookings in range"
            }
            icon={FireIcon}
            accent="orange"
          />

          <ZipAnalyticsStatCard
            label="Top ZIP by revenue"
            value={topZipByRevenue ? topZipByRevenue.zip : "—"}
            hint={
              topZipByRevenue
                ? formatUsd(topZipByRevenue.revenue, { maximumFractionDigits: 0 })
                : "No revenue in range"
            }
            icon={TrophyIcon}
            accent="emerald"
          />
        </div>
      </section>

      <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">ZIP performance</h2>
                        <p className="mt-1 text-sm text-slate-500">
                        Ranked by booking count. Stronger ZIPs are shaded more heavily.
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                        Click any row to view or edit ZIP details.
                        </p>
                    </div>
                    <div className="text-sm text-slate-500">
                        {number(rows.length)} ZIPs shown
                    </div>
                    </div>
                </div>

                <div className="max-h-[900px] overflow-auto">
                    <table className="min-w-full divide-y divide-slate-200">
                    <thead className="sticky top-0 z-10 bg-slate-50/80 backdrop-blur">
                        <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-6 py-4">ZIP</th>
                        <th className="px-6 py-4">Location</th>
                        <th className="px-6 py-4 text-center">Status</th>
                        <th className="px-6 py-4 text-center">
                          <SortableHeader
                            label="Bookings"
                            sortKey="bookings"
                            currentSort={selectedSort}
                            currentDir={selectedDir}
                            range={selectedRange.key}
                          />
                        </th>
                        <th className="px-6 py-4 text-center">
                          <SortableHeader
                            label="Revenue"
                            sortKey="revenue"
                            currentSort={selectedSort}
                            currentDir={selectedDir}
                            range={selectedRange.key}
                          />
                        </th>
                        <th className="px-6 py-4 text-center">
                          <SortableHeader
                            label="Avg booking"
                            sortKey="avg"
                            currentSort={selectedSort}
                            currentDir={selectedDir}
                            range={selectedRange.key}
                          />
                        </th>
                        <th className="px-6 py-4 text-center">Pricing</th>
                        <th className="px-6 py-4 text-right">
                          <span className="sr-only">Open details</span>
                        </th>
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200 bg-white">
                        {rows.map((row) => {
                        const heatLevel = Math.max(
                            getHeatLevel(row.bookingCount, maxBookings),
                            getHeatLevel(row.revenue, maxRevenue)
                        );

                        const rowHref = row.zipSettingId ? `/admin/settings/zips/${row.zipSettingId}` : null;

                        return (
                            <ClickableTableRow
                                key={row.zip}
                                href={rowHref}
                                ariaLabel={rowHref ? `Open ZIP ${row.zip} details` : undefined}
                                className={[
                                  getRowHeatClasses(heatLevel),
                                  rowHref
                                    ? "group cursor-pointer transition hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-inset"
                                    : "transition hover:bg-slate-50",
                                ].join(" ")}
                            >
                            <td className="px-6 py-3 align-top">
                                <div
                                  className={[
                                    "text-sm font-semibold transition",
                                    rowHref
                                      ? "text-slate-900 group-hover:text-slate-950 group-focus-visible:text-slate-950"
                                      : "text-slate-900",
                                  ].join(" ")}
                                >
                                  {row.zip}
                                </div>
                                {!row.existsInSettings ? (
                                  <div className="mt-1 text-xs font-medium text-slate-500">
                                    Outside current ZIP settings
                                  </div>
                                ) : null}
                            </td>

                            <td className="px-6 py-3 align-top">
                              <div className="text-sm font-medium text-slate-900">{row.town ?? "—"}</div>
                              <div className="mt-1 text-sm text-slate-500">{row.county ?? "—"}</div>
                            </td>

                            <td className="px-6 py-3 align-top text-center">
                              <div className="inline-flex flex-col items-center gap-2">
                                <StatusBadge active={row.active} />
                                <IntensityBadge level={heatLevel} />
                              </div>
                            </td>

                            <td className="px-6 py-3 align-middle text-center">
                              <div className="flex min-h-[74px] items-center justify-center">
                                <BookingCountCell value={row.bookingCount} max={maxBookings} />
                              </div>
                            </td>

                            <td className="px-6 py-3 align-middle text-center">
                              <div className="flex min-h-[74px] items-center justify-center">
                                <RevenueCell value={row.revenue} max={maxRevenue} />
                              </div>
                            </td>

                            <td className="px-6 py-3 align-middle text-center">
                              <div className="flex min-h-[74px] items-center justify-center">
                                <span className="inline-flex min-w-[64px] items-center justify-center rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900">
                                  {row.bookingCount > 0 ? formatUsd(row.avgBookingValue, { maximumFractionDigits: 0 }) : "—"}
                                </span>
                              </div>
                            </td>

                            <td className="px-6 py-3 align-middle text-center">
                              <div className="flex min-h-[74px] items-center justify-center">
                                <div className="inline-flex justify-center">
                                  <PricingBadge mode={row.pricingMode} />
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-3 align-middle text-right">
                              <div className="flex min-h-[74px] items-center justify-end">
                                {rowHref ? (
                                  <span
                                    aria-hidden="true"
                                    className="inline-flex items-center justify-center rounded-full p-2 text-slate-400 transition group-hover:translate-x-0.5 group-hover:scale-110 group-hover:text-slate-700 group-focus-visible:translate-x-0.5 group-focus-visible:scale-110 group-focus-visible:text-slate-700"
                                  >
                                    <ChevronRightIcon className="h-6 w-6" />
                                  </span>
                                ) : (
                                  <span className="text-sm text-slate-400">Unavailable</span>
                                )}
                              </div>
                            </td>
                          </ClickableTableRow>
                        );
                        })}

                        {rows.length === 0 ? (
                        <tr>
                            <td colSpan={8} className="px-6 py-14 text-center text-sm text-slate-500">
                            No ZIP analytics available for this period.
                            </td>
                        </tr>
                        ) : null}
                    </tbody>
                    </table>
                </div>
      </div>
    </AdminPage>
  );
}
