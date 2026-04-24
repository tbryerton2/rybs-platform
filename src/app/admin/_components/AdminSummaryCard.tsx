import Link from "next/link";
import type { ComponentType, SVGProps } from "react";

type SummaryCardTone = "green" | "blue" | "violet" | "amber" | "teal" | "rose";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function adminSummaryCardShell(tone: SummaryCardTone, extra = "") {
  const toneClasses =
    tone === "green"
      ? "border-emerald-200/70 bg-emerald-50/55"
      : tone === "blue"
        ? "border-sky-200/70 bg-sky-50/55"
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
      : tone === "violet"
        ? "bg-violet-100/90 text-violet-700 ring-1 ring-inset ring-violet-200/80"
        : tone === "amber"
          ? "bg-amber-100/90 text-amber-700 ring-1 ring-inset ring-amber-200/80"
          : tone === "teal"
            ? "bg-teal-100/90 text-teal-700 ring-1 ring-inset ring-teal-200/80"
            : "bg-rose-100/90 text-rose-700 ring-1 ring-inset ring-rose-200/80";
}

export function AdminSummaryCard({
  label,
  value,
  icon: Icon,
  tone,
  href,
  detail,
  compact = false,
  stretch = false,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  tone: SummaryCardTone;
  href?: string;
  detail?: string;
  compact?: boolean;
  stretch?: boolean;
}) {
  const content = (
    <div
      className={joinClasses(
        adminSummaryCardShell(
          tone,
          compact
            ? "p-4 transition hover:-translate-y-0.5 hover:shadow-md"
            : "p-5 transition hover:-translate-y-0.5 hover:shadow-md",
        ),
        stretch && "flex h-full flex-col",
      )}
    >
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
    <Link href={href} className={stretch ? "block h-full" : undefined}>
      {content}
    </Link>
  ) : content;
}
