import { formatUsd } from "@/lib/money";

export function RevenueSnapshotChart({ values }: {
  values: Array<{ label: string; value: number }>;
}) {
  const maxValue = Math.max(0, ...values.map((entry) => entry.value));

  return (
    <figure className="rounded-2xl border border-slate-100 bg-slate-50/60 p-4 sm:p-5">
      <figcaption className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-semibold text-slate-900">Last 30 days</span>
        <span className="text-xs text-slate-500">Booked revenue · oldest to newest</span>
      </figcaption>
      <ol className="grid grid-cols-[max-content_minmax(0,1fr)] gap-y-2.5" aria-label="Booked revenue by date range">
        {values.map((entry) => {
          const shareOfMax = maxValue > 0 ? Math.max(0, entry.value) / maxValue : 0;
          return (
          <li key={entry.label} className="col-span-2 grid min-h-10 grid-cols-subgrid overflow-hidden rounded-[14px] bg-slate-100/65 text-sm text-slate-900">
            <span className="self-center px-3 py-2 font-medium">{entry.label}</span>
            <div className="relative isolate flex min-w-0 items-center justify-end px-3 py-2">
              <div
                aria-hidden="true"
                className="absolute inset-y-px left-0 -z-10 rounded-[15px] bg-orange-300 shadow-[inset_0_-1px_0_rgba(15,23,42,0.06),0_1px_1px_rgba(15,23,42,0.04)]"
                style={{ width: `${shareOfMax * 100}%`, opacity: 0.25 + shareOfMax * 0.75 }}
              />
              <span className="break-all text-right font-semibold tabular-nums">
                {formatUsd(entry.value, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs leading-5 text-slate-500">
        {maxValue === 0
          ? "No booked revenue in the last 30 days. New bookings will appear here."
          : "Longer, deeper orange bars mean more booked revenue. Empty bars mean no booked revenue."}
      </p>
    </figure>
  );
}
