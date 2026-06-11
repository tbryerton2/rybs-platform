import Link from "next/link";

export function ZipAnalyticsViewTabs({ active }: { active: "heat" | "map" }) {
  return (
    <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-slate-200/80 bg-white p-1 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <Link
        href="/admin/analytics/zip-heatmap"
        className={[
          "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
          active === "heat"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        ].join(" ")}
      >
        Table View
      </Link>

      <Link
        href="/admin/analytics/zip-map"
        className={[
          "inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold transition",
          active === "map"
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
        ].join(" ")}
      >
        Map View
      </Link>
    </div>
  );
}
