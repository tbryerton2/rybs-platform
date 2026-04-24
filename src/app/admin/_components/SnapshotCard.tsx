import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SnapshotCard({
  label,
  value,
  insight,
  tooltip,
  icon: Icon,
  toneKey = "slate",
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  insight?: string;
  tooltip?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  toneKey?: "blue" | "amber" | "slate" | "green" | "violet";
  href?: string;
  tone?: "default" | "alert";
}) {
  const colorClasses =
    tone === "alert"
      ? {
          card: "border-rose-200/80 bg-rose-50/85 shadow-[0_10px_24px_rgba(244,63,94,0.08)]",
          iconChip: "border-rose-200/80 bg-white/80 text-rose-700",
          label: "text-rose-700",
          value: "text-rose-900",
          insight: "text-rose-700",
          info: "text-rose-500 hover:text-rose-700 focus-visible:text-rose-700",
        }
      : toneKey === "blue"
        ? {
            card: "border-sky-200/70 bg-sky-50/55 hover:border-sky-300/80 hover:shadow-[0_12px_28px_rgba(14,165,233,0.08)]",
            iconChip: "border-sky-200/70 bg-white/80 text-sky-700",
            label: "text-slate-700",
            value: "text-slate-900",
            insight: "text-slate-700",
            info: "text-sky-500 hover:text-sky-700 focus-visible:text-sky-700",
          }
        : toneKey === "amber"
          ? {
              card: "border-amber-200/70 bg-amber-50/50 hover:border-amber-300/80 hover:shadow-[0_12px_28px_rgba(245,158,11,0.08)]",
              iconChip: "border-amber-200/70 bg-white/80 text-amber-700",
              label: "text-slate-700",
              value: "text-slate-900",
              insight: "text-slate-700",
              info: "text-amber-500 hover:text-amber-700 focus-visible:text-amber-700",
            }
          : toneKey === "green"
            ? {
                card: "border-emerald-200/70 bg-emerald-50/50 hover:border-emerald-300/80 hover:shadow-[0_12px_28px_rgba(16,185,129,0.08)]",
                iconChip: "border-emerald-200/70 bg-white/80 text-emerald-700",
                label: "text-slate-700",
                value: "text-slate-900",
                insight: "text-slate-700",
                info: "text-emerald-500 hover:text-emerald-700 focus-visible:text-emerald-700",
              }
            : toneKey === "violet"
              ? {
                  card: "border-indigo-200/70 bg-indigo-50/45 hover:border-indigo-300/80 hover:shadow-[0_12px_28px_rgba(99,102,241,0.08)]",
                  iconChip: "border-indigo-200/70 bg-white/80 text-indigo-700",
                  label: "text-slate-700",
                  value: "text-slate-900",
                  insight: "text-slate-700",
                  info: "text-indigo-500 hover:text-indigo-700 focus-visible:text-indigo-700",
                }
              : {
                  card: "border-indigo-200/60 bg-indigo-50/40 hover:border-indigo-300/70 hover:shadow-[0_12px_28px_rgba(99,102,241,0.08)]",
                  iconChip: "border-indigo-200/70 bg-white/80 text-indigo-700",
                  label: "text-slate-700",
                  value: "text-slate-900",
                  insight: "text-slate-700",
                  info: "text-indigo-500 hover:text-indigo-700 focus-visible:text-indigo-700",
                };

  const content = (
    <div
      className={joinClasses(
        "relative flex h-full min-h-[164px] flex-col overflow-visible rounded-[28px] border px-5 py-5 shadow-sm transition",
        colorClasses.card,
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={joinClasses("flex items-center gap-2 text-sm font-semibold", colorClasses.label)}>
            <span
              className={joinClasses(
                "flex h-9 w-9 items-center justify-center rounded-2xl border",
                colorClasses.iconChip,
              )}
            >
              <Icon className="h-[18px] w-[18px]" />
            </span>
            {label}
          </div>
          <div className={joinClasses("mt-3 text-4xl font-semibold tracking-tight", colorClasses.value)}>
            {value}
          </div>
          {insight ? (
            <div className={joinClasses("mt-auto pt-5 text-sm font-medium", colorClasses.insight)}>
              {insight}
            </div>
          ) : null}
        </div>

        {tooltip ? (
          <div className="relative z-20 shrink-0 overflow-visible">
            <button
              type="button"
              aria-label={`${label} definition`}
              className={joinClasses(
                "group relative rounded-full p-0.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2",
                colorClasses.info,
              )}
            >
              <InformationCircleIcon className="h-5 w-5" aria-hidden="true" />
              <span
                role="tooltip"
                className="pointer-events-none absolute right-0 top-8 z-50 w-64 translate-y-1 rounded-2xl border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              >
                {tooltip}
              </span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
