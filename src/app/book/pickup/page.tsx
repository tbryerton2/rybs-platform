"use client";

import { useEffect, useState } from "react";
import { StepHeader } from "@/components/StepHeader";

type PickupPreference = "request" | "scheduled";

export default function PickupStepPage() {
  const [preference, setPreference] = useState<PickupPreference>("request");
  const [pickupDate, setPickupDate] = useState("");

  // Load saved pickup preference
  useEffect(() => {
    const raw = sessionStorage.getItem("tcm.booking");
    if (!raw) return;
    try {
      const data = JSON.parse(raw);
      if (data?.pickupPreference) setPreference(data.pickupPreference);
      if (data?.pickupDate) setPickupDate(data.pickupDate);
    } catch {}
  }, []);

  function savePickup(update: Partial<{ pickupPreference: PickupPreference; pickupDate: string }>) {
    const raw = sessionStorage.getItem("tcm.booking");
    const data = raw ? JSON.parse(raw) : {};
    Object.assign(data, update);
    sessionStorage.setItem("tcm.booking", JSON.stringify(data));
  }

  return (
    <main className="space-y-6">
      <StepHeader
        step={4}
        total={5}
        title="Book Your Dumpster"
        subtitle="Pickup preference"
      />

      <section className="rounded-lg border p-4 space-y-4">
        {/* Request pickup (default) */}
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
            <div className="font-medium">Request pickup when ready</div>
            <div className="text-sm text-muted-foreground">
              Most customers choose this.
            </div>
          </div>
        </label>

        {/* Scheduled pickup */}
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
              <div className="font-medium">Schedule pickup date</div>
              <div className="text-sm text-muted-foreground">
                Choose a specific date if you need it removed by a deadline.
              </div>
            </div>

            {preference === "scheduled" && (
              <div className="grid gap-2">
                <label className="text-sm font-medium">Pickup date</label>
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
            preference === "scheduled" && !pickupDate
              ? "pointer-events-none opacity-50"
              : ""
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