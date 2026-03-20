import Link from "next/link";

export function PortalSubpageHeader({
  title,
  description,
  backHref = "/portal",
  backLabel = "Back to dashboard",
  meta,
}: {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  meta?: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <Link
        href={backHref}
        className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
      >
        ← {backLabel}
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-3xl font-semibold tracking-tight text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">{description}</p>
          ) : null}
        </div>
        {meta ? <div className="flex items-center gap-3">{meta}</div> : null}
      </div>
    </div>
  );
}
