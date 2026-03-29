"use client";

import { useState } from "react";
import { StepHeader } from "@/components/StepHeader";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type PickupPreference = "request" | "scheduled";

type PickupStepPageClientProps = {
  content: {
    title: string;
    subtitle: string;
    requestOptionTitle: string;
    requestOptionDescription: string;
    scheduledOptionTitle: string;
    scheduledOptionDescription: string;
    pickupDateLabel: string;
  };
};

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

export default function PickupStepPageClient({ content }: PickupStepPageClientProps) {
  const [initialDraft] = useState(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [preference, setPreference] = useState<PickupPreference>(
    initialDraft?.pickupPreference === "scheduled" ? "scheduled" : "request",
  );
  const [pickupDate, setPickupDate] = useState(
    typeof initialDraft?.pickupDate === "string" ? initialDraft.pickupDate : "",
  );

  function savePickup(update: Partial<{ pickupPreference: PickupPreference; pickupDate: string }>) {
    const raw = sessionStorage.getItem(getBookingStorageKey());
    const data = raw ? JSON.parse(raw) : {};
    Object.assign(data, update);
    sessionStorage.setItem(getBookingStorageKey(), JSON.stringify(data));
  }

  return (
    <main className="space-y-6">
      <StepHeader step={4} total={5} title={content.title} subtitle={content.subtitle} />

      <section className="rounded-lg border p-4 space-y-4">
        <label className="rounded-md border p-3 flex gap-3 items-start">
          <input
            type="radio"
            name="pickup"
            checked={preference === "request"}
            onChange={() => {
              setPreference("request");
              savePickup({ pickupPreference: "request", pickupDate: "" });
            }}
            className="mt-1"
          />
          <div>
            <div className="font-medium">{content.requestOptionTitle}</div>
            <div className="text-sm text-muted-foreground">
              {content.requestOptionDescription}
            </div>
          </div>
        </label>

        <label className="rounded-md border p-3 flex gap-3 items-start">
          <input
            type="radio"
            name="pickup"
            checked={preference === "scheduled"}
            onChange={() => {
              setPreference("scheduled");
              savePickup({ pickupPreference: "scheduled" });
            }}
            className="mt-1"
          />
          <div className="w-full space-y-2">
            <div>
              <div className="font-medium">{content.scheduledOptionTitle}</div>
              <div className="text-sm text-muted-foreground">
                {content.scheduledOptionDescription}
              </div>
            </div>

            {preference === "scheduled" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">{content.pickupDateLabel}</label>
                <input
                  type="date"
                  className="w-full rounded-md border px-3 py-2"
                  value={pickupDate}
                  onChange={(e) => {
                    setPickupDate(e.target.value);
                    savePickup({ pickupDate: e.target.value });
                  }}
                />
              </div>
            )}
          </div>
        </label>

        <a
          className={`block rounded-md bg-black px-4 py-3 text-center text-white ${
            preference === "scheduled" && !pickupDate ? "pointer-events-none opacity-50" : ""
          }`}
          href="/book/summary"
        >
          Continue
        </a>

        <a className="block text-center text-sm underline" href="/book/date">
          Back
        </a>
      </section>
    </main>
  );
}
