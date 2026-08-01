"use client";

import { useEffect, useMemo, useState } from "react";
import { XMarkIcon } from "@heroicons/react/24/outline";
import type { PricingSizeGuideContent } from "@/lib/tenant/content";

export default function PricingSizeGuide({ content }: { content: PricingSizeGuideContent }) {
  const [open, setOpen] = useState(false);
  const rows = useMemo(
    () =>
      content.rows
        .filter((row) => row.active && row.sizeLabel.trim() && row.description.trim())
        .sort((left, right) => {
          if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
          return left.sizeLabel.localeCompare(right.sizeLabel);
        }),
    [content.rows],
  );

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!content.enabled || !rows.length) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center rounded-full border border-orange-200 bg-white/70 px-4 py-2 text-sm font-semibold text-[#F97316] shadow-sm transition hover:border-orange-300 hover:bg-white hover:text-[#EA580C] focus:outline-none focus:ring-4 focus:ring-[#F97316]/15"
      >
        {content.buttonText}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 px-0 sm:items-center sm:px-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pricing-size-guide-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="max-h-[88vh] w-full overflow-hidden rounded-t-[28px] bg-white shadow-2xl ring-1 ring-slate-200 sm:max-w-3xl sm:rounded-[28px]">
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-5 sm:px-6">
              <div>
                <div className="text-xs font-bold uppercase tracking-[0.18em] text-[#F97316]">
                  Size guide
                </div>
                <h2
                  id="pricing-size-guide-title"
                  className="mt-2 text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl"
                >
                  {content.title}
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:bg-slate-50 hover:text-slate-950"
                aria-label="Close size guide"
              >
                <XMarkIcon className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[calc(88vh-104px)] overflow-y-auto px-5 py-5 sm:px-6 sm:py-6">
              <div className="hidden overflow-hidden rounded-2xl border border-slate-200 sm:block">
                <div className="grid grid-cols-[150px_170px_minmax(0,1fr)] bg-slate-50 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  <div className="px-4 py-3">Size</div>
                  <div className="border-l border-slate-200 px-4 py-3">Truck loads</div>
                  <div className="border-l border-slate-200 px-4 py-3">Recommended for</div>
                </div>
                {rows.map((row) => (
                  <div
                    key={row.id}
                    className="grid grid-cols-[150px_170px_minmax(0,1fr)] border-t border-slate-200 text-sm text-slate-700"
                  >
                    <div className="px-4 py-4 font-semibold text-slate-950">{row.sizeLabel}</div>
                    <div className="border-l border-slate-200 px-4 py-4 font-medium text-slate-800">
                      {row.truckLoadEstimate}
                    </div>
                    <div className="border-l border-slate-200 px-4 py-4 leading-6">{row.description}</div>
                  </div>
                ))}
              </div>

              <div className="space-y-3 sm:hidden">
                {rows.map((row) => (
                  <article key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                    <div className="flex items-start justify-between gap-3">
                      <h3 className="text-lg font-semibold tracking-tight text-slate-950">{row.sizeLabel}</h3>
                      <div className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#EA580C]">
                        {row.truckLoadEstimate}
                      </div>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{row.description}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
