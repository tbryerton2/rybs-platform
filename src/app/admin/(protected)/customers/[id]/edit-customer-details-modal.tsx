"use client";

import { PencilSquareIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { updateCustomerIdentityAction } from "./actions";

type EditCustomerDetailsModalProps = {
  customerId: string;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
};

function formatPhoneInput(value: string) {
  const digits = value.replace(/\D/g, "");
  const localDigits = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;
  const trimmed = localDigits.slice(0, 10);

  if (trimmed.length <= 3) return trimmed;
  if (trimmed.length <= 6) return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3)}`;
  return `(${trimmed.slice(0, 3)}) ${trimmed.slice(3, 6)}-${trimmed.slice(6)}`;
}

export function EditCustomerDetailsModal({
  customerId,
  customerName,
  customerEmail,
  customerPhone,
}: EditCustomerDetailsModalProps) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(() => formatPhoneInput(customerPhone ?? ""));

  useEffect(() => {
    if (!open) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setPhone(formatPhoneInput(customerPhone ?? ""));
          setOpen(true);
        }}
        className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
        aria-label="Edit customer details"
      >
        <PencilSquareIcon className="h-5 w-5" />
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-customer-details-title"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div className="absolute inset-0 bg-slate-900/45 backdrop-blur-[2px]" />

          <div className="relative w-full max-w-xl rounded-[14px] border border-slate-200 bg-white p-6 shadow-xl shadow-slate-950/10 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                  Customer details
                </div>
                <h2 id="edit-customer-details-title" className="mt-2 text-xl font-semibold text-slate-900">
                  Edit customer information
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Update the account owner details used for portal access and future admin reference.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-slate-200"
                aria-label="Close edit customer details"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <form action={updateCustomerIdentityAction} className="mt-6 grid gap-4 md:grid-cols-2">
              <input type="hidden" name="id" value={customerId} />

              <div className="rounded-[12px] border border-slate-200 bg-slate-50 px-4 py-3 md:col-span-2">
                <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Internal ID</div>
                <div className="mt-1 select-text break-all font-mono text-xs text-slate-700">{customerId}</div>
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Name</span>
                <input
                  name="name"
                  defaultValue={customerName ?? ""}
                  autoFocus
                  className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Email</span>
                <input
                  name="email"
                  defaultValue={customerEmail ?? ""}
                  className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-700">Phone</span>
                <input
                  name="phone"
                  value={phone}
                  onChange={(event) => setPhone(formatPhoneInput(event.target.value))}
                  className="h-12 w-full rounded-lg border border-slate-300 px-4 text-sm text-slate-900 outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-orange-100"
                />
              </label>

              <div className="mt-2 flex items-center justify-end gap-3 md:col-span-2">
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="admin-btn admin-btn-secondary h-11 px-4"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="admin-btn admin-btn-primary h-11 px-5"
                >
                  Save customer details
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
