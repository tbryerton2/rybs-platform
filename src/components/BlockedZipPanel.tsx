"use client";

import { useEffect, useRef, useState } from "react";

export function BlockedZipPanel({
  zip,
}: {
  zip: string;
}) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDivElement | null>(null);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // Close when clicking outside modal card
  const onBackdropMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) setOpen(false);
  };

  return (
    <div className="mt-6 rounded-[20px] border border-slate-200 bg-slate-50 p-5">
      {/* Top row */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-900">
            We don’t currently service ZIP{" "}
            <span className="font-semibold">{zip}</span>
          </div>
          <div className="mt-1 text-sm text-slate-600">
            Try a nearby ZIP code to continue booking.
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="shrink-0 inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-slate-200"
        >
          View service area
        </button>
      </div>

      {/* ZIP form */}
      <form action="/book" method="GET" className="mt-4">
        <label className="block text-sm font-medium text-slate-900">
          ZIP code
        </label>

        <div className="mt-2 flex items-end gap-3">
          <div className="w-full">
            <input
              name="zip"
              defaultValue={zip}
              inputMode="numeric"
              pattern="\d{5}"
              placeholder="Enter a different ZIP"
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base text-slate-900 shadow-sm outline-none transition focus:ring-4 focus:ring-[#F97316]/20"
            />
            <p className="mt-2 text-xs text-slate-500">Example: 13037</p>
          </div>

          <button
            type="submit"
            className="h-12 whitespace-nowrap rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#F97316]/20"
          >
            Check ZIP
          </button>
        </div>
      </form>

      {/* Modal overlay */}
      {open && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onMouseDown={onBackdropMouseDown}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px]" />

          {/* Modal card */}
          <div
            ref={dialogRef}
            className="relative w-full max-w-xl rounded-3xl bg-white p-6 shadow-xl ring-1 ring-slate-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  Service area
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  We currently service select ZIP codes. If you’re nearby, try a neighboring ZIP.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-900 shadow-sm transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            {/* Placeholder content (we’ll replace with real service-area info) */}
            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
              <div className="font-semibold text-slate-900">Coming next:</div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                <li>Show a simple list or map of serviced areas</li>
                <li>Suggest nearby serviced ZIPs automatically</li>
              </ul>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] focus:outline-none focus:ring-4 focus:ring-[#F97316]/20"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}