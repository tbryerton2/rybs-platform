"use client";

import {
  EXTENSION_REQUEST_MAX_DAYS,
  EXTENSION_REQUEST_MIN_DAYS,
  EXTENSION_REQUEST_NOTES_MAX_LENGTH,
} from "@/lib/rental-action-requests";

type ExtensionReasonOption =
  | ""
  | "project_running_long"
  | "weather_delay"
  | "waiting_on_contractor"
  | "more_cleanup_needed"
  | "other";

type ExtensionRequestFormProps = {
  bookingId: string;
  defaultRequestedExtraDays: string;
  defaultReason: ExtensionReasonOption;
  defaultNotes: string;
  defaultAcknowledgePossibleFees: boolean;
  action: (formData: FormData) => void | Promise<void>;
};

export function ExtensionRequestForm({
  bookingId,
  defaultRequestedExtraDays,
  defaultReason,
  defaultNotes,
  defaultAcknowledgePossibleFees,
  action,
}: ExtensionRequestFormProps) {
  return (
    <form action={action} className="mt-8 space-y-6">
      <input type="hidden" name="booking_id" value={bookingId} />
      <input type="hidden" name="step" value="review" />

      <div>
        <label htmlFor="requested_extra_days" className="text-sm font-semibold text-slate-900">
          Extra days needed
        </label>
        <input
          id="requested_extra_days"
          name="requested_extra_days"
          type="number"
          inputMode="numeric"
          min={EXTENSION_REQUEST_MIN_DAYS}
          max={EXTENSION_REQUEST_MAX_DAYS}
          step={1}
          defaultValue={defaultRequestedExtraDays}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        />
        <div className="mt-2 text-xs text-slate-500">
          Choose between {EXTENSION_REQUEST_MIN_DAYS} and {EXTENSION_REQUEST_MAX_DAYS} extra days.
        </div>
      </div>

      <div>
        <label htmlFor="reason" className="text-sm font-semibold text-slate-900">
          Reason
        </label>
        <select
          id="reason"
          name="reason"
          defaultValue={defaultReason}
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        >
          <option value="">Select a reason</option>
          <option value="project_running_long">Project running long</option>
          <option value="weather_delay">Weather delay</option>
          <option value="waiting_on_contractor">Waiting on contractor</option>
          <option value="more_cleanup_needed">More cleanup needed</option>
          <option value="other">Other</option>
        </select>
      </div>

      <div>
        <label htmlFor="notes" className="text-sm font-semibold text-slate-900">
          Notes
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={4}
          maxLength={EXTENSION_REQUEST_NOTES_MAX_LENGTH}
          defaultValue={defaultNotes}
          placeholder="Project update, timing context, or anything our team should know"
          className="mt-2 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-slate-400 focus:bg-white"
        />
        <div className="mt-2 text-xs text-slate-500">
          Optional. Up to {EXTENSION_REQUEST_NOTES_MAX_LENGTH} characters.
        </div>
      </div>

      <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-4 py-4">
        <input
          type="checkbox"
          name="acknowledge_possible_fees"
          defaultChecked={defaultAcknowledgePossibleFees}
          className="mt-1"
          required
        />
        <span className="text-sm text-slate-700">
          <span className="block font-semibold text-slate-900">
            I understand added rental time may include additional charges
          </span>
          <span className="mt-1 block text-slate-500">
            Our team will review availability, routing, and any pricing impact before confirming.
          </span>
        </span>
      </label>

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
      >
        Review extension request
      </button>
    </form>
  );
}
