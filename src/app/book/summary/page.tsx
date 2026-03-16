"use client";

import { useEffect, useState } from "react";
import { StepHeader } from "@/components/StepHeader";

type Booking = {
  zip?: string;
  county?: string;
  town?: string;
};

export default function SummaryStepPage() {
  const [booking, setBooking] = useState<Booking | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem("tcm.booking");
    if (!raw) return;
    try {
      setBooking(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <main className="space-y-6">
      <StepHeader step={5} total={5} title="Book Your Dumpster" subtitle="Price summary" />

      <section className="rounded-lg border p-4 space-y-4">
        {/* Location summary (from ZIP validation) */}
        <div className="rounded-md border p-3 text-sm">
          <div className="font-medium">Service address (v1)</div>
          {booking?.zip ? (
            <div className="text-muted-foreground">
              ZIP <span className="font-medium text-foreground">{booking.zip}</span>
              {booking.town || booking.county ? (
                <>
                  {" "}
                  — {booking.town ? booking.town : "Town"}{booking.county ? `, ${booking.county} County` : ""}
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground">
              No ZIP saved yet. Please go back and validate your ZIP.
            </div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">Flat-rate total (prepay)</div>
          <div className="text-3xl font-semibold">$XXX</div>
          <div className="text-xs text-muted-foreground">(We’ll wire real pricing next.)</div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium">What’s included</div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            <li>Delivery &amp; pickup</li>
            <li>7-day rental</li>
            <li>2.5 tons included</li>
          </ul>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium">Included Weight Policy</div>
          <p className="text-sm text-muted-foreground">
            Your flat rate includes up to{" "}
            <span className="font-medium text-foreground">2.5 tons</span>. Overages are billed only if exceeded.
          </p>
          <p className="text-sm text-muted-foreground">Most homeowners stay under the included weight.</p>
        </div>

        <a
          className={`block rounded-md bg-black px-4 py-3 text-center text-white ${
            booking?.zip ? "" : "pointer-events-none opacity-50"
          }`}
          href="/checkout"
        >
          Proceed to Secure Payment
        </a>

        <a className="block text-center text-sm underline" href="/book/pickup">
          Back
        </a>

        {!booking?.zip && (
          <a className="block text-center text-sm underline" href="/book/address">
            Go validate ZIP
          </a>
        )}
      </section>
    </main>
  );
}