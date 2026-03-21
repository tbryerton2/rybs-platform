// src/app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatUsdFromCents } from "@/lib/money";
import { getReorderNotice } from "@/lib/reorder";
import {
  getAccessIssueLabel,
  getDeliveryPresenceLabel,
  getPlacementPreferenceLabel,
  sanitizePlacementDetails,
  type AccessIssue,
  type DeliveryPresence,
  type PlacementPreference,
} from "@/lib/placement";

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
  placementPreference?: PlacementPreference | null;
  placementDetails?: string | null;
  accessIssues?: AccessIssue[];
  gateInstructions?: string | null;
  deliveryPresence?: DeliveryPresence | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;

  deliveryDate?: string;

  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;

  rentalDays?: number; // default fallback = 7

  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD (optional)
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function formatDateLong(ymd: string) {
  if (!isYMD(ymd)) return ymd || "—";
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "2-digit",
    year: "numeric",
  }).format(dt);
}

function formatPhoneUS(input: string) {
  const digits = (input || "").replace(/\D/g, "");
  if (!digits) return "—";

  // handle leading country code
  const d = digits.length === 11 && digits.startsWith("1") ? digits.slice(1) : digits;

  // only format clean 10-digit US numbers
  if (d.length !== 10) return input.trim() || "—";

  const area = d.slice(0, 3);
  const mid = d.slice(3, 6);
  const last = d.slice(6);
  return `(${area}) ${mid}-${last}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const [draft, setDraft] = useState<BookingDraft>({});
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("tcm.booking");
      if (!raw) {
        setHydrated(true);
        return;
      }
      setDraft(JSON.parse(raw));
    } catch {
      // ignore
    } finally {
      setHydrated(true);
    }
  }, []);

  // Tick every 1s so we can disable payment instantly when the hold expires
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    // Don't redirect until we've actually loaded sessionStorage
    if (!hydrated) return;

    if (!draft.holdId || !draft.holdExpiresAt) {
      router.replace("/book/date");
      return;
    }

    const expires = Date.parse(draft.holdExpiresAt);
    if (!Number.isFinite(expires) || expires <= nowMs) {
      router.replace("/book/date");
    }
  }, [hydrated, draft.holdId, draft.holdExpiresAt, nowMs, router]);


  const deliveryDateLabel = useMemo(
    () => formatDateLong((draft.deliveryDate || "").trim()),
    [draft.deliveryDate]
  );

  const pickupLabel = useMemo(() => {
    const mode = draft.pickupMode || "unspecified";
    const pd = (draft.pickupDate || "").trim();

    if (mode === "date" && isYMD(pd)) return formatDateLong(pd);

    // IMPORTANT: we are NOT showing the “default 7-day” assumption to the user.
    return "Schedule later (from confirmation link)";
  }, [draft.pickupMode, draft.pickupDate]);

  const placementDetails = useMemo(
    () =>
      sanitizePlacementDetails({
        placementPreference: draft.placementPreference ?? null,
        placementDetails: draft.placementDetails ?? null,
        accessIssues: draft.accessIssues ?? [],
        gateInstructions: draft.gateInstructions ?? null,
        deliveryPresence: draft.deliveryPresence ?? null,
        alternateContactName: draft.alternateContactName ?? null,
        alternateContactPhone: draft.alternateContactPhone ?? null,
        placementPhotoUrl: draft.placementPhotoUrl ?? null,
        specialDeliveryInstructions: draft.specialDeliveryInstructions ?? null,
      }),
    [draft],
  );

  const holdExpiresAtMs = useMemo(() => {
    const iso = (draft.holdExpiresAt || "").trim();
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }, [draft.holdExpiresAt]);

  const secondsLeft = useMemo(() => {
    if (!holdExpiresAtMs) return null;
    return Math.floor((holdExpiresAtMs - nowMs) / 1000);
  }, [holdExpiresAtMs, nowMs]);

  const holdExpired = useMemo(() => {
    if (secondsLeft == null) return false;
    return secondsLeft <= 0;
  }, [secondsLeft]);

  async function handleSimulatePayment() {
    setError(null);

    if (holdExpired) {
      setError("Your hold has expired. Please choose a new delivery date.");
      return;
    }

    if (!draft.holdId) {
      setError("Your session has expired. Please start again.");
      return;
    }

    // ✅ Ensure we have a valid YYYY-MM-DD delivery date to send to the API
    const deliveryDateYMD = (draft.deliveryDate || draft.holdDeliveryDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateYMD)) {
      setError("Delivery date is missing or invalid. Please go back and choose a new delivery date.");
      return;
    }

    setIsPaying(true);

    try {
      // 🔒 Validate hold before payment
      const validateRes = await fetch("/api/validate-hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdId: draft.holdId }),
      });

      const validateJson = await validateRes.json().catch(() => ({}));

      if (!validateRes.ok || !validateJson?.valid) {
        setError("Your hold has expired. Please choose a new delivery date.");
        return;
      }

      // 💳 Simulate payment
      await new Promise((r) => setTimeout(r, 600));

      // ✅ Convert hold -> booking
      const confirmRes = await fetch("/api/confirm-booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          holdId: draft.holdId,
          deliveryDate: deliveryDateYMD, // ✅ IMPORTANT: send YYYY-MM-DD explicitly
          bookingDraft: draft,
          totalPriceCents: totalCents,
        }),
      });

      const confirmJson = await confirmRes.json().catch(() => ({}));

      if (!confirmRes.ok || !confirmJson?.ok) {
        setError(
          confirmJson?.error || "We couldn't confirm your booking. Please try again."
        );
        return;
      }

      if (confirmJson?.placementPersistenceSkipped) {
        try {
          sessionStorage.setItem(
            "tcm.last-booking-warning",
            JSON.stringify({
              bookingId: confirmJson.bookingId || draft.holdId,
              type: "placement-persistence-skipped",
              message: confirmJson.warning,
            }),
          );
        } catch {
          // ignore
        }
      } else {
        try {
          sessionStorage.removeItem("tcm.last-booking-warning");
        } catch {
          // ignore
        }
      }

      // 🧹 Clear draft now that booking is confirmed
      try {
        sessionStorage.removeItem("tcm.booking");
      } catch {
        // ignore
      }

      // 🚀 Redirect to success page
      const bookingId = confirmJson.bookingId || draft.holdId;
      const bookingRef = String(confirmJson.bookingRef ?? "").trim();
      const bookingEmail = String(confirmJson.customerEmail ?? draft.customerEmail ?? "").trim();
      const nextParams = new URLSearchParams({
        bookingId: String(bookingId),
        ...(bookingRef ? { bookingRef } : {}),
        ...(bookingEmail ? { email: bookingEmail } : {}),
      });
      router.push(`/success?${nextParams.toString()}`);
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  }

  if (!hydrated) return null;

  const subtotalCents = 49900; // TODO: replace with real pricing later
  const salesTaxRate = 0.08;
  const salesTaxCents = Math.round(subtotalCents * salesTaxRate);
  const feesCents = 0; // TODO: fees later
  const totalCents = subtotalCents + salesTaxCents + feesCents;
  const fmtMoney = (cents: number) => formatUsdFromCents(cents);
    
  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          {/* Header stack (match other steps) */}
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 6 of 6
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-full rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Checkout</h1>
            <p className="text-[#475569]">Complete your booking.</p>
          </div>

          <section className="mt-8 space-y-6">
            {/* Order summary */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">Order summary</div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">Dumpster rental</span>
                  <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">
                    {fmtMoney(subtotalCents)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-600">NY sales tax (8%)</span>
                  <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">
                    {fmtMoney(salesTaxCents)}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-between text-sm">
                  <span className="text-slate-600">Fees</span>
                  <span className="w-24 text-right font-semibold text-slate-900 tabular-nums">
                    {fmtMoney(feesCents)}
                  </span>
                </div>

                <div className="mt-4 border-t border-slate-200 pt-3 flex items-center justify-between">
                  <span className="text-base font-semibold text-slate-900">Total</span>
                  <span className="w-24 text-right text-base font-semibold text-slate-900 tabular-nums">
                    {fmtMoney(totalCents)}
                  </span>
                </div>
              </div>

            <div className="mt-4 grid gap-4">
                {draft.reorderSourceBookingId ? (
                  <div className="rounded-2xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm leading-6 text-slate-700">
                    <div className="font-semibold text-slate-900">New booking based on a previous rental</div>
                    <div className="mt-1">
                      {getReorderNotice(draft.reorderSourceBookingRef)}
                    </div>
                  </div>
                ) : null}

                {/* 1) Contact */}
                {/* Contact */}
                <div className="rounded-2xl border border-slate-200 bg-white p-5">
                  <div className="text-sm font-semibold text-slate-900">Contact</div>

                  <div className="mt-3 space-y-2 text-sm">
                    <div className="flex items-baseline">
                      <span className="w-16 text-slate-500">Name:</span>
                      <span className="font-medium text-slate-900">
                        {(draft.customerName || "").trim() || "—"}
                      </span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="w-16 text-slate-500">Email:</span>
                      <span className="font-medium text-slate-900 break-all">
                        {(draft.customerEmail || "").trim() || "—"}
                      </span>
                    </div>

                    <div className="flex items-baseline">
                      <span className="w-16 text-slate-500">Phone:</span>
                      <span className="font-medium text-slate-900 tabular-nums">
                        {formatPhoneUS((draft.customerPhone || "").trim())}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 2) Address */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Address</div>
                  <div className="mt-2 text-slate-700">
                    {(draft.customerStreet || "").trim() || "—"}
                    <br />
                    {(draft.customerCity || "").trim() || "—"}
                    {draft.customerZip ? `, NY ${draft.customerZip}` : ", NY"}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Placement & access</div>
                  <div className="mt-2 space-y-2 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-500">Placement:</span>{" "}
                      <span className="font-medium text-slate-900">
                        {getPlacementPreferenceLabel(placementDetails.placementPreference)}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Drop area:</span>{" "}
                      <span className="font-medium text-slate-900">
                        {placementDetails.placementDetails || "—"}
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-500">Delivery presence:</span>{" "}
                      <span className="font-medium text-slate-900">
                        {getDeliveryPresenceLabel(placementDetails.deliveryPresence)}
                      </span>
                    </div>
                    {placementDetails.accessIssues.length ? (
                      <div>
                        <span className="text-slate-500">Access issues:</span>{" "}
                        <span className="font-medium text-slate-900">
                          {placementDetails.accessIssues.map(getAccessIssueLabel).join(", ")}
                        </span>
                      </div>
                    ) : null}
                    {placementDetails.gateInstructions ? (
                      <div>
                        <span className="text-slate-500">Gate / access:</span>{" "}
                        <span className="font-medium text-slate-900">{placementDetails.gateInstructions}</span>
                      </div>
                    ) : null}
                    {placementDetails.alternateContactName || placementDetails.alternateContactPhone ? (
                      <div>
                        <span className="text-slate-500">Alternate contact:</span>{" "}
                        <span className="font-medium text-slate-900">
                          {[placementDetails.alternateContactName, formatPhoneUS(placementDetails.alternateContactPhone || "")]
                            .filter((value) => value && value !== "—")
                            .join(" • ")}
                        </span>
                      </div>
                    ) : null}
                    {placementDetails.specialDeliveryInstructions ? (
                      <div>
                        <span className="text-slate-500">Special instructions:</span>{" "}
                        <span className="font-medium text-slate-900">
                          {placementDetails.specialDeliveryInstructions}
                        </span>
                      </div>
                    ) : null}
                    {placementDetails.placementPhotoUrl ? (
                      <div className="pt-1">
                        <a
                          href={placementDetails.placementPhotoUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm font-semibold text-[#F97316] hover:underline"
                        >
                          View placement photo
                        </a>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* 3) Delivery date */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Delivery date</div>
                  <div className="mt-1 text-slate-700">{deliveryDateLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    We’ll contact you with the exact delivery time.
                  </div>
                </div>

                {/* 4) Pickup date */}
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="text-sm font-semibold text-slate-900">Pickup</div>
                  <div className="mt-1 text-slate-700">{pickupLabel}</div>
                  <div className="mt-1 text-xs text-slate-500">24-hour notice required.</div>
                </div>
              </div>
            </div>

            {/* Payment placeholder */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">Payment</div>
              <p className="mt-1 text-sm text-slate-600">
                Secure payment processing. Your dumpster will be officially booked after successful payment.
              </p>

              <div className="mt-4">

                {holdExpired && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    ❌ Your delivery date hold has expired. Please go back and choose a new delivery date.
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSimulatePayment}
                  disabled={isPaying || holdExpired}
                  className="group w-full h-14 rounded-2xl bg-[#0F172A] text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#0B1220] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="flex items-center justify-center gap-2">
                    {isPaying ? "Processing..." : "Simulate successful payment"}
                    <span className="transition-transform group-hover:translate-x-1 text-white/90">→</span>
                  </span>
                </button>

                {holdExpired && (
                  <button
                    type="button"
                    onClick={() => router.push("/book/date")}
                    className="mt-3 w-full h-12 rounded-2xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-slate-50"
                  >
                    Choose a new delivery date
                  </button>
                )}

                <div className="mt-5 text-xs text-slate-500 text-center">
                  You will receive a confirmation email immediately after booking.
                </div>
              </div>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {error}
              </div>
            )}

            <a
              href="/confirm"
              className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
            >
              ← Back
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
