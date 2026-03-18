import Link from "next/link";

export function ZipAnalyticsViewTabs({ active }: { active: "heat" | "map" }) {
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
