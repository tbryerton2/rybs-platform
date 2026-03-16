"use client";

import { useState } from "react";

type DeleteZipButtonProps = {
  zip: string;
};

export function DeleteZipButton({ zip }: DeleteZipButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="text-sm font-medium text-red-600 hover:text-red-700"
        onClick={() => setOpen(true)}
      >
        Delete
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete ZIP {zip}?</h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              This will remove the ZIP from the service area. Customers in this ZIP will no
              longer be able to book online.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="inline-flex h-11 items-center justify-center rounded-2xl border border-slate-300 px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="inline-flex h-11 items-center justify-center rounded-2xl bg-red-600 px-4 text-sm font-medium text-white transition hover:bg-red-700"
              >
                Delete ZIP
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}