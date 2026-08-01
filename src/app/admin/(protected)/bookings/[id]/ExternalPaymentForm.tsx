"use client";

import { useRef, useState, type FormEvent } from "react";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";

type ExternalPaymentFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  amount: string;
  bookingChargeId: string;
  bookingId: string;
  today: string;
};

export function ExternalPaymentForm({
  action,
  amount,
  bookingChargeId,
  bookingId,
  today,
}: ExternalPaymentFormProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isConfirmed, setIsConfirmed] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    formRef.current?.reset();
    setIsConfirmed(false);
    setIsOpen(false);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    if (!isConfirmed) {
      event.preventDefault();
    }
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="admin-btn admin-btn-secondary"
        style={{
          cursor: "pointer",
          display: "inline-flex",
          fontSize: "12px",
          fontWeight: 500,
          justifyContent: "center",
          padding: "6px 12px",
          whiteSpace: "nowrap",
        }}
        onClick={() => setIsOpen(true)}
      >
        Record external payment
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={action}
      onSubmit={handleSubmit}
      style={{
        alignItems: "stretch",
        border: "0.5px solid var(--border)",
        borderRadius: "var(--radius)",
        display: "grid",
        gap: "10px",
        marginTop: "8px",
        padding: "12px",
        textAlign: "left",
        width: "min(360px, 100%)",
      }}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="bookingChargeId" value={bookingChargeId} />
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Payment method</span>
        <select
          name="externalPaymentMethod"
          defaultValue="cash"
          className="h-10 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
          required
        >
          <option value="cash">Cash</option>
          <option value="check">Check</option>
          <option value="square_invoice">Square invoice</option>
          <option value="manually_processed_card">Manually processed card</option>
          <option value="other">Other</option>
        </select>
      </label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Amount</span>
          <input
            type="text"
            name="amount"
            inputMode="decimal"
            defaultValue={amount}
            className="h-10 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-700">Payment date</span>
          <input
            type="date"
            name="paymentDate"
            defaultValue={today}
            className="h-10 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
            required
          />
        </label>
      </div>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Reference or confirmation number</span>
        <input
          type="text"
          name="reference"
          className="h-10 w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-700">Notes</span>
        <textarea
          name="notes"
          rows={3}
          className="w-full rounded-[var(--radius)] border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
        />
      </label>
      <label className="flex items-start gap-2 text-xs text-slate-600">
        <input
          type="checkbox"
          name="confirmExternalPayment"
          className="mt-0.5 h-4 w-4 rounded border-slate-300"
          checked={isConfirmed}
          required
          onChange={(event) => setIsConfirmed(event.currentTarget.checked)}
        />
        <span>I confirm I already collected this payment.</span>
      </label>
      <div className="flex justify-end gap-2">
        <button
          type="button"
          className="admin-btn admin-btn-secondary"
          style={{ fontSize: "12px", fontWeight: 500, padding: "6px 12px" }}
          onClick={handleCancel}
        >
          Cancel
        </button>
        <FormSubmitButton
          disabled={!isConfirmed}
          loadingLabel="Recording payment..."
          className="admin-btn admin-btn-primary"
        >
          Record payment
        </FormSubmitButton>
      </div>
    </form>
  );
}
