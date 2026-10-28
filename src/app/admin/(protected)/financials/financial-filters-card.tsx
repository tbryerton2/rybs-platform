"use client";

import { AdjustmentsHorizontalIcon, ArrowDownTrayIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { customDateRangeError, isValidFinancialDate } from "@/lib/financials/date-filters";

type FilterOption = { key: string; label: string; href: string; active: boolean };

type FinancialFiltersCardProps = {
  completion: string;
  completionOptions: FilterOption[];
  startDate: string;
  endDate: string;
  currentGranularity: "daily" | "weekly" | "monthly" | "annual";
  customActive: boolean;
  summary: string;
  isDefault: boolean;
  resetHref: string;
  exportHref: string;
  quickRanges: FilterOption[];
};

const groupClass = "inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-[28px] border border-slate-200 bg-slate-100 p-1";
const labelClass = "mb-2 block text-[11px] font-bold uppercase tracking-[0.09em] text-slate-500";
const inputClass = "h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-slate-500 focus:ring-2 focus:ring-slate-200";
function pillClass(active: boolean) {
  return `inline-flex min-h-9 items-center justify-center rounded-full px-3.5 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 ${active ? "bg-[#C95108] text-white" : "text-slate-700 hover:bg-white"}`;
}

export function FinancialFiltersCard({
  completion, completionOptions, startDate, endDate, currentGranularity,
  customActive, summary, isDefault, resetHref, exportHref, quickRanges,
}: FinancialFiltersCardProps) {
  const router = useRouter();
  const [customOpen, setCustomOpen] = useState(customActive);
  const [from, setFrom] = useState(startDate);
  const [to, setTo] = useState(endDate);
  const [pending, startTransition] = useTransition();
  const error = customDateRangeError(from, to);
  const reversed = isValidFinancialDate(from) && isValidFinancialDate(to) && to < from;

  function applyDates(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (error || pending) return;
    const params = new URLSearchParams({ preset: "custom", completion, start: from, end: to, granularity: currentGranularity });
    startTransition(() => router.push(`/admin/financials?${params}#filters`, { scroll: false }));
  }

  function resetDraft() {
    setCustomOpen(false);
    setFrom(startDate);
    setTo(endDate);
  }

  return (
    <section id="filters" aria-labelledby="financial-filters-heading"
      className="mt-8 scroll-mt-32 rounded-[24px] border border-slate-200 bg-white p-5 shadow-[0_4px_16px_rgba(15,23,42,0.04)] sm:px-6 sm:py-5">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
        <div className="flex items-center gap-4">
          <AdjustmentsHorizontalIcon className="h-5 w-5 shrink-0 text-slate-600" aria-hidden="true" />
          <div>
            <h2 id="financial-filters-heading" className="text-xl font-semibold tracking-tight text-slate-950">Filters</h2>
            <p aria-live="polite" aria-atomic="true" className="text-sm text-slate-600">{summary}</p>
          </div>
        </div>
        <a href={exportHref} download
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-900 transition hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500">
          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </a>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <div className="flex items-start justify-between gap-4">
            <span id="job-status-label" className={labelClass}>Job status</span>
            <button type="button" disabled={(isDefault && !customOpen) || pending}
              onClick={() => {
                resetDraft();
                startTransition(() => router.push(resetHref, { scroll: false }));
              }}
              className="mb-2 text-sm font-medium text-slate-600 underline decoration-slate-300 underline-offset-4 hover:text-slate-950 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-default disabled:text-slate-400 disabled:no-underline">
              Reset
            </button>
          </div>
          <nav aria-labelledby="job-status-label" className={groupClass}>
            {completionOptions.map(option => (
              <Link key={option.key} href={option.href} scroll={false}
                aria-current={option.active ? "page" : undefined} className={pillClass(option.active)}>
                {option.label}
              </Link>
            ))}
          </nav>
        </div>

        <div>
          <span id="payment-date-label" className={labelClass}>Payment date</span>
          <nav aria-labelledby="payment-date-label" className={groupClass}>
            {quickRanges.map(option => (
              <Link key={option.key} href={option.href} scroll={false}
                onNavigate={() => setCustomOpen(false)}
                aria-current={option.active && !customOpen ? "page" : undefined}
                className={pillClass(option.active && !customOpen)}>
                {option.label}
              </Link>
            ))}
            <button type="button" aria-expanded={customOpen} aria-controls="custom-payment-dates"
              aria-pressed={customOpen} onClick={() => setCustomOpen(true)} className={pillClass(customOpen)}>
              Custom range
            </button>
          </nav>
        </div>

        {customOpen && (
          <form id="custom-payment-dates" onSubmit={applyDates}
            className="grid max-w-2xl gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_auto]">
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">From</span>
              <input type="date" name="start" required value={from} onChange={event => setFrom(event.target.value)}
                aria-describedby={reversed ? "custom-payment-date-error" : undefined} className={inputClass} />
            </label>
            <label className="block text-sm font-medium text-slate-700">
              <span className="mb-2 block">To</span>
              <input type="date" name="end" required value={to} onChange={event => setTo(event.target.value)}
                aria-invalid={reversed} aria-describedby={reversed ? "custom-payment-date-error" : undefined} className={inputClass} />
            </label>
            <button type="submit" disabled={Boolean(error) || pending}
              className="mt-auto inline-flex h-11 items-center justify-center rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500">
              {pending ? "Applying…" : "Apply dates"}
            </button>
            {reversed && <p id="custom-payment-date-error" role="alert" className="text-sm text-red-700 sm:col-span-3">{error}</p>}
          </form>
        )}

      </div>
    </section>
  );
}
