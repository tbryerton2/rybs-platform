/* eslint-disable react-hooks/set-state-in-effect */
// src/app/book/date/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { getHoldMinutes } from "@/lib/config";

type BookingDraft = {
  zip?: string;
  county?: string;
  town?: string;

  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerZip?: string;
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;

  deliveryDate?: string;

  // hold info (created on step 2)
  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;

  // pickup fields (used later on confirm/checkout)
  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD

  maxPickupDate?: string;          // YYYY-MM-DD (only when capped)
  maxDaysAllowed?: number;         // number
  limitedAck?: boolean;            // user checkbox
};

type AvailState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; remaining: number }
  | { state: "none" }
  | { state: "error"; message: string };

type HoldState =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "error"; message: string };

export default function DateStepPage() {
  const router = useRouter();
    const holdMinutes = getHoldMinutes();

  const [deliveryDate, setDeliveryDate] = useState(""); // YYYY-MM-DD (from <input type="date">)
  const [availability, setAvailability] = useState<AvailState>({ state: "idle" });
  const [hold, setHold] = useState<HoldState>({ state: "idle" });
  const [cap, setCap] = useState<null | { maxPickupDate: string; maxDaysAllowed: number }>(null);
  const [limitedAck, setLimitedAck] = useState(false);

  // Load saved date (if user navigates back)
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      if (!raw) return;
      const data: BookingDraft = JSON.parse(raw);
      if (data?.deliveryDate) setDeliveryDate(data.deliveryDate);
      setLimitedAck(Boolean(data?.limitedAck));
    } catch {
      // ignore
    }
  }, []);

  // Normalize (future-proof if we ever change date input type)
  const normalizedDate = useMemo(() => (deliveryDate || "").trim(), [deliveryDate]);

  function hasActiveHoldForDate(draft: Partial<BookingDraft>, selectedDeliveryYMD: string) {
    const holdId = (draft?.holdId || "").trim();
    const holdDelivery = (draft?.holdDeliveryDate || "").trim(); // should be YYYY-MM-DD
    const expiresAt = (draft?.holdExpiresAt || "").trim();

    if (!holdId || !holdDelivery || !expiresAt) return false;
    if (holdDelivery !== selectedDeliveryYMD) return false;

    const ms = Date.parse(expiresAt);
    if (!Number.isFinite(ms)) return false;

    return ms > Date.now();
  }

  // When date changes, check availability
  useEffect(() => {
    const d = normalizedDate;

    // No date picked yet
    if (!d) {
      setAvailability({ state: "idle" });
      return;
    }

    // Invalid format (shouldn't happen with type="date", but safe)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      setAvailability({ state: "error", message: "Please select a valid date." });
      return;
    }

    let cancelled = false;

    (async () => {
      setAvailability({ state: "loading" });

      // ✅ immediately reset cap + ack for the newly selected date
      setCap(null);
      setLimitedAck(false);

      try {
        const res = await fetch(`/api/availability?date=${encodeURIComponent(d)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setAvailability({
            state: "error",
            message: json?.error || "Availability check failed.",
          });
          return;
        }

        const remaining = Number(json?.remaining ?? 0);

        if (!Number.isFinite(remaining) || remaining <= 0) {
          setAvailability({ state: "none" });

          // ✅ clear cap so it can’t “stick” from a previous date
          setCap(null);
          setLimitedAck(false);

          // ✅ clear persisted cap/ack
          const raw = sessionStorage.getItem("tcm.booking");
          const existing: BookingDraft = raw ? JSON.parse(raw) : {};
          sessionStorage.setItem(
            "tcm.booking",
            JSON.stringify({
              ...existing,
              maxPickupDate: undefined,
              maxDaysAllowed: undefined,
              limitedAck: false,
            })
          );

        } else {
          setAvailability({ state: "ok", remaining });

          const capRes = await fetch(`/api/pickup-cap?deliveryDate=${encodeURIComponent(d)}`, {
            cache: "no-store",
          });
          const capJson = await capRes.json().catch(() => ({}));

          if (capRes.ok && capJson?.ok && capJson?.capped) {
            setCap({ maxPickupDate: capJson.maxPickupDate, maxDaysAllowed: capJson.maxDaysAllowed });
            setLimitedAck(false);

            const raw = sessionStorage.getItem("tcm.booking");
            const existing: BookingDraft = raw ? JSON.parse(raw) : {};

            const maxPickupDate = String(capJson.maxPickupDate || "").trim();

            // If they already had a pickup date saved and it’s too late, clamp it.
            // If they don’t have one, FORCE it to maxPickupDate so checkout can’t fail later.
            const existingPickup = (existing.pickupDate || "").trim();
            const forcedPickup = !existingPickup || existingPickup > maxPickupDate
              ? maxPickupDate
              : existingPickup;

            sessionStorage.setItem(
              "tcm.booking",
              JSON.stringify({
                ...existing,
                maxPickupDate,
                maxDaysAllowed: capJson.maxDaysAllowed,
                limitedAck: false,

                // ✅ enforce cap immediately
                pickupMode: "date",
                pickupDate: forcedPickup,
              })
            );
          } else {
            setCap(null);
            setLimitedAck(false);

            const raw = sessionStorage.getItem("tcm.booking");
            const existing: BookingDraft = raw ? JSON.parse(raw) : {};
            sessionStorage.setItem(
              "tcm.booking",
              JSON.stringify({
                ...existing,
                maxPickupDate: undefined,
                maxDaysAllowed: undefined,
                limitedAck: false,
                pickupMode: "unspecified",
                pickupDate: undefined,
              })
            );
          }
        }

      } catch (e: unknown) {
        if (cancelled) return;
        const message = e instanceof Error ? e.message : "Availability check failed.";
        setAvailability({
          state: "error",
          message,
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [normalizedDate]);

  const canContinue =
    /^\d{4}-\d{2}-\d{2}$/.test(normalizedDate) &&
    availability.state === "ok" &&
    availability.remaining > 0 &&
    hold.state !== "creating" &&
    (!cap || limitedAck); // ✅ require ack only when capped;

  async function handleContinue() {
    const d = normalizedDate;

    // guard
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return;

    // ✅ if we already have an active hold for this same date, reuse it
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      if (hasActiveHoldForDate(existing, d)) {
        router.push("/confirm");
        return;
      }
    } catch {
      // ignore and continue to create a hold
    }

  

    // must have availability
    if (availability.state !== "ok" || availability.remaining <= 0) {
      setHold({
        state: "error",
        message: "Sorry — that date is unavailable. Please pick another date.",
      });
      return;
    }

    setHold({ state: "creating" });

    let zip = "";
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      zip = (existing.zip || "").trim(); // assuming Step 1 saved it as `zip`
    } catch {
      zip = "";
    }

    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: d,
          rentalDays: cap ? cap.maxDaysAllowed : 7,
          zip,
        }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setHold({
          state: "error",
          message:
            json?.error ||
            "Sorry — we couldn’t place a hold. Please pick another date and try again.",
        });
        return;
      }

      // Save hold + date in booking draft
      const raw = sessionStorage.getItem("tcm.booking");
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      sessionStorage.setItem(
        "tcm.booking",
        JSON.stringify({
          ...existing,
          deliveryDate: d,
          holdId: json.holdId,
          holdDeliveryDate: d,
          holdExpiresAt: json.expiresAt,
        })
      );

      setHold({ state: "idle" });
      router.push("/confirm");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Hold failed. Please try again.";
      setHold({
        state: "error",
        message,
      });
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          {/* Header stack (match Step 1 style) */}
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 4 of 6
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-[66.667%] rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">
              Book Your Dumpster
            </h1>

            <p className="text-[#475569]">Choose your delivery date.</p>
          </div>

          <section className="mt-8">
            <div className="mx-auto w-full max-w-[640px] grid gap-6 [&>*]:w-full">
              {/* Availability banner */}
              {availability.state === "loading" && (
                <div className="w-full rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                  Checking availability…
                </div>
              )}

              {availability.state === "ok" && (
                <div className="w-full rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  ✅ <span className="font-semibold">{availability.remaining}</span>{" "}
                  available for this date.
                </div>
              )}

              {cap && (
                <div className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 space-y-3">
                  <div className="font-semibold">
                    Limited availability: this dumpster is only available for {cap.maxDaysAllowed} days.
                  </div>
                  <div>Pickup must be by <span className="font-semibold">{cap.maxPickupDate}</span>.</div>

                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={limitedAck}
                      onChange={(e) => {
                        const v = e.target.checked;
                        setLimitedAck(v);
                        const raw = sessionStorage.getItem("tcm.booking");
                        const existing: BookingDraft = raw ? JSON.parse(raw) : {};
                        sessionStorage.setItem("tcm.booking", JSON.stringify({ ...existing, limitedAck: v }));
                      }}
                    />
                    <span>I understand my rental must end by {cap.maxPickupDate}.</span>
                  </label>
                </div>
              )}

              {availability.state === "none" && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  ❌ No dumpsters available for this date. Please pick another date.
                </div>
              )}

              {availability.state === "error" && (
                <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-900">
                  {availability.message}
                </div>
              )}

              {/* Date input */}
              <div className="w-full space-y-2">
                <label className="text-sm font-medium text-slate-700">
                  Select delivery date
                </label>
                <div className="w-full h-12 rounded-xl border border-slate-300 bg-white overflow-hidden shadow-sm transition focus-within:border-[#F97316] focus-within:ring-4 focus-within:ring-[#F97316]/15">
                  <input
                    type="date"
                    value={deliveryDate}
                    onChange={(e) => {
                      const d = e.target.value;
                      setDeliveryDate(d);

                      const raw = sessionStorage.getItem("tcm.booking");
                      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

                      sessionStorage.setItem(
                        "tcm.booking",
                        JSON.stringify({
                          ...existing,
                          deliveryDate: d,

                          holdId: undefined,
                          holdDeliveryDate: undefined,
                          holdExpiresAt: undefined,

                          maxPickupDate: undefined,
                          maxDaysAllowed: undefined,
                          limitedAck: false,

                          pickupMode: "unspecified",
                          pickupDate: undefined,
                        })
                      );

                      setHold({ state: "idle" });
                    }}
                    className="h-full w-full bg-transparent px-4 text-slate-900 outline-none appearance-none"
                  />
                </div>
              </div>

              {/* Note */}
              <div className="w-full rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                Note: Continuing will create a temporary {holdMinutes}-minute hold.
              </div>

              {/* Continue */}
              <div className="w-full grid gap-2">
                <button
                  type="button"
                  disabled={!canContinue}
                  onClick={handleContinue}
                  className="group w-full h-14 rounded-2xl bg-[#F97316] text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    {hold.state === "creating" ? "Holding..." : "Continue"}
                    <span className="transition-transform group-hover:translate-x-1 text-white/90">
                      →
                    </span>
                  </span>
                </button>
              </div>

              {/* Hold errors (race condition / unavailable) */}
              {hold.state === "error" && (
                <div className="w-full rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                  {hold.message}
                </div>
              )}

              <div className="w-full">
                <a
                  href="/book/placement"
                  className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
                >
                  ← Back
                </a>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
