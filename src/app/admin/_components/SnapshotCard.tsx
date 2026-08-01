import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { InformationCircleIcon } from "@heroicons/react/24/outline";
import { adminSummaryCardShell } from "./AdminSummaryCard";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function SnapshotCard({
  label,
  value,
  tooltip,
  icon: Icon,
  toneKey = "slate",
  href,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tooltip?: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  toneKey?: "blue" | "amber" | "slate" | "green" | "violet";
  href?: string;
  tone?: "default" | "alert";
}) {
  const colorClasses =
    tone === "alert"
      ? {
          card: adminSummaryCardShell("rose", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
          iconChip: "bg-rose-100/95 text-rose-700 ring-rose-200/90",
          label: "text-rose-700",
          value: "text-rose-900",
          info: "text-rose-500 hover:text-rose-700 focus-visible:text-rose-700",
        }
      : toneKey === "blue"
        ? {
            card: adminSummaryCardShell("blue", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
            iconChip: "bg-sky-100/95 text-sky-700 ring-sky-200/90",
            label: "text-slate-700",
            value: "text-slate-900",
            info: "text-sky-500 hover:text-sky-700 focus-visible:text-sky-700",
          }
        : toneKey === "amber"
          ? {
              card: adminSummaryCardShell("amber", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
              iconChip: "bg-amber-100/95 text-amber-700 ring-amber-200/90",
              label: "text-slate-700",
              value: "text-slate-900",
              info: "text-amber-500 hover:text-amber-700 focus-visible:text-amber-700",
            }
          : toneKey === "green"
            ? {
                card: adminSummaryCardShell("green", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
                iconChip: "bg-emerald-100/95 text-emerald-700 ring-emerald-200/90",
                label: "text-slate-700",
                value: "text-slate-900",
                info: "text-emerald-500 hover:text-emerald-700 focus-visible:text-emerald-700",
              }
            : toneKey === "violet"
              ? {
                  card: adminSummaryCardShell("violet", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
                  iconChip: "bg-violet-100/95 text-violet-700 ring-violet-200/90",
                  label: "text-slate-700",
                  value: "text-slate-900",
                  info: "text-indigo-500 hover:text-indigo-700 focus-visible:text-indigo-700",
                }
              : {
                  card: adminSummaryCardShell("violet", "relative h-full p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"),
                  iconChip: "bg-violet-100/95 text-violet-700 ring-violet-200/90",
                  label: "text-slate-700",
                  value: "text-slate-900",
                  info: "text-indigo-500 hover:text-indigo-700 focus-visible:text-indigo-700",
                };

  const content = (
    <div
      className={joinClasses(
        "flex h-full overflow-visible",
        colorClasses.card,
      )}
    >
      <div className="flex w-full items-start justify-between gap-4">
        <div className="flex min-w-0 gap-4">
          <span
            className={joinClasses(
              "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/65 ring-1 ring-inset",
              colorClasses.iconChip,
            )}
          >
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className={joinClasses("flex h-12 items-center text-sm font-medium leading-5", colorClasses.label)}>
              {label}
            </div>
            <div className={joinClasses("mt-2 text-4xl font-semibold tracking-tight", colorClasses.value)}>
              {value}
            </div>
          </div>
        </div>

        {tooltip ? (
          <div className="relative z-20 shrink-0 overflow-visible">
            <span
              className="flex h-12 items-center"
            >
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
                  className="pointer-events-none absolute right-0 top-8 z-50 w-64 translate-y-1 rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
                >
                  {tooltip}
                </span>
              </button>
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );

  return href ? <Link href={href}>{content}</Link> : content;
}
