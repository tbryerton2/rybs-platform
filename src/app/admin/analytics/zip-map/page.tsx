export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { CubeIcon, CurrencyDollarIcon, FireIcon, MapPinIcon, TrophyIcon } from "@heroicons/react/24/solid";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { centsToDollars, formatUsd } from "@/lib/money";
import ZipMapClientWrapper from "./map-client-wrapper";
import { ZipAnalyticsStatCard } from "../zip-analytics-stat-card";
import { ZipAnalyticsViewTabs } from "../zip-analytics-view-tabs";

type SearchParams = {
  range?: string;
  metric?: string;
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
};

type MapZipRow = {
  id: string | null;
  zip: string;
  town: string | null;
  county: string | null;
  active: boolean | null;
  pricingMode: "default" | "custom";
  bookingCount: number;
  revenue: number;
  avgBookingValue: number;
};

type MetricKey = "bookings" | "revenue" | "avg";

const RANGE_OPTIONS = [
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "90d", label: "Last 90 days", days: 90 },
  { key: "all", label: "All time", days: null },
] as const;

const METRIC_OPTIONS: Array<{ key: MetricKey; label: string }> = [
  { key: "bookings", label: "Bookings" },
  { key: "revenue", label: "Revenue" },
  { key: "avg", label: "Avg booking" },
];

function getRangeMeta(range: string | undefined) {
  return RANGE_OPTIONS.find((option) => option.key === range) ?? RANGE_OPTIONS[1];
}

function getMetric(metric: string | undefined): MetricKey {
  if (metric === "revenue" || metric === "avg") return metric;
  return "bookings";
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

function normalizeZip(value: string | null | undefined) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 5);
}

function RangeTabs({
  activeRange,
  metric,
}: {
  activeRange: string;
  metric: MetricKey;
}) {
  return (
    <div className="flex flex-wrap justify-start gap-2 lg:justify-end">
      {RANGE_OPTIONS.map((option) => {
        const active = option.key === activeRange;
        return (
          <Link
            key={option.key}
            href={`/admin/analytics/zip-map?range=${option.key}&metric=${metric}`}
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

function MetricTabs({
  activeMetric,
  range,
}: {
  activeMetric: MetricKey;
  range: string;
}) {
  return (
    <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-1">
      {METRIC_OPTIONS.map((option) => {
        const active = option.key === activeMetric;
        return (
          <Link
            key={option.key}
            href={`/admin/analytics/zip-map?range=${encodeURIComponent(range)}&metric=${option.key}#zip-map`}
            scroll={false}
            className={[
              "inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition",
              active
                ? "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {option.label}
          </Link>
        );
      })}
    </div>
  );
}


export default async function ZipMapPage({
  searchParams,
}: {
  searchParams: SearchParams | Promise<SearchParams>;
}) {
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const selectedRange = getRangeMeta(resolvedSearchParams?.range);
  const selectedMetric = getMetric(resolvedSearchParams?.metric);
  const startDateISO = startDateFromDays(selectedRange.days);

  let bookingsQuery = supabaseAdmin
    .from("bookings")
    .select("id, created_at, customer_zip, customer_city, status, total_price_cents")
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

  const bookingsByZip = new Map<
    string,
    { bookingCount: number; revenue: number }
  >();

  for (const booking of bookingRows) {
    const zip = normalizeZip(booking.customer_zip);
    if (!zip) continue;

    const current = bookingsByZip.get(zip) ?? { bookingCount: 0, revenue: 0 };
    current.bookingCount += 1;
    current.revenue += centsToDollars(booking.total_price_cents) ?? 0;
    bookingsByZip.set(zip, current);
  }

  const mapRows: MapZipRow[] = zipRows
    .map((row) => {
      const zip = normalizeZip(row.zip);
      if (!zip) return null;

      const agg = bookingsByZip.get(zip) ?? { bookingCount: 0, revenue: 0 };

      return {
        id: row.id,
        zip,
        town: row.town ?? null,
        county: row.county ?? null,
        active: row.active ?? null,
        pricingMode: row.price_14_yard_override != null ? "custom" : "default",
        bookingCount: agg.bookingCount,
        revenue: agg.revenue,
        avgBookingValue:
          agg.bookingCount > 0 ? agg.revenue / agg.bookingCount : 0,
      };
    })
    .filter((row): row is MapZipRow => row !== null);

  const totalBookings = mapRows.reduce((sum, row) => sum + row.bookingCount, 0);
  const totalRevenue = mapRows.reduce((sum, row) => sum + row.revenue, 0);
  const zipsOnMap = mapRows.length;
  const activeZipsOnMap = mapRows.filter((row) => row.active === true).length;

  const topZip =
    [...mapRows]
      .sort((a, b) => b.bookingCount - a.bookingCount || b.revenue - a.revenue)
      .find((row) => row.bookingCount > 0) ?? null;

  return (
    <AdminPage width="wide" className="space-y-6">
      <AdminPageHeader
        title="ZIP Heatmap"
        description="Compare ZIP performance across bookings, revenue, and service coverage."
        className="mb-0"
        actions={
          <div className="pt-2 lg:pt-0">
            <ZipAnalyticsViewTabs active="map" />
          </div>
        }
      />

      <section className="-mt-3">
        <div className="flex flex-col gap-2 lg:items-end">
          <RangeTabs activeRange={selectedRange.key} metric={selectedMetric} />
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
            hint="Mapped ZIP bookings"
            icon={CubeIcon}
            accent="orange"
          />
          <ZipAnalyticsStatCard
            label="Total revenue"
            value={formatUsd(totalRevenue, { maximumFractionDigits: 0 })}
            hint="Mapped ZIP booking totals"
            icon={CurrencyDollarIcon}
            accent="emerald"
          />
          <ZipAnalyticsStatCard
            label="ZIPs on map"
            value={number(zipsOnMap)}
            hint="Service ZIPs eligible for polygon matching"
            icon={MapPinIcon}
            accent="slate"
          />
          <ZipAnalyticsStatCard
            label="Active ZIPs"
            value={number(activeZipsOnMap)}
            hint="Currently bookable ZIPs in service settings"
            icon={FireIcon}
            accent="orange"
          />
          <ZipAnalyticsStatCard
            label="Top ZIP by bookings"
            value={topZip ? topZip.zip : "—"}
            hint={topZip ? `${number(topZip.bookingCount)} bookings` : "No bookings in range"}
            icon={TrophyIcon}
            accent="emerald"
          />
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div
            id="zip-map"
            className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm"
          >
            <div className="border-b border-slate-200 px-6 py-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">ZIP activity map</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    ZIP boundaries are shaded by {selectedMetric === "bookings"
                      ? "booking activity"
                      : selectedMetric === "revenue"
                      ? "revenue"
                      : "average booking value"}.
                  </p>
                  <div className="mt-2 text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                    Shaded by: {selectedMetric === "bookings"
                      ? "Bookings"
                      : selectedMetric === "revenue"
                      ? "Revenue"
                      : "Avg booking"}
                  </div>
                </div>

                <MetricTabs activeMetric={selectedMetric} range={selectedRange.key} />
              </div>
            </div>

            <div className="h-[560px] lg:h-[620px]">
              <ZipMapClientWrapper rows={mapRows} metric={selectedMetric} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">How to read the map</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Darker ZIP areas mean stronger performance in the selected metric.
                </p>
                <p>
                  Hover a ZIP to inspect bookings, revenue, and average booking value.
                </p>
                <p>
                  Click any ZIP area to jump into that ZIP&apos;s admin settings.
                </p>
              </div>
            </div>
          </div>
      </div>
    </AdminPage>
  );
}
