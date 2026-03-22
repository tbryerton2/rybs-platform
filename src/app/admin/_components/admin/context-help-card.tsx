import Link from "next/link";
import { InformationCircleIcon } from "@heroicons/react/24/outline";

type ContextHelpCardProps = {
  eyebrow?: string;
  title: string;
  body: string;
  learnMoreHref?: string;
  learnMoreLabel?: string;
  tone?: "default" | "sky" | "slate";
  compact?: boolean;
  emphasis?: "subtle" | "standard";
};

function toneClasses(tone: ContextHelpCardProps["tone"]) {
  switch (tone) {
    case "sky":
      return "border-sky-200 bg-sky-50/80 text-sky-950";
    case "slate":
      return "border-slate-200 bg-slate-50/90 text-slate-800";
    default:
      return "border-slate-200 bg-slate-50/70 text-slate-800";
  }
}

export function ContextHelpCard({
  eyebrow = "Operational note",
  title,
  body,
  learnMoreHref,
  learnMoreLabel = "Learn more",
  tone = "default",
  compact = false,
  emphasis = "standard",
}: ContextHelpCardProps) {
  if (emphasis === "subtle") {
    return (
      <div className="flex gap-2.5 text-sm">
        <InformationCircleIcon className="mt-0.5 h-4 w-4 flex-none text-slate-400" />
        <div className="min-w-0">
          <p className="text-sm leading-6 text-slate-500">
            <span className="font-medium text-slate-600">{title}</span> {body}
          </p>
          {learnMoreHref ? (
            <Link
              href={learnMoreHref}
              className="mt-1 inline-flex items-center text-xs font-medium text-slate-500 hover:text-slate-700"
            >
              {learnMoreLabel}
            </Link>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border px-4 py-4 ${toneClasses(tone)}`}>
      <div className="flex gap-3">
        <span className="mt-0.5 inline-flex h-8 w-8 flex-none items-center justify-center rounded-2xl bg-white/80 text-slate-500 ring-1 ring-inset ring-slate-200/80">
          <InformationCircleIcon className="h-4 w-4" />
        </span>

        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
            {eyebrow}
          </div>
          <div className={`${compact ? "mt-1 text-sm" : "mt-1.5 text-sm"} font-semibold text-slate-900`}>
            {title}
          </div>
          <p className={`${compact ? "mt-1.5" : "mt-2"} text-sm leading-6 text-slate-600`}>
            {body}
          </p>
          {learnMoreHref ? (
            <Link
              href={learnMoreHref}
              className="mt-3 inline-flex items-center text-sm font-medium text-[#F97316] hover:text-orange-600"
            >
              {learnMoreLabel} →
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
