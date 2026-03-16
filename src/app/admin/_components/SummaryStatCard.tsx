import Link from "next/link";

type SummaryStatCardProps = {
  label: string;
  value: string | number;
  tone?: "default" | "success" | "warning";
  href?: string;
};

export function SummaryStatCard({
  label,
  value,
  tone = "default",
  href,
}: SummaryStatCardProps) {
  const toneClasses =
    tone === "success"
      ? "bg-emerald-50 ring-emerald-200"
      : tone === "warning"
      ? "bg-orange-50 ring-orange-200"
      : "bg-white ring-slate-200";

  const content = (
    <div
      className={`rounded-xl px-4 py-3 shadow-sm ring-1 ${toneClasses} ${
        href ? "transition-shadow hover:shadow-md" : ""
      }`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xs font-medium text-slate-600">{label}</div>
          <div className="mt-1 text-2xl font-semibold leading-none text-slate-900">
            {value}
          </div>
        </div>

        {href ? (
          <div className="shrink-0 text-xs font-medium text-slate-500">View</div>
        ) : null}
      </div>
    </div>
  );

  return href ? (
    <Link href={href} className="block">
      {content}
    </Link>
  ) : (
    content
  );
}