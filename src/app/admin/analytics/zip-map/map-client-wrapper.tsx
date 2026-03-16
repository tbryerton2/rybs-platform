"use client";

import dynamic from "next/dynamic";

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

const ZipMapClient = dynamic(() => import("./map-client"), {
  ssr: false,
});

export default function ZipMapClientWrapper({
  rows,
}: {
  rows: MapZipRow[];
}) {
  return <ZipMapClient rows={rows} />;
}