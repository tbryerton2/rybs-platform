export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import ZipMapClientWrapper from "./map-client-wrapper";

type SearchParams = {
  range?: string;
};

type ZipSettingRow = {
  id: string;
  zip: string | null;
  town: string | null;
  county: string | null;
  active: boolean | null;
  price_14_yard_override: number | null;
  latitude: number | string | null;
  longitude: number | string | null;
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
  id: string;
  zip: string;
  town: string | null;
  county: string | null;
  active: boolean | null;
  pricingMode: "default" | "custom";
  latitude: number;
  longitude: number;
  bookingCount: number;
  revenue: number;
  avgBookingValue: number;
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

function currency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
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

function asNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function RangeTabs({ activeRange }: { activeRange: string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGE_OPTIONS.map((option) => {
        const active = option.key === activeRange;
        return (
          <Link
            key={option.key}
            href={`/admin/analytics/zip-map?range=${option.key}`}
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


function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="text-sm font-medium text-slate-500">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{value}</div>
      {hint ? <div className="mt-2 text-sm text-slate-500">{hint}</div> : null}
    </div>
  );
}

function AnalyticsViewTabs({ active }: { active: "heat" | "map" }) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      <Link
        href="/admin/analytics/zip-heatmap"
        className={[
          "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
          active === "heat"
            ? "bg-[#F97316] text-white shadow-sm"
            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
        ].join(" ")}
      >
        Heat Table
      </Link>

      <Link
        href="/admin/analytics/zip-map"
        className={[
          "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
          active === "map"
            ? "bg-[#F97316] text-white shadow-sm"
            : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50",
        ].join(" ")}
      >
        Map View
      </Link>
    </div>
  );
}

export default async function ZipMapPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const selectedRange = getRangeMeta(searchParams?.range);
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
        .select(
          "id, zip, town, county, active, price_14_yard_override, latitude, longitude"
        )
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
    current.revenue += (booking.total_price_cents ?? 0) / 100;
    bookingsByZip.set(zip, current);
  }

  const mapRows: MapZipRow[] = zipRows
    .map((row) => {
      const zip = normalizeZip(row.zip);
      const latitude = asNumber(row.latitude);
      const longitude = asNumber(row.longitude);

      if (!zip || latitude == null || longitude == null) return null;

      const agg = bookingsByZip.get(zip) ?? { bookingCount: 0, revenue: 0 };

      return {
        id: row.id,
        zip,
        town: row.town ?? null,
        county: row.county ?? null,
        active: row.active ?? null,
        pricingMode: row.price_14_yard_override != null ? "custom" : "default",
        latitude,
        longitude,
        bookingCount: agg.bookingCount,
        revenue: agg.revenue,
        avgBookingValue:
          agg.bookingCount > 0 ? agg.revenue / agg.bookingCount : 0,
      };
    })
    .filter((row): row is MapZipRow => row !== null);

    const zipsMissingCoordinates = zipRows.filter((row) => {
    const zip = normalizeZip(row.zip);
    const latitude = asNumber(row.latitude);
    const longitude = asNumber(row.longitude);

    return !!zip && (latitude == null || longitude == null);
    }).length;

  const totalBookings = mapRows.reduce((sum, row) => sum + row.bookingCount, 0);
  const totalRevenue = mapRows.reduce((sum, row) => sum + row.revenue, 0);
  const zipsOnMap = mapRows.length;
  const activeZipsOnMap = mapRows.filter((row) => row.active === true).length;

  const topZip =
    [...mapRows]
      .sort((a, b) => b.bookingCount - a.bookingCount || b.revenue - a.revenue)
      .find((row) => row.bookingCount > 0) ?? null;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 pb-16 pt-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
                <h1 className="text-[34px] font-semibold tracking-tight text-slate-900">ZIP Heat Map</h1>
                <p className="mt-2 text-base text-slate-600">
                    See which ZIP codes drive bookings and revenue.
                </p>
                <AnalyticsViewTabs active="heat" />
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
                Filter ZIP map activity by booking created date.
              </p>
            </div>

            <RangeTabs activeRange={selectedRange.key} />
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard
            label="Total bookings"
            value={number(totalBookings)}
            hint="Mapped ZIPs in selected period"
          />
          <StatCard
            label="Total revenue"
            value={currency(totalRevenue)}
            hint="From ZIPs with coordinates"
          />
          <StatCard
            label="ZIPs on map"
            value={number(zipsOnMap)}
            hint="ZIPs with latitude/longitude"
          />
          <StatCard
            label="ZIPs missing coordinates"
            value={number(zipsMissingCoordinates)}
            hint="These ZIPs cannot appear on the map yet"
          />
          <StatCard
            label="Top ZIP by bookings"
            value={topZip ? topZip.zip : "—"}
            hint={topZip ? `${number(topZip.bookingCount)} bookings` : "No bookings in range"}
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">ZIP activity map</h2>
              <p className="mt-1 text-sm text-slate-500">
                Circle size reflects bookings. Color intensity reflects revenue.
              </p>
            </div>

            <div className="h-[560px] lg:h-[620px]">
              <ZipMapClientWrapper rows={mapRows} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">How to read the map</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <p>
                  Larger circles mean more bookings in that ZIP during the selected period.
                </p>
                <p>
                  Darker circles indicate stronger revenue production.
                </p>
                <p>
                  Click any circle to see ZIP details, pricing mode, and average booking value.
                </p>
              </div>
            </div>

            <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">Next step</h2>
              <p className="mt-3 text-sm text-slate-600">
                Once coordinates are populated for all service ZIPs, this can evolve into a true
                filled-area ZIP heat map.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}