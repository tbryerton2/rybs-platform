"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { GeoJSON, MapContainer, Pane, TileLayer } from "react-leaflet";
import type { GeoJsonObject, Feature, FeatureCollection, Geometry } from "geojson";
import L from "leaflet";
import { formatUsd } from "@/lib/money";

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

type ZctaFeatureProperties = {
  ZCTA5CE10?: string;
  GEOID10?: string;
  zip?: string;
  ZCTA5CE20?: string;
};

type ZctaFeature = Feature<Geometry, ZctaFeatureProperties>;
type ZctaFeatureCollection = FeatureCollection<Geometry, ZctaFeatureProperties>;

const DEFAULT_CENTER: [number, number] = [43.0481, -76.1474];
const DEFAULT_BOUNDS = L.latLngBounds(
  L.latLng(42.7, -76.6),
  L.latLng(43.35, -75.75)
);
const GEOJSON_URL = "/data/us-zcta-boundaries.geojson";

function number(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function getFeatureZip(feature: ZctaFeature) {
  const raw =
    feature.properties?.ZCTA5CE10 ??
    feature.properties?.GEOID10 ??
    feature.properties?.ZCTA5CE20 ??
    feature.properties?.zip;

  return typeof raw === "string" ? raw.trim().slice(0, 5) : null;
}

function colorForBookingCount(bookingCount: number, maxBookings: number) {
  if (bookingCount <= 0 || maxBookings <= 0) return "#f8fafc";

  const ratio = bookingCount / maxBookings;

  if (ratio >= 0.85) return "#c2410c";
  if (ratio >= 0.62) return "#ea580c";
  if (ratio >= 0.38) return "#fb923c";
  if (ratio >= 0.16) return "#fed7aa";
  return "#fed7aa";
}

function getMetricValue(row: MapZipRow, metric: MetricKey) {
  if (metric === "revenue") return row.revenue;
  if (metric === "avg") return row.avgBookingValue;
  return row.bookingCount;
}

function getMetricLabel(metric: MetricKey) {
  if (metric === "revenue") return "Revenue";
  if (metric === "avg") return "Avg booking";
  return "Bookings";
}

function colorForMetricValue(value: number, maxValue: number) {
  return colorForBookingCount(value, maxValue);
}

function styleForRow(
  row: MapZipRow,
  maxMetricValue: number,
  metric: MetricKey
) {
  const metricValue = getMetricValue(row, metric);

  if (row.active !== true) {
    return {
      color: "#64748b",
      weight: 0.7,
      opacity: 0.75,
      fillColor: "#E2E8F0",
      fillOpacity: 0.15,
    };
  }

  if (metricValue <= 0) {
    return {
      color: "#64748b",
      weight: 0.7,
      opacity: 0.75,
      fillColor: "#fde68a",
      fillOpacity: 0.14,
    };
  }

  return {
    color: "#64748b",
    weight: 0.7,
    opacity: 0.75,
    fillColor: colorForMetricValue(metricValue, maxMetricValue),
    fillOpacity: 0.35,
  };
}

function highlightStyle(
  row: MapZipRow,
  maxMetricValue: number,
  metric: MetricKey
) {
  return {
    ...styleForRow(row, maxMetricValue, metric),
    color: "#1e293b",
    weight: 1.4,
    opacity: 1,
    fillColor: "#fef08a",
    fillOpacity: 0.75,
  };
}

function computeBounds(fc: ZctaFeatureCollection) {
  const layer = L.geoJSON(fc as GeoJsonObject);
  const bounds = layer.getBounds();
  return bounds.isValid() ? bounds : DEFAULT_BOUNDS;
}

export default function ZipMapClient({
  rows,
  metric,
}: {
  rows: MapZipRow[];
  metric: MetricKey;
}) {
  const router = useRouter();
  const [featureCollection, setFeatureCollection] = useState<ZctaFeatureCollection | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const rowsByZip = useMemo(() => {
    return new Map(rows.map((row) => [row.zip, row]));
  }, [rows]);

  const maxMetricValue = useMemo(() => {
    return rows.reduce((max, row) => Math.max(max, getMetricValue(row, metric)), 0);
  }, [rows, metric]);

  useEffect(() => {
    let cancelled = false;

    async function loadBoundaries() {
      try {
        setLoadError(null);

        const res = await fetch(GEOJSON_URL, { cache: "force-cache" });
        if (!res.ok) {
          throw new Error(`Boundary file not found at ${GEOJSON_URL}.`);
        }

        const geojson = (await res.json()) as ZctaFeatureCollection;
        const filteredFeatures = (geojson.features ?? []).filter((feature) => {
          const zip = getFeatureZip(feature as ZctaFeature);
          return !!zip && rowsByZip.has(zip);
        }) as ZctaFeature[];

        if (cancelled) return;

        setFeatureCollection({
          type: "FeatureCollection",
          features: filteredFeatures,
        });
      } catch (error) {
        if (cancelled) return;
        setFeatureCollection(null);
        setLoadError(error instanceof Error ? error.message : "Could not load ZIP boundaries.");
      }
    }

    if (rows.length === 0) {
      setFeatureCollection({ type: "FeatureCollection", features: [] });
      return;
    }

    loadBoundaries();

    return () => {
      cancelled = true;
    };
  }, [rows, rowsByZip]);

  if (rows.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-center">
        <div className="px-6">
          <div className="text-lg font-semibold text-slate-900">No ZIP analytics yet</div>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Add service ZIPs or wait for bookings to see ZIP boundary activity on the map.
          </p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-center">
        <div className="px-6">
          <div className="text-lg font-semibold text-slate-900">ZIP boundaries unavailable</div>
          <p className="mt-2 max-w-lg text-sm text-slate-500">{loadError}</p>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            Add a GeoJSON file at <code>{GEOJSON_URL}</code> containing ZCTA features with a
            <code> ZCTA5CE10 </code> property.
          </p>
        </div>
      </div>
    );
  }

  if (!featureCollection) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-center">
        <div className="px-6">
          <div className="text-lg font-semibold text-slate-900">Loading ZIP boundaries…</div>
          <p className="mt-2 max-w-md text-sm text-slate-500">
            Matching analytics ZIPs to ZCTA polygons.
          </p>
        </div>
      </div>
    );
  }

  if (featureCollection.features.length === 0) {
    return (
      <div className="flex h-full items-center justify-center bg-slate-50 text-center">
        <div className="px-6">
          <div className="text-lg font-semibold text-slate-900">No matching ZIP boundaries</div>
          <p className="mt-2 max-w-lg text-sm text-slate-500">
            The boundary file loaded, but none of its ZCTA features matched the analytics ZIP
            rows for this view.
          </p>
        </div>
      </div>
    );
  }

  const bounds = computeBounds(featureCollection);
  return (
    <div className="relative h-full w-full">
      <MapContainer
        bounds={bounds}
        boundsOptions={{ padding: [40, 40] }}
        center={DEFAULT_CENTER}
        zoom={9}
        scrollWheelZoom={true}
        className="tcm-zip-map h-full w-full"
      >
        <TileLayer
          attribution="&copy; OpenStreetMap contributors"
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <Pane name="zip-polygons" style={{ zIndex: 400 }}>
          <GeoJSON
            key={featureCollection.features.length}
            data={featureCollection as GeoJsonObject}
            style={(feature) => {
              const zip = getFeatureZip(feature as ZctaFeature);
              const row = zip ? rowsByZip.get(zip) : null;

              if (!row) {
                return {
                  color: "#334155",
                  weight: 0.35,
                  opacity: 0.45,
                  fillColor: "#E2E8F0",
                  fillOpacity: 0.15,
                };
              }

              return styleForRow(row, maxMetricValue, metric);
            }}
            onEachFeature={(feature, layer) => {
              const zip = getFeatureZip(feature as ZctaFeature);
              const row = zip ? rowsByZip.get(zip) : null;
              if (!row) return;

              const pathLayer = layer as L.Path;

              layer.on({
                mouseover: () => {
                  const hover = highlightStyle(row, maxMetricValue, metric);
                  pathLayer.setStyle({
                    ...hover,
                    weight: 1.4,
                  });
                  const element = pathLayer.getElement();
                  if (element instanceof HTMLElement || element instanceof SVGElement) {
                    element.style.filter = "drop-shadow(0 1px 5px rgba(15, 23, 42, 0.22))";
                  }
                  if ("bringToFront" in pathLayer) {
                    pathLayer.bringToFront();
                  }
                },
                mouseout: () => {
                  const base = styleForRow(row, maxMetricValue, metric);
                  pathLayer.setStyle(base);
                  const element = pathLayer.getElement();
                  if (element instanceof HTMLElement || element instanceof SVGElement) {
                    element.style.filter = "";
                  }
                },
                click: () => {
                  if (row.id) router.push(`/admin/settings/zips/${row.id}`);
                },
              });

              const tooltipHtml = [
                `<div class="tcm-zip-tooltip-card${
                  row.bookingCount === 0 ? " tcm-zip-tooltip-card--quiet" : ""
                }">`,
                `<div class="tcm-zip-tooltip-zip">${row.zip}</div>`,
                row.town ? `<div class="tcm-zip-tooltip-town">${row.town}</div>` : "",
                `<div class="tcm-zip-tooltip-metrics">`,
                `<div><span>Bookings:</span> <strong>${number(row.bookingCount)}</strong></div>`,
                `<div><span>Revenue:</span> <strong>${formatUsd(row.revenue, { maximumFractionDigits: 0 })}</strong></div>`,
                `<div><span>Avg booking:</span> <strong>${
                  row.bookingCount > 0 ? formatUsd(row.avgBookingValue, { maximumFractionDigits: 0 }) : "—"
                }</div>`,
                `</div>`,
                `</div>`,
              ].join("");

              layer.bindTooltip(tooltipHtml, {
                sticky: true,
                direction: "top",
                className: "tcm-zip-tooltip",
              });
            }}
          />
        </Pane>
      </MapContainer>

      <div className="tcm-zip-legend pointer-events-none absolute bottom-4 right-4 z-[500]">
        <div className="tcm-zip-legend-title">{getMetricLabel(metric)}</div>
        <div className="tcm-zip-legend-row">
          <span className="tcm-zip-legend-swatch" style={{ backgroundColor: "#f8fafc" }} />
          <span>none</span>
        </div>
        <div className="tcm-zip-legend-row">
          <span className="tcm-zip-legend-swatch" style={{ backgroundColor: "#fed7aa" }} />
          <span>low</span>
        </div>
        <div className="tcm-zip-legend-row">
          <span className="tcm-zip-legend-swatch" style={{ backgroundColor: "#fb923c" }} />
          <span>medium</span>
        </div>
        <div className="tcm-zip-legend-row">
          <span className="tcm-zip-legend-swatch" style={{ backgroundColor: "#c2410c" }} />
          <span>high</span>
        </div>
      </div>
    </div>
  );
}
