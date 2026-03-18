export const dynamic = "force-dynamic";
export const revalidate = 0;
import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd } from "@/lib/money";
import { ZipAnalyticsStatCard } from "../zip-analytics-stat-card";
import { ZipAnalyticsViewTabs } from "../zip-analytics-view-tabs";
import {
  CubeIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  FireIcon,
  TrophyIcon,
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
  if (level >= 0.85) {
    return "bg-[#F97316]/10";
  }
  if (level >= 0.6) {
    return "bg-orange-50/80";
  }
  if (level >= 0.35) {
    return "bg-amber-50/70";
  }
  if (level > 0) {
    return "bg-slate-50/70";
  }
  return "bg-white";
}

function getIntensityLabel(level: number) {
  if (level >= 0.85) return "Very high";
  if (level >= 0.6) return "High";
  if (level >= 0.35) return "Moderate";
  if (level > 0) return "Low";
  return "No activity";
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
          className="h-full rounded-full bg-emerald-500"
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
          className="h-full rounded-full bg-[#F97316]"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}

function RangeTabs({ activeRange }: { activeRange: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGE_OPTIONS.map((option) => {
        const active = option.key === activeRange;

        return (
          <Link
            key={option.key}
            href={`/admin/analytics/zip-heatmap?range=${option.key}`}
            className={[
              "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
              active
                ? "bg-[#F97316] text-white shadow-sm"
                : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
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
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 text-xs font-semibold text-emerald-700">
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
    <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 text-xs font-semibold text-amber-700">
        Unknown
      </span>
  );
}

function IntensityBadge({ level }: { level: number }) {
  if (level >= 0.85) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-3 text-[11px] font-semibold text-orange-700">
        Very high
      </span>
    );
  }

  if (level >= 0.6) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-amber-200 bg-amber-50 px-3 text-[11px] font-semibold text-amber-700">
        High
      </span>
    );
  }

  if (level >= 0.35) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-yellow-200 bg-yellow-50 px-3 text-[11px] font-semibold text-yellow-700">
        Moderate
      </span>
    );
  }

  if (level > 0) {
    return (
      <span className="inline-flex h-8 w-[92px] items-center justify-center rounded-full border border-sky-200 bg-sky-50 px-3 text-[11px] font-semibold text-sky-700">
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
      <span className="inline-flex min-w-[96px] items-center justify-center rounded-full border border-orange-200 bg-orange-50 px-4 py-2 text-xs font-semibold text-orange-700">
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

function HeatMeter({
  value,
  max,
  tone = "orange",
}: {
  value: number;
  max: number;
  tone?: "orange" | "emerald";
}) {
  const width = max > 0 && value > 0 ? Math.max(10, Math.round((value / max) * 100)) : 0;
  const fillClass = tone === "emerald" ? "bg-emerald-500" : "bg-[#F97316]";

  return (
    <div className="flex w-full items-center gap-3">
      <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${fillClass}`}
          style={{ width: `${width}%` }}
        />
      </div>
      <div className="w-10 shrink-0 text-right text-sm font-semibold text-slate-700">
        {number(value)}
      </div>
    </div>
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
        "group inline-flex items-center justify-center gap-1.5 rounded-md px-1.5 py-1 transition",
        active ? "text-slate-900" : "text-slate-500 hover:text-slate-700",
      ].join(" ")}
    >
      <span className="leading-none">{label}</span>

      <span className="flex flex-col items-center justify-center leading-none">
        <span
          className={[
            "block h-[8px] text-[8px] leading-none",
            active && currentDir === "asc"
              ? "text-slate-700"
              : "text-slate-300 group-hover:text-slate-500"
          ].join(" ")}
        >
          ▲
        </span>
        <span
          className={[
            "-mt-[2px] block h-[8px] text-[8px] leading-none",
            active && currentDir === "desc"
              ? "text-slate-700"
              : "text-slate-300 group-hover:text-slate-500"
          ].join(" ")}
        >
          ▼
        </span>
      </span>
    </Link>
  );
}

export default async function ZipHeatMapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
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
  const bookingRows = (bookings ?? []) as BookingRow[];

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

  const activeZeroBookingZips = rows.filter(
    (row) => row.existsInSettings && row.active === true && row.bookingCount === 0
  );

  const customPricingZips = rows.filter((row) => row.existsInSettings && row.pricingMode === "custom");
  const unsupportedBookingZips = rows.filter((row) => !row.existsInSettings && row.bookingCount > 0);

  const maxBookings = getMaxBookingCount(rows);
  const maxRevenue = getMaxRevenue(rows);

  return (
    <div className="min-h-screen bg-white">
        <div className="mx-auto max-w-7xl px-6 pb-16 pt-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-slate-900">ZIP Analytics</h1>
                <p className="mt-2 text-base text-slate-600">
                    Compare ZIP performance across bookings, revenue, and service coverage.
                </p>
                <ZipAnalyticsViewTabs active="heat" />
                </div>

                <div className="inline-flex items-center rounded-full bg-[#F97316]/10 px-3 py-1.5 text-sm font-semibold text-[#F97316]">
                {selectedRange.label}
                </div>
            </div>

            <div className="mt-8 rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-slate-900">Date range</h2>
                    <p className="mt-1 text-sm text-slate-500">
                    Filter ZIP performance by booking created date.
                    </p>
                </div>

                <RangeTabs activeRange={selectedRange.key} />
                </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                <ZipAnalyticsStatCard
                    label="Total bookings"
                    value={number(totalBookings)}
                    hint="Non-cancelled bookings in selected period"
                    icon={CubeIcon}
                    accent="orange"
                />

                <ZipAnalyticsStatCard
                    label="Total revenue"
                    value={formatUsd(totalRevenue, { maximumFractionDigits: 0 })}
                    hint="Collected from booking totals"
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

            <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm">
                <div className="border-b border-slate-200 px-6 py-5">
                    <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-lg font-semibold text-slate-900">ZIP performance</h2>
                        <p className="mt-1 text-sm text-slate-500">
                        Ranked by booking count. Stronger ZIPs are shaded more heavily.
                        </p>
                    </div>
                    <div className="text-sm text-slate-500">
                        {number(rows.length)} ZIPs shown
                    </div>
                    </div>
                </div>

                <div className="max-h-[900px] overflow-auto">
                    <table className="min-w-full">
                    <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">
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
                        </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-200">
                        {rows.map((row) => {
                        const heatLevel = Math.max(
                            getHeatLevel(row.bookingCount, maxBookings),
                            getHeatLevel(row.revenue, maxRevenue)
                        );

                        const zipCell = row.zipSettingId ? (
                            <Link
                            href={`/admin/settings/zips/${row.zipSettingId}`}
                            className="inline-flex items-center gap-2 text-sm font-semibold text-[#F97316] hover:text-orange-600 hover:underline"
                            >
                            {row.zip}
                            </Link>
                        ) : (
                            <span className="text-sm font-semibold text-slate-900">{row.zip}</span>
                        );

                        return (
                            <tr
                                key={row.zip}
                                className={`${getRowHeatClasses(heatLevel)} transition hover:bg-slate-50`}
                            >
                            <td className="px-6 py-3 align-top">
                                <div>
                                {zipCell}
                                {!row.existsInSettings ? (
                                    <div className="mt-1 text-xs font-medium text-amber-700">
                                    Outside current ZIP settings
                                    </div>
                                ) : null}
                                </div>
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
                                <span className="inline-flex min-w-[64px] items-center justify-center rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 shadow-sm">
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
                          </tr>
                        );
                        })}

                        {rows.length === 0 ? (
                        <tr>
                            <td colSpan={7} className="px-6 py-14 text-center text-sm text-slate-500">
                            No ZIP analytics available for this period.
                            </td>
                        </tr>
                        ) : null}
                    </tbody>
                    </table>
                </div>
                </div>

                <div className="space-y-6">
                <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Key insights</h2>
                    <div className="mt-4 space-y-3">
                    <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Most bookings
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                        {topZipByBookings
                            ? `${topZipByBookings.zip} • ${number(topZipByBookings.bookingCount)} bookings`
                            : "No bookings in this period"}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Highest revenue
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                        {topZipByRevenue
                            ? `${topZipByRevenue.zip} • ${formatUsd(topZipByRevenue.revenue, { maximumFractionDigits: 0 })}`
                            : "No revenue in this period"}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Active ZIPs with zero bookings
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                        {number(activeZeroBookingZips.length)}
                        </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                        Custom pricing ZIPs
                        </div>
                        <div className="mt-1 text-sm font-semibold text-slate-900">
                        {number(customPricingZips.length)}
                        </div>
                    </div>
                    </div>
                </div>

                <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-slate-900">Watch list</h2>

                    <div className="mt-5">
                    <div className="text-sm font-semibold text-slate-900">Active ZIPs with no bookings</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {activeZeroBookingZips.length > 0 ? (
                        activeZeroBookingZips.slice(0, 12).map((row) => (
                            <span
                            key={row.zip}
                            className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200"
                            >
                            {row.zip}
                            </span>
                        ))
                        ) : (
                        <span className="text-sm text-slate-500">None in this period.</span>
                        )}
                    </div>
                    </div>

                    <div className="mt-6">
                    <div className="text-sm font-semibold text-slate-900">ZIPs using custom pricing</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {customPricingZips.length > 0 ? (
                        customPricingZips.slice(0, 12).map((row) => (
                            <span
                            key={row.zip}
                            className="inline-flex items-center rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-orange-700 ring-1 ring-orange-200"
                            >
                            {row.zip}
                            </span>
                        ))
                        ) : (
                        <span className="text-sm text-slate-500">No custom pricing set.</span>
                        )}
                    </div>
                    </div>

                    <div className="mt-6">
                    <div className="text-sm font-semibold text-slate-900">Bookings from unsupported ZIPs</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                        {unsupportedBookingZips.length > 0 ? (
                        unsupportedBookingZips.slice(0, 12).map((row) => (
                            <span
                            key={row.zip}
                            className="inline-flex items-center rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200"
                            >
                            {row.zip}
                            </span>
                        ))
                        ) : (
                        <span className="text-sm text-slate-500">None in this period.</span>
                        )}
                    </div>
                    </div>
                </div>
                </div>
            </div>
        </div>
    </div>
  );
}
