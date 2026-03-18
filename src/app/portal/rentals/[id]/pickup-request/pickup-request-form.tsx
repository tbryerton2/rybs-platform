"use client";

import { useMemo, useState } from "react";

type PickupRequestFormProps = {
  bookingId: string;
  defaultTimingPreference: "asap" | "specific_date";
  defaultRequestedDate: string;
  defaultAccessConfirmed: boolean;
  defaultNotes: string;
  minDate: string;
  action: (formData: FormData) => void | Promise<void>;
};

export function PickupRequestForm({
  bookingId,
  defaultTimingPreference,
  defaultRequestedDate,
  defaultAccessConfirmed,
  defaultNotes,
  minDate,
  action,
}: PickupRequestFormProps) {
  const [timingPreference, setTimingPreference] = useState<"asap" | "specific_date">(
    defaultTimingPreference,
  );

  const requestedDateValue = useMemo(() => {
    if (timingPreference !== "specific_date") return "";
    return defaultRequestedDate;
  }, [defaultRequestedDate, timingPreference]);

  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="step" value="review" />

      <fieldset className="space-y-3">
        <legend className="text-sm font-semibold text-slate-900">Pickup timing preference</legend>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
          <input
            type="radio"
            name="timing_preference"
            value="asap"
            checked={timingPreference === "asap"}
            onChange={() => setTimingPreference("asap")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">As soon as possible</span>
            <span className="mt-1 block text-sm text-slate-500">
              We&apos;ll review availability and confirm the next open pickup window.
            </span>
          </span>
        </label>
        <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
          <input
            type="radio"
            name="timing_preference"
            value="specific_date"
            checked={timingPreference === "specific_date"}
            onChange={() => setTimingPreference("specific_date")}
            className="mt-1"
          />
          <span>
            <span className="block text-sm font-semibold text-slate-900">On a specific date</span>
            <span className="mt-1 block text-sm text-slate-500">
              Tell us your preferred date and we&apos;ll review scheduling.
            </span>
          </span>
        </label>
      </fieldset>

      {timingPreference === "specific_date" ? (
        <div>
          <label htmlFor="requested_pickup_date" className="text-sm font-semibold text-slate-900">
            Requested pickup date
          </label>
          <input
            id="requested_pickup_date"
            name="requested_pickup_date"
            type="date"
            min={minDate}
            defaultValue={requestedDateValue}
            className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
          />
        </div>
      ) : null}

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
        <input
          type="checkbox"
          name="access_confirmed"
          defaultChecked={defaultAccessConfirmed}
          className="mt-1"
          required
        />
        <span className="text-sm text-slate-700">
          <span className="block font-semibold text-slate-900">
            The dumpster is accessible for pickup
          </span>
          <span className="mt-1 block text-slate-500">
            Confirm there are no parked cars, locked gates, or blocked approaches preventing pickup.
          </span>
        </span>
      </label>

      <div>
        <label htmlFor="notes" className="text-sm font-semibold text-slate-900">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          defaultValue={defaultNotes}
          placeholder="Gate code, parked cars, special instructions"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        />
      </div>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Review pickup request
      </button>
    </form>
  );
}
