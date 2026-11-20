import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { adminSummaryCardShell } from "./AdminSummaryCard";
import { InfoTooltip } from "./InfoTooltip";

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

  return (
    <div
      className={joinClasses(
        "flex h-full overflow-visible",
        colorClasses.card,
      )}
    >
      {href ? (
        <Link
          href={href}
          aria-label={label}
          className="absolute inset-0 z-10 rounded-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
        />
      ) : null}
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
          <div className="pointer-events-none relative z-20 shrink-0 overflow-visible">
            <span
              className="flex h-12 items-center"
            >
              <InfoTooltip
                label={`${label} definition`}
                body={tooltip}
                align="right"
                iconClassName="h-5 w-5"
                className={joinClasses("pointer-events-auto", colorClasses.info)}
              />
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
