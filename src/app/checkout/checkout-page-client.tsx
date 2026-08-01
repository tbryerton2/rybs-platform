// src/app/checkout/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  priceQuoteMatchesSelection,
  type BookingPriceQuote,
} from "@/lib/booking-pricing";
import {
  CARD_ON_FILE_CONSENT_TEXT,
  CARD_ON_FILE_CONSENT_VERSION,
} from "@/lib/booking-terms";
import { formatUsdFromCents } from "@/lib/money";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type SquareTokenizeResult = {
  status: string;
  token?: string;
  errors?: Array<{
    message?: string;
    detail?: string;
  }>;
};

type SquareCard = {
  attach(selector: string): Promise<void>;
  tokenize(): Promise<SquareTokenizeResult>;
  destroy?: () => Promise<void> | void;
};

type SquarePayments = {
  card(): Promise<SquareCard>;
};

declare global {
  interface Window {
    Square?: {
      payments(applicationId: string, locationId: string): SquarePayments;
    };
  }
}

const SQUARE_ENVIRONMENT = (process.env.NEXT_PUBLIC_SQUARE_ENVIRONMENT || "").trim().toLowerCase();
const SQUARE_APPLICATION_ID = (process.env.NEXT_PUBLIC_SQUARE_APPLICATION_ID || "").trim();
const SQUARE_LOCATION_ID = (process.env.NEXT_PUBLIC_SQUARE_LOCATION_ID || "").trim();
const SQUARE_SCRIPT_ID = "square-web-payments-sdk";
const SQUARE_CARD_CONTAINER_ID = "square-card-container";
const ENABLE_SIMULATED_CHECKOUT = process.env.NEXT_PUBLIC_ENABLE_SIMULATED_CHECKOUT === "true";
const SQUARE_PRODUCTION_MODE = SQUARE_ENVIRONMENT === "production";
const SIMULATED_CHECKOUT_ALLOWED = ENABLE_SIMULATED_CHECKOUT && !SQUARE_PRODUCTION_MODE;
const PAYMENT_UNAVAILABLE_MESSAGE =
  "Online card payment is unavailable right now. Please contact us to complete your booking or try again later.";

function getSquareScriptSrc(environment: string) {
  if (environment === "production") return "https://web.squarecdn.com/v1/square.js";
  return "https://sandbox.web.squarecdn.com/v1/square.js";
}

function getSquareConfigStatus() {
  if (!SQUARE_ENVIRONMENT || !SQUARE_APPLICATION_ID || !SQUARE_LOCATION_ID) {
    return {
      configured: false,
      reason: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  if (SQUARE_ENVIRONMENT !== "sandbox" && SQUARE_ENVIRONMENT !== "production") {
    return {
      configured: false,
      reason: PAYMENT_UNAVAILABLE_MESSAGE,
    };
  }

  return {
    configured: true,
    reason: null,
  };
}

function loadSquareScript() {
  if (window.Square) return Promise.resolve();

  const scriptSrc = getSquareScriptSrc(SQUARE_ENVIRONMENT);
  const existingScript = document.getElementById(SQUARE_SCRIPT_ID) as HTMLScriptElement | null;

  if (existingScript?.dataset.loaded === "true") {
    return Promise.resolve();
  }

  return new Promise<void>((resolve, reject) => {
    const script = existingScript ?? document.createElement("script");

    const handleLoad = () => {
      script.dataset.loaded = "true";
      resolve();
    };
    const handleError = () => reject(new Error("Unable to load Square payment form."));

    script.addEventListener("load", handleLoad, { once: true });
    script.addEventListener("error", handleError, { once: true });

    if (!existingScript) {
      script.id = SQUARE_SCRIPT_ID;
      script.src = scriptSrc;
      script.async = true;
      document.head.appendChild(script);
    }
  });
}

function getTokenizationError(result: SquareTokenizeResult) {
  if (result.errors?.length) {
    return "Please check your card details and try again.";
  }

  return "We could not securely read your card details. Please try again.";
}

type BookingDraft = {
  zip?: string;
  county?: string;
  town?: string;
  dumpsterSize?: string;
  dumpsterProductId?: string | null;
  dumpsterDisplayName?: string;
  includedWeightTons?: number;
  tonOveragePrice?: number;
  includedRentalDays?: number;
  extraDayPrice?: number;
  basePrice?: number;
  customerFirstName?: string;
  customerLastName?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerStreet?: string;
  customerCity?: string;
  customerState?: string;
  customerZip?: string;

  deliveryDate?: string;

  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;
  priceQuote?: BookingPriceQuote | null;

  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD (optional)
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function formatDateCompact(ymd: string) {
  if (!isYMD(ymd)) return ymd || "—";
  const [y, m, d] = ymd.split("-").map((n) => Number(n));
  const dt = new Date(y, m - 1, d);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(dt);
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

function getCustomerDisplayName(draft: BookingDraft) {
  return (
    (draft.customerName || "").trim() ||
    `${(draft.customerFirstName || "").trim()} ${(draft.customerLastName || "").trim()}`.trim()
  );
}

function getLastBookingWarningStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.lastBookingWarning);
}

type CheckoutPageClientProps = {
  content: {
    title: string;
    description: string;
    orderSummaryTitle: string;
    reorderTitle: string;
    deliveryTimeNote: string;
    pickupNotice: string;
    paymentTitle: string;
    paymentDescription: string;
    paymentIdleLabel: string;
    paymentLoadingLabel: string;
    paymentProcessingLabel: string;
    paymentFooterNote: string;
    holdExpiredNotice: string;
    chooseNewDateLabel: string;
  };
};

export default function CheckoutPageClient({ content }: CheckoutPageClientProps) {
  const router = useRouter();
  const [draft, setDraft] = useState<BookingDraft>({});
  const [error, setError] = useState<string | null>(null);
  const [isPaying, setIsPaying] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [hydrated, setHydrated] = useState(false);
  const [squareCard, setSquareCard] = useState<SquareCard | null>(null);
  const [squareReady, setSquareReady] = useState(false);
  const [squareLoading, setSquareLoading] = useState(false);
  const [squareError, setSquareError] = useState<string | null>(null);
  const [squareFallbackReason, setSquareFallbackReason] = useState<string | null>(null);
  const [cardOnFileConsentAccepted, setCardOnFileConsentAccepted] = useState(false);
  const customerDisplayName = getCustomerDisplayName(draft);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
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

    const serviceZip = (draft.zip || draft.customerZip || "").replace(/\D/g, "").slice(0, 5);
    const hasDumpsterSelection = Boolean(
      (draft.dumpsterSize || "").trim() || (draft.dumpsterProductId || "").trim(),
    );
    const hasPickupDate = isYMD((draft.pickupDate || draft.priceQuote?.effectivePickupDate || "").trim());
    const hasContactDetails = Boolean(
      customerDisplayName &&
        (draft.customerEmail || "").trim() &&
        (draft.customerPhone || "").trim() &&
        (draft.customerStreet || "").trim() &&
        (draft.customerCity || "").trim() &&
        (draft.customerState || "").trim() &&
        (draft.customerZip || serviceZip).trim(),
    );

    if (!/^\d{5}$/.test(serviceZip)) {
      router.replace("/book/address");
      return;
    }

    if (!hasDumpsterSelection) {
      router.replace(`/book?zip=${encodeURIComponent(serviceZip)}`);
      return;
    }

    if (!draft.holdId || !draft.holdExpiresAt || !hasPickupDate) {
      router.replace("/book/date");
      return;
    }

    const expires = Date.parse(draft.holdExpiresAt);
    if (!Number.isFinite(expires) || expires <= nowMs) {
      router.replace("/book/date");
      return;
    }

    if (!hasContactDetails) {
      router.replace("/book/placement");
    }
  }, [
    hydrated,
    draft.customerCity,
    draft.customerEmail,
    customerDisplayName,
    draft.customerPhone,
    draft.customerState,
    draft.customerStreet,
    draft.customerZip,
    draft.dumpsterProductId,
    draft.dumpsterSize,
    draft.holdExpiresAt,
    draft.holdId,
    draft.pickupDate,
    draft.priceQuote,
    draft.zip,
    nowMs,
    router,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    const bookingZip = (draft.customerZip || draft.zip || "").trim();
    const selectedDumpsterSize = (draft.dumpsterSize || "").trim();

    if (
      !bookingZip ||
      !selectedDumpsterSize ||
      priceQuoteMatchesSelection(draft.priceQuote, {
        zip: bookingZip,
        deliveryDate: draft.deliveryDate,
        pickupDate: draft.pickupDate,
        pickupMode: draft.pickupMode,
      })
    ) {
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);

    (async () => {
      try {
        const params = new URLSearchParams({
          zip: bookingZip,
          deliveryDate: String(draft.deliveryDate ?? ""),
          pickupMode: draft.pickupMode === "date" ? "date" : "unspecified",
          dumpsterSize: selectedDumpsterSize,
        });

        if (draft.dumpsterProductId) {
          params.set("dumpsterProductId", draft.dumpsterProductId);
        }

        if (draft.pickupMode === "date" && isYMD(draft.pickupDate || "")) {
          params.set("pickupDate", String(draft.pickupDate));
        }

        const res = await fetch(`/api/zip-check?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.serviced || !json?.priceQuote) {
          setError(
            json?.error ||
              "We couldn’t load the latest pricing for this ZIP. Please go back and recheck the service address.",
          );
          return;
        }

        setDraft((current) => {
          const next = { ...current, priceQuote: json.priceQuote as BookingPriceQuote };
          try {
            sessionStorage.setItem(getBookingStorageKey(), JSON.stringify(next));
          } catch {
            // ignore
          }
          return next;
        });
      } catch {
        if (cancelled) return;
        setError("We couldn’t load the latest pricing for this ZIP. Please go back and recheck the service address.");
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    hydrated,
    draft.customerZip,
    draft.deliveryDate,
    draft.dumpsterProductId,
    draft.dumpsterSize,
    draft.pickupDate,
    draft.pickupMode,
    draft.priceQuote,
    draft.zip,
  ]);

  useEffect(() => {
    if (!hydrated) return;

    if (ENABLE_SIMULATED_CHECKOUT && SQUARE_PRODUCTION_MODE) {
      console.error(
        "NEXT_PUBLIC_ENABLE_SIMULATED_CHECKOUT is ignored when NEXT_PUBLIC_SQUARE_ENVIRONMENT is production.",
      );
    }

    const squareConfig = getSquareConfigStatus();

    if (!squareConfig.configured) {
      setSquareCard(null);
      setSquareReady(false);
      setSquareLoading(false);
      setSquareError(null);
      setSquareFallbackReason(squareConfig.reason);
      return;
    }

    let cancelled = false;
    let activeCard: SquareCard | null = null;

    setSquareCard(null);
    setSquareReady(false);
    setSquareLoading(true);
    setSquareError(null);
    setSquareFallbackReason(null);

    (async () => {
      try {
        await loadSquareScript();

        if (cancelled) return;

        if (!window.Square) {
          throw new Error("Square payment form is unavailable.");
        }

        const payments = window.Square.payments(SQUARE_APPLICATION_ID, SQUARE_LOCATION_ID);
        const card = await payments.card();
        activeCard = card;

        if (cancelled) {
          await card.destroy?.();
          return;
        }

        await card.attach(`#${SQUARE_CARD_CONTAINER_ID}`);

        if (cancelled) {
          await card.destroy?.();
          return;
        }

        setSquareCard(card);
        setSquareReady(true);
      } catch (setupError) {
        if (cancelled) return;

        setSquareError(
          setupError instanceof Error
            ? setupError.message
            : "Square payment form could not be initialized.",
        );
        setSquareFallbackReason(PAYMENT_UNAVAILABLE_MESSAGE);
      } finally {
        if (!cancelled) setSquareLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      setSquareReady(false);
      setSquareCard(null);
      void activeCard?.destroy?.();
    };
  }, [hydrated]);


  const deliveryDateLabel = useMemo(
    () => formatDateCompact((draft.deliveryDate || "").trim()),
    [draft.deliveryDate]
  );

  const pickupLabel = useMemo(() => {
    const pd = (draft.pickupDate || "").trim();

    if (isYMD(pd)) return formatDateCompact(pd);

    const fallbackPickupDate = (draft.priceQuote?.effectivePickupDate || draft.priceQuote?.standardPickupDate || "").trim();
    if (isYMD(fallbackPickupDate)) return formatDateCompact(fallbackPickupDate);

    return "—";
  }, [draft.pickupDate, draft.priceQuote?.effectivePickupDate, draft.priceQuote?.standardPickupDate]);

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

  function getCheckoutSubmissionDetails() {
    const priceQuote = draft.priceQuote;

    if (!priceQuote) {
      setError("Pricing is still loading. Please wait a moment and try again.");
      return null;
    }

    if (holdExpired) {
      setError("Your hold has expired. Please choose a new delivery date.");
      return null;
    }

    if (!draft.holdId) {
      setError("Your session has expired. Please start again.");
      return null;
    }

    // ✅ Ensure we have a valid YYYY-MM-DD delivery date to send to the API
    const deliveryDateYMD = (draft.deliveryDate || draft.holdDeliveryDate || "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(deliveryDateYMD)) {
      setError("Delivery date is missing or invalid. Please go back and choose a new delivery date.");
      return null;
    }

    const pickupDateYMD = (draft.pickupDate || priceQuote.effectivePickupDate || "").trim();
    if (!isYMD(pickupDateYMD)) {
      setError("Pickup date is missing. Please go back and choose your rental timing.");
      return null;
    }

    return { deliveryDateYMD, pickupDateYMD, priceQuote };
  }

  async function validateActiveHold() {
    const validateRes = await fetch("/api/validate-hold", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ holdId: draft.holdId }),
    });

    const validateJson = await validateRes.json().catch(() => ({}));

    if (!validateRes.ok || !validateJson?.valid) {
      setError("Your hold has expired. Please choose a new delivery date.");
      return false;
    }

    return true;
  }

  async function recordCardOnFileConsent() {
    if (!cardOnFileConsentAccepted) {
      setError("Please authorize today’s payment and future documented rental charges before continuing.");
      return false;
    }

    if (!draft.holdId) {
      setError("Your session has expired. Please start again.");
      return false;
    }

    try {
      const consentRes = await fetch("/api/booking-consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingHoldId: draft.holdId,
          consentType: "card_on_file",
          consentVersion: CARD_ON_FILE_CONSENT_VERSION,
          acceptedAt: new Date().toISOString(),
          sourcePage: "checkout",
        }),
      });

      const consentJson = await consentRes.json().catch(() => ({}));

      if (!consentRes.ok || !consentJson?.ok) {
        setError(
          consentJson?.error ||
            "We could not record your card-on-file authorization. Please try again.",
        );
        return false;
      }
    } catch {
      setError("We could not record your card-on-file authorization. Please try again.");
      return false;
    }

    return true;
  }

  async function confirmBooking(
    details: { deliveryDateYMD: string; priceQuote: BookingPriceQuote },
    payment?: { paymentMethodToken: string },
  ) {
    const confirmPayload = payment
      ? {
          holdId: draft.holdId,
          deliveryDate: details.deliveryDateYMD,
          bookingDraft: draft,
          paymentProvider: "square",
          paymentMethodToken: payment.paymentMethodToken,
        }
      : {
          holdId: draft.holdId,
          deliveryDate: details.deliveryDateYMD, // ✅ IMPORTANT: send YYYY-MM-DD explicitly
          bookingDraft: draft,
          totalPriceCents: totalCents,
        };

    // ✅ Convert hold -> booking
    const confirmRes = await fetch("/api/confirm-booking", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(confirmPayload),
    });

    const confirmJson = await confirmRes.json().catch(() => ({}));

    if (!confirmRes.ok || !confirmJson?.ok) {
      setError(
        confirmJson?.customerMessage ||
          confirmJson?.error ||
          "We couldn't confirm your booking. Please try again."
      );
      return false;
    }

    if (confirmJson?.placementPersistenceSkipped) {
      try {
        sessionStorage.setItem(
          getLastBookingWarningStorageKey(),
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
        sessionStorage.removeItem(getLastBookingWarningStorageKey());
      } catch {
        // ignore
      }
    }

    // 🧹 Clear draft now that booking is confirmed
    try {
      sessionStorage.removeItem(getBookingStorageKey());
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
      rentalPriceCents: String(baseRentalCents),
      standardRentalDays: String(details.priceQuote.standardRentalDays),
      bookedRentalDays: String(details.priceQuote.bookedRentalDays ?? details.priceQuote.standardRentalDays),
      maxRentalDays: details.priceQuote.maxRentalDays != null ? String(details.priceQuote.maxRentalDays) : "",
      allowExtendedRentalAtBooking: details.priceQuote.allowExtendedRentalAtBooking ? "1" : "0",
      dailyOveragePriceCents: String(details.priceQuote.dailyOveragePriceCents),
      extraDays: String(details.priceQuote.extraDays),
      extraDaysChargeCents: String(extraDaysChargeCents),
      salesTaxCents: String(salesTaxCents),
      totalCents: String(totalCents),
    });
    router.push(`/success?${nextParams.toString()}`);
    return true;
  }

  async function handleSquarePayment() {
    setError(null);
    setSquareError(null);

    if (!squareCard || !squareReady) {
      setError("Secure card checkout is still loading. Please wait a moment and try again.");
      return;
    }

    const details = getCheckoutSubmissionDetails();
    if (!details) return;

    setIsPaying(true);

    try {
      // 🔒 Validate hold before tokenizing/payment
      const holdValid = await validateActiveHold();
      if (!holdValid) return;

      const consentRecorded = await recordCardOnFileConsent();
      if (!consentRecorded) return;

      const tokenResult = await squareCard.tokenize();
      if (tokenResult.status !== "OK" || !tokenResult.token) {
        setSquareError(getTokenizationError(tokenResult));
        return;
      }

      await confirmBooking(details, { paymentMethodToken: tokenResult.token });
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  }

  async function handleSimulatePayment() {
    setError(null);

    const details = getCheckoutSubmissionDetails();
    if (!details) return;

    setIsPaying(true);

    try {
      // 🔒 Validate hold before payment
      const holdValid = await validateActiveHold();
      if (!holdValid) return;

      const consentRecorded = await recordCardOnFileConsent();
      if (!consentRecorded) return;

      // 💳 Simulate payment
      await new Promise((r) => setTimeout(r, 600));

      await confirmBooking(details);
    } catch {
      setError("Payment failed. Please try again.");
    } finally {
      setIsPaying(false);
    }
  }

  if (!hydrated) return null;

  const baseRentalCents = draft.priceQuote?.rentalPriceCents ?? 0;
  const extraDaysChargeCents = draft.priceQuote?.extraDaysChargeCents ?? 0;
  const subtotalCents = draft.priceQuote?.subtotalCents ?? baseRentalCents + extraDaysChargeCents;
  const salesTaxCents = draft.priceQuote?.salesTaxCents ?? 0;
  const feesCents = 0; // TODO: fees later
  const totalCents = (draft.priceQuote?.totalCents ?? subtotalCents + salesTaxCents) + feesCents;
  const fmtMoney = (cents: number) => formatUsdFromCents(cents);
  const canSubmitPayment = !!draft.priceQuote && !quoteLoading;
  const squareConfig = getSquareConfigStatus();
  const squareConfigured = squareConfig.configured;
  const canSubmitSquarePayment =
    squareConfigured && squareReady && !!squareCard && canSubmitPayment && cardOnFileConsentAccepted;
  const showSimulatedPayment = SIMULATED_CHECKOUT_ALLOWED;
  const showPaymentUnavailableMessage =
    !showSimulatedPayment &&
    ((!squareConfigured && Boolean(squareFallbackReason)) ||
      (squareConfigured && Boolean(squareError) && !squareReady));
  const serviceLocation =
    [draft.customerCity, draft.customerState].filter(Boolean).join(", ") ||
    (draft.customerZip || draft.zip || "").trim() ||
    "—";
  const dumpsterLabel = (draft.dumpsterDisplayName || draft.dumpsterSize || "").trim() || "—";
  const showExtraDaysRow = Boolean(draft.priceQuote?.extraDays && extraDaysChargeCents > 0);
  const showSalesTaxRow = salesTaxCents > 0;

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-16">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 5 of 5
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-full rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Secure checkout</h1>
            <p className="text-[#475569]">{content.description}</p>
          </div>

          <section className="mt-8 space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">{content.orderSummaryTitle}</div>

              <div className="mt-4 rounded-xl border border-slate-200 bg-white p-4">
                <div className="text-sm">
                  <div className="space-y-1">
                    <div className="font-semibold text-slate-900">{dumpsterLabel}</div>
                    <div className="text-slate-600">
                      {deliveryDateLabel} → {pickupLabel}
                    </div>
                    <div className="text-slate-600">{serviceLocation}</div>
                  </div>

                  <div className="mt-4 space-y-2 border-t border-slate-200 pt-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-600">Base price</span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {quoteLoading ? "Calculating..." : fmtMoney(baseRentalCents)}
                      </span>
                    </div>
                    {showExtraDaysRow ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">Extra days</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {quoteLoading ? "Calculating..." : fmtMoney(extraDaysChargeCents)}
                        </span>
                      </div>
                    ) : null}
                    {showSalesTaxRow ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">Sales tax</span>
                        <span className="font-semibold text-slate-900 tabular-nums">
                          {quoteLoading ? "Calculating..." : fmtMoney(salesTaxCents)}
                        </span>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                    <span className="text-base font-semibold text-slate-900">Total</span>
                    <span className="text-right text-base font-semibold text-slate-900 tabular-nums">
                      {quoteLoading ? "Calculating..." : fmtMoney(totalCents)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <div className="text-sm font-semibold text-slate-900">{content.paymentTitle}</div>
              <p className="mt-1 text-sm text-slate-600">
                {content.paymentDescription}
              </p>

              <div className="mt-4">

                {holdExpired && (
                  <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {content.holdExpiredNotice}
                  </div>
                )}

                <div className="mb-4 rounded-xl border border-slate-200 bg-white px-4 py-4">
                  <label className="flex items-start gap-3 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={cardOnFileConsentAccepted}
                      onChange={(event) => {
                        setCardOnFileConsentAccepted(event.target.checked);
                        if (event.target.checked) setError(null);
                      }}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                    />
                    <span className="leading-6">
                      I authorize today’s payment and authorize my card to be securely saved with Square for
                      documented additional charges related to this rental, including extra weight, damage,
                      prohibited materials, extra rental days, failed access, or other fees described in the
                      Rental Terms.
                    </span>
                  </label>
                  <details className="mt-3 text-xs leading-5 text-slate-600">
                    <summary className="cursor-pointer font-semibold text-[#F97316]">
                      View card-on-file authorization
                    </summary>
                    <div className="mt-2 whitespace-pre-line">
                      {CARD_ON_FILE_CONSENT_TEXT}
                    </div>
                  </details>
                </div>

                {squareConfigured ? (
                  <div className="space-y-3">
                    <div
                      id={SQUARE_CARD_CONTAINER_ID}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    />

                    {squareLoading ? (
                      <div className="text-sm text-slate-600">Loading secure card checkout…</div>
                    ) : null}

                    {squareError && (squareReady || showSimulatedPayment) ? (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {squareError}
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSquarePayment}
                      disabled={isPaying || holdExpired || !canSubmitSquarePayment}
                      className="group w-full h-14 rounded-2xl bg-[#0F172A] text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#0B1220] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isPaying
                          ? content.paymentProcessingLabel
                          : squareLoading || quoteLoading
                            ? content.paymentLoadingLabel
                            : `Pay ${fmtMoney(totalCents)}`}
                        <span className="transition-transform group-hover:translate-x-1 text-white/90">→</span>
                      </span>
                    </button>
                  </div>
                ) : null}

                {showPaymentUnavailableMessage ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                    {squareFallbackReason || PAYMENT_UNAVAILABLE_MESSAGE}
                  </div>
                ) : null}

                {showSimulatedPayment ? (
                  <div className={squareConfigured ? "mt-4 border-t border-slate-200 pt-4" : ""}>
                    {squareFallbackReason ? (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        {squareFallbackReason}
                      </div>
                    ) : squareConfigured ? (
                      <div className="mb-3 text-xs text-slate-500 text-center">
                        Development fallback: simulated checkout is enabled.
                      </div>
                    ) : null}

                    <button
                      type="button"
                      onClick={handleSimulatePayment}
                      disabled={isPaying || holdExpired || !canSubmitPayment || !cardOnFileConsentAccepted}
                      className="group w-full h-14 rounded-2xl border border-slate-200 bg-white text-slate-900 font-semibold text-base shadow-sm transition-all duration-200 ease-out hover:bg-slate-50 hover:shadow-md active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isPaying ? content.paymentProcessingLabel : quoteLoading ? content.paymentLoadingLabel : content.paymentIdleLabel}
                        <span className="transition-transform group-hover:translate-x-1 text-slate-500">→</span>
                      </span>
                    </button>
                  </div>
                ) : null}

                {holdExpired && (
                  <button
                    type="button"
                    onClick={() => router.push("/book/date")}
                    className="mt-3 w-full h-12 rounded-2xl border border-slate-200 bg-white text-slate-800 font-semibold hover:bg-slate-50"
                  >
                    {content.chooseNewDateLabel}
                  </button>
                )}

                <div className="mt-5 text-xs text-slate-500 text-center">
                  {content.paymentFooterNote}
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
