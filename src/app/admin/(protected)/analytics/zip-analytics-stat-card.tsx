import type { ComponentType } from "react";

type Accent = "orange" | "emerald" | "slate";

export function ZipAnalyticsStatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "slate",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: ComponentType<{ className?: string }>;
  accent?: Accent;
}) {
  const accentClasses =
    accent === "orange"
      ? {
          card: "border-orange-200/80 bg-orange-50/70 shadow-[0_10px_24px_rgba(249,115,22,0.06)]",
          chip: "border-orange-200/80 bg-white/80 text-[#F97316]",
        }
      : accent === "emerald"
      ? {
          card: "border-emerald-200/80 bg-emerald-50/70 shadow-[0_10px_24px_rgba(16,185,129,0.06)]",
          chip: "border-emerald-200/80 bg-white/80 text-emerald-700",
        }
      : {
          card: "border-indigo-200/70 bg-indigo-50/55 shadow-[0_10px_24px_rgba(99,102,241,0.05)]",
          chip: "border-indigo-200/80 bg-white/80 text-indigo-700",
        };

  return (
    <div
      className={`grid h-full min-h-[188px] grid-rows-[auto_auto_1fr] rounded-[20px] border px-5 py-5 transition ${accentClasses.card}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-slate-700">
            {label}
          </div>
        </div>

        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full border ${accentClasses.chip}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-4 text-[2.2rem] font-semibold leading-none tracking-tight text-slate-900">
        {value}
      </div>

      <div className="mt-4 flex items-end">
        <div className="max-w-[24ch] text-sm leading-5 text-slate-600">
          {hint ?? ""}
        </div>
      </div>
    </div>
  );
}
