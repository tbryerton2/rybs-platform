"use client";

import dynamic from "next/dynamic";

type MapZipRow = {
  id: string;
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

const ZipMapClient = dynamic(() => import("./map-client"), {
  ssr: false,
});

export default function ZipMapClientWrapper({
  rows,
  metric,
}: {
  rows: MapZipRow[];
  metric: MetricKey;
}) {
  return <ZipMapClient rows={rows} metric={metric} />;
}
