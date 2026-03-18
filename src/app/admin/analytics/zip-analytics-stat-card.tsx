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
      ? "bg-orange-50 text-[#F97316]"
      : accent === "emerald"
      ? "bg-emerald-50 text-emerald-600"
      : "bg-slate-100 text-slate-600";

  return (
    <div className="rounded-[28px] border border-slate-200/80 bg-white p-6 shadow-sm">
      <div className="flex h-full min-h-[168px] flex-col">
        <div className="flex min-h-[58px] items-start justify-between gap-4">
          <div className="max-w-[72%] text-sm font-medium leading-6 text-slate-500">
            {label}
          </div>

          <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClasses}`}>
            <Icon className="h-6 w-6" />
          </div>
        </div>

        <div className="mt-2 text-[34px] font-semibold leading-[1] tracking-tight text-slate-900">
          {value}
        </div>

        <div className="mt-4 min-h-[52px] text-sm leading-5 text-slate-500">
          {hint ?? ""}
        </div>
      </div>
    </div>
  );
}
