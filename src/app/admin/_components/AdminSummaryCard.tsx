import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

type SummaryCardTone = "green" | "blue" | "violet" | "indigo" | "amber" | "teal" | "rose";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function adminSummaryCardShell(tone: SummaryCardTone, extra = "") {
  const toneClasses =
    tone === "green"
      ? "border-emerald-200/70 bg-emerald-50/55"
      : tone === "blue"
        ? "border-sky-200/70 bg-sky-50/55"
        : tone === "indigo"
          ? "border-indigo-200/70 bg-indigo-50/55"
        : tone === "violet"
          ? "border-violet-200/70 bg-violet-50/50"
          : tone === "amber"
            ? "border-amber-200/70 bg-amber-50/55"
            : tone === "teal"
              ? "border-teal-200/70 bg-teal-50/55"
              : "border-rose-200/70 bg-rose-50/55";

  return `rounded-[28px] border shadow-sm ${toneClasses} ${extra}`;
}

function chipToneClasses(tone: SummaryCardTone) {
  return tone === "green"
    ? "bg-emerald-100/90 text-emerald-700 ring-1 ring-inset ring-emerald-200/80"
    : tone === "blue"
      ? "bg-sky-100/90 text-sky-700 ring-1 ring-inset ring-sky-200/80"
      : tone === "indigo"
        ? "bg-indigo-100/90 text-indigo-700 ring-1 ring-inset ring-indigo-200/80"
      : tone === "violet"
        ? "bg-violet-100/90 text-violet-700 ring-1 ring-inset ring-violet-200/80"
      : tone === "amber"
        ? "bg-amber-100/90 text-amber-700 ring-1 ring-inset ring-amber-200/80"
          : tone === "teal"
            ? "bg-teal-100/90 text-teal-700 ring-1 ring-inset ring-teal-200/80"
            : "bg-rose-100/90 text-rose-700 ring-1 ring-inset ring-rose-200/80";
}

function activeToneClasses(tone: SummaryCardTone) {
  return tone === "green"
    ? "ring-2 ring-emerald-300/90 shadow-md shadow-emerald-200/35"
    : tone === "blue"
      ? "ring-2 ring-sky-300/90 shadow-md shadow-sky-200/35"
      : tone === "indigo"
        ? "ring-2 ring-indigo-300/90 shadow-md shadow-indigo-200/35"
        : tone === "violet"
          ? "ring-2 ring-violet-300/90 shadow-md shadow-violet-200/35"
          : tone === "amber"
            ? "ring-2 ring-amber-300/90 shadow-md shadow-amber-200/35"
            : tone === "teal"
              ? "ring-2 ring-teal-300/90 shadow-md shadow-teal-200/35"
              : "ring-2 ring-rose-300/90 shadow-md shadow-rose-200/35";
}

export function AdminSummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
  onClick,
  detail,
  compact = false,
  stretch = false,
  active = false,
  layout = "default",
}: {
  label: string;
  value: string | number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SummaryCardTone;
  href?: string;
  onClick?: () => void;
  detail?: string;
  compact?: boolean;
  stretch?: boolean;
  active?: boolean;
  layout?: "default" | "pricing";
}) {
  const shellClasses = joinClasses(
    adminSummaryCardShell(
      tone,
      compact
        ? "p-4 transition hover:-translate-y-0.5 hover:shadow-md"
        : "p-5 transition hover:-translate-y-0.5 hover:shadow-md",
    ),
    stretch && "flex h-full flex-col",
    active && activeToneClasses(tone),
    active && compact && "-translate-y-0.5",
  );

  const content =
    layout === "pricing" ? (
      <div className={shellClasses}>
        <div className="flex gap-4">
          <span
            className={joinClasses(
              "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/65 ring-1 ring-inset",
              chipToneClasses(tone),
            )}
          >
            <Icon className="h-6 w-6" />
          </span>
          <div className="min-w-0">
            <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">{label}</div>
            <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</div>
          </div>
        </div>
      </div>
    ) : (
      <div className={shellClasses}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="text-sm font-medium text-slate-500">{label}</div>
            <div
              className={joinClasses(
                "mt-2 font-semibold tracking-tight text-slate-900",
                compact ? "text-[1.75rem]" : "text-3xl",
              )}
            >
              {value}
            </div>
            {detail ? <div className="mt-2 text-xs text-slate-500">{detail}</div> : null}
          </div>
          <span
            className={joinClasses(
              "inline-flex items-center justify-center rounded-2xl",
              compact ? "h-10 w-10" : "h-11 w-11",
              chipToneClasses(tone),
            )}
          >
            <Icon className={compact ? "h-[18px] w-[18px]" : "h-5 w-5"} />
          </span>
        </div>
      </div>
    );

  return href ? (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={joinClasses(stretch && "block h-full", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2 rounded-[28px]")}
    >
      {content}
    </Link>
  ) : onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={joinClasses(
        stretch && "block h-full w-full text-left",
        "cursor-pointer rounded-[28px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2",
      )}
    >
      {content}
    </button>
  ) : content;
}
