"use client";

import { useState } from "react";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { updatePickupDetailsAction } from "./actions";

type Props = {
  bookingId: string;
  initialPickupMode: "request" | "schedule";
  initialPickupDate: string;
};

export default function PickupDetailsForm({
  bookingId,
  initialPickupMode,
  initialPickupDate,
}: Props) {
  const [pickupMode, setPickupMode] = useState<"request" | "schedule">(initialPickupMode);
  const [pickupDate, setPickupDate] = useState(initialPickupDate);

  return (
    <form action={updatePickupDetailsAction} className="space-y-4" autoComplete="off">
      <input type="hidden" name="id" value={bookingId} />

      <div className="grid gap-4 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Pickup mode
          </span>
          <select
            name="pickup_mode"
            value={pickupMode}
            onChange={(event) => {
              const nextMode = event.target.value as "request" | "schedule";
              setPickupMode(nextMode);
              if (nextMode !== "schedule") {
                setPickupDate("");
              }
            }}
            className="h-12 w-full rounded-2xl border border-slate-300 px-4 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-400"
          >
            <option value="request">Request</option>
            <option value="schedule">Scheduled</option>
          </select>
        </label>

        <label className="block">
          <span className="mb-1.5 block text-sm font-medium text-slate-700">
            Pickup date
          </span>

          <div className="h-12 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-sm">
            {pickupMode === "schedule" ? (
              <input
                type="date"
                name="pickup_date"
                value={pickupDate}
                onChange={(event) => setPickupDate(event.target.value)}
                className="h-full w-full border-0 bg-transparent px-4 text-sm text-slate-900 outline-none"
              />
            ) : (
              <>
                <input type="hidden" name="pickup_date" value="" />
                <div className="flex h-full w-full items-center px-4 text-sm text-slate-400">
                  —
                </div>
              </>
            )}
          </div>
        </label>
      </div>

      <FormSubmitButton
        loadingLabel="Saving pickup details..."
        className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
      >
        Save pickup details
      </FormSubmitButton>
    </form>
  );
}
