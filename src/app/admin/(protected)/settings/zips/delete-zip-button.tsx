"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";

type DeleteZipButtonProps = {
  zip: string;
  className?: string;
};

export function DeleteZipButton({ zip, className }: DeleteZipButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className={
          className ??
          "admin-btn admin-btn-destructive h-10 px-4"
        }
        onClick={() => setOpen(true)}
      >
        Delete ZIP
      </button>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-[14px] border border-slate-200 bg-white p-6 shadow-2xl">
            <h3 className="text-lg font-semibold text-slate-900">Delete ZIP {zip}?</h3>

            <p className="mt-3 text-sm leading-6 text-slate-600">
              This will remove the ZIP from the service area. Customers in this ZIP will no
              longer be able to book online.
            </p>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                className="admin-btn admin-btn-secondary h-11 px-4"
                onClick={() => setOpen(false)}
              >
                Cancel
              </button>

              <FormSubmitButton
                loadingLabel="Deleting..."
                className="admin-btn admin-btn-destructive h-11 px-4"
              >
                Delete ZIP
              </FormSubmitButton>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
