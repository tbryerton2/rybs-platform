"use client";

import "leaflet/dist/leaflet.css";
import { MapContainer, TileLayer, CircleMarker, Popup } from "react-leaflet";

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

function getCenter(rows: MapZipRow[]): [number, number] {
  if (rows.length === 0) return [43.0481, -76.1474];

  const lat = rows.reduce((sum, row) => sum + row.latitude, 0) / rows.length;
  const lng = rows.reduce((sum, row) => sum + row.longitude, 0) / rows.length;

  return [lat, lng];
}

function getMaxBookings(rows: MapZipRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.bookingCount), 0);
}

function getMaxRevenue(rows: MapZipRow[]) {
  return rows.reduce((max, row) => Math.max(max, row.revenue), 0);
}

function radiusFor(row: MapZipRow, maxBookings: number) {
  if (maxBookings <= 0) return 8;
  return 8 + (row.bookingCount / maxBookings) * 18;
}

function colorFor(row: MapZipRow, maxRevenue: number) {
  if (maxRevenue <= 0 || row.revenue <= 0) return "#CBD5E1";

  const intensity = row.revenue / maxRevenue;

  if (intensity >= 0.85) return "#F97316";
  if (intensity >= 0.6) return "#FB923C";
  if (intensity >= 0.35) return "#FDBA74";
  return "#FED7AA";
}

export default function ZipMapClient({ rows }: { rows: MapZipRow[] }) {
  const center = getCenter(rows);
  const maxBookings = getMaxBookings(rows);
  const maxRevenue = getMaxRevenue(rows);

  if (rows.length === 0) {
    return (
        <div className="flex h-full items-center justify-center bg-slate-50 text-center">
        <div className="px-6">
            <div className="text-lg font-semibold text-slate-900">No mapped ZIPs yet</div>
            <p className="mt-2 max-w-md text-sm text-slate-500">
            Add latitude and longitude values to your service ZIPs to display bookings and revenue on the map.
            </p>
        </div>
        </div>
    );
    }

  return (
    <MapContainer
      center={center}
      zoom={9}
      scrollWheelZoom={true}
      className="h-full w-full"
    >
      <TileLayer
        attribution='&copy; OpenStreetMap contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {rows.map((row) => (
        <CircleMarker
          key={row.id}
          center={[row.latitude, row.longitude]}
          radius={radiusFor(row, maxBookings)}
          pathOptions={{
            color: colorFor(row, maxRevenue),
            fillColor: colorFor(row, maxRevenue),
            fillOpacity: 0.65,
            weight: 2,
          }}
        >
          <Popup>
            <div className="min-w-[220px] text-sm text-slate-700">
              <div className="text-base font-semibold text-slate-900">
                {row.zip}
              </div>
              <div className="mt-1">
                {row.town ?? "—"}{row.county ? `, ${row.county}` : ""}
              </div>

              <div className="mt-3 space-y-1">
                <div><strong>Bookings:</strong> {number(row.bookingCount)}</div>
                <div><strong>Revenue:</strong> {currency(row.revenue)}</div>
                <div><strong>Avg booking:</strong> {row.bookingCount > 0 ? currency(row.avgBookingValue) : "—"}</div>
                <div><strong>Status:</strong> {row.active === true ? "Active" : row.active === false ? "Disabled" : "Unknown"}</div>
                <div><strong>Pricing:</strong> {row.pricingMode === "custom" ? "Custom pricing" : "Default"}</div>
              </div>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}