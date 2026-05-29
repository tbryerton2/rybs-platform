// src/app/confirm/page.tsx
"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  priceQuoteMatchesSelection,
  type BookingPriceQuote,
} from "@/lib/booking-pricing";
import {
  RENTAL_TERMS_CONSENT_TEXT,
  RENTAL_TERMS_VERSION,
} from "@/lib/booking-terms";
import { formatUsdFromCents } from "@/lib/money";
import {
  getAccessIssueLabel,
  getDeliveryPresenceLabel,
  getPlacementPreferenceLabel,
  sanitizePlacementDetails,
  type AccessIssue,
  type DeliveryPresence,
  type PlacementPreference,
} from "@/lib/placement";
import { getReorderNotice } from "@/lib/reorder";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

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
  placementPreference?: PlacementPreference | null;
  placementDetails?: string | null;
  accessIssues?: AccessIssue[];
  gateInstructions?: string | null;
  otherConcernDetails?: string | null;
  deliveryPresence?: DeliveryPresence | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;

  deliveryDate?: string;

  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;
  priceQuote?: BookingPriceQuote | null;

  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD

  // cap fields saved from /book/date
  maxPickupDate?: string; // YYYY-MM-DD
  maxDaysAllowed?: number; // integer
  limitedAck?: boolean; // checkbox on date page
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
};

function isYMD(s: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((s || "").trim());
}

function formatPhoneUS(raw: string) {
  const digits = (raw || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const d = digits.slice(1);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return (raw || "").trim() || "—";
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

function formatMMSS(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function CardShell({
  title,
  icon,
  editHref,
  editLabel = "Edit",
  children,
}: {
  title: string;
  icon: ReactNode;
  editHref?: string;
  editLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-300/80 bg-white shadow-md ring-1 ring-slate-200/60 overflow-hidden">
      <div className="flex items-center justify-between gap-4 px-5 py-4 bg-slate-50">
        <div className="flex items-center gap-3">
          {icon}
          <div className="text-sm font-semibold text-slate-900">{title}</div>
        </div>
        {editHref ? (
          <a href={editHref} className="shrink-0 text-sm font-semibold text-[#F97316] hover:underline">
            {editLabel}
          </a>
        ) : null}
      </div>

      <div className="h-px w-full bg-slate-200/50" />

      <div className="px-5 py-4 bg-white">{children}</div>
    </div>
  );
}

function IconChip({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700 ring-1 ring-slate-200/70">
      {children}
    </span>
  );
}

function DetailRow({
  label,
  value,
  multiline = false,
}: {
  label: string;
  value: ReactNode;
  multiline?: boolean;
}) {
  return (
    <div className="grid gap-1 text-sm sm:grid-cols-[180px_1fr] sm:gap-4">
      <span className="font-semibold text-slate-900">{label}:</span>
      <span className={multiline ? "whitespace-pre-line leading-6 text-slate-700" : "text-slate-700"}>
        {value}
      </span>
    </div>
  );
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

type ConfirmPageClientProps = {
  content: {
    title: string;
    description: string;
    reorderTitle: string;
    holdBannerTitle: string;
    holdBannerBody: string;
    capLoadingText: string;
    deliveryTimeNote: string;
    pickupWindowTemplate: string;
  };
};

export default function ConfirmPageClient({ content }: ConfirmPageClientProps) {
  const router = useRouter();

  const [draft, setDraft] = useState<BookingDraft>({});
  const [loadedDraft, setLoadedDraft] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [rentalTermsAccepted, setRentalTermsAccepted] = useState(false);
  const [recordingTermsConsent, setRecordingTermsConsent] = useState(false);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  const [error, setError] = useState<string | null>(null);

  const deliveryDate = (draft.deliveryDate || "").trim();
  const pickupDate = (draft.pickupDate || draft.priceQuote?.effectivePickupDate || "").trim();
  const standardRentalDays = draft.priceQuote?.standardRentalDays ?? draft.includedRentalDays ?? 1;
  const bookedRentalDays = draft.priceQuote?.bookedRentalDays ?? null;
  const extraDays = draft.priceQuote?.extraDays ?? 0;
  const extraDaysChargeCents = draft.priceQuote?.extraDaysChargeCents ?? 0;
  const pickupMode = "date" as const;
  const customerDisplayName = getCustomerDisplayName(draft);
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

  function persist(patch: Partial<BookingDraft>) {
    const raw = sessionStorage.getItem(getBookingStorageKey());
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};
    const next = { ...existing, ...patch };
    sessionStorage.setItem(getBookingStorageKey(), JSON.stringify(next));
    setDraft(next);
  }

  // initial hydration
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      if (!raw) {
        setLoadedDraft(true);
        return;
      }

      const d: BookingDraft = JSON.parse(raw);

      setDraft(d);
    } catch {
      // ignore
    } finally {
      setLoadedDraft(true);
    }
  }, []);

  useEffect(() => {
    if (!loadedDraft) return;

    const serviceZip = (draft.zip || draft.customerZip || "").replace(/\D/g, "").slice(0, 5);
    const hasDumpsterSelection = Boolean(
      (draft.dumpsterSize || "").trim() || (draft.dumpsterProductId || "").trim(),
    );
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

    if (!isYMD((draft.deliveryDate || "").trim()) || !isYMD((draft.pickupDate || draft.priceQuote?.effectivePickupDate || "").trim()) || !draft.holdId || !draft.holdExpiresAt) {
      router.replace("/book/date");
      return;
    }

    if (!hasContactDetails) {
      router.replace("/book/placement");
    }
  }, [customerDisplayName, draft, loadedDraft, router]);

  // tick timer every 1s
  useEffect(() => {
    const t = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

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

  useEffect(() => {
    const bookingZip = (draft.customerZip || draft.zip || "").trim();
    const selectedDumpsterSize = (draft.dumpsterSize || "").trim();
    if (!isYMD(deliveryDate) || !isYMD(pickupDate) || !bookingZip || !selectedDumpsterSize) return;

    if (
      priceQuoteMatchesSelection(draft.priceQuote, {
        zip: bookingZip,
        deliveryDate,
        pickupDate,
        pickupMode,
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
          deliveryDate,
          pickupMode,
          dumpsterSize: selectedDumpsterSize,
        });

        if (draft.dumpsterProductId) {
          params.set("dumpsterProductId", draft.dumpsterProductId);
        }

        params.set("pickupDate", pickupDate);

        const res = await fetch(`/api/zip-check?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.serviced || !json?.priceQuote) {
          setError(json?.error || "We couldn’t refresh pricing for this rental period. Please try again.");
          return;
        }

        persist({ priceQuote: json.priceQuote as BookingPriceQuote });
      } catch {
        if (cancelled) return;
        setError("We couldn’t refresh pricing for this rental period. Please try again.");
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    draft.customerZip,
    draft.dumpsterProductId,
    draft.dumpsterSize,
    draft.priceQuote,
    draft.zip,
    deliveryDate,
    pickupDate,
    pickupMode,
  ]);

  async function handleContinueToCheckout() {
    setError(null);

    if (!draft.holdId || !draft.holdExpiresAt || holdExpired) {
      setError("Your hold has expired. Please choose a new delivery date.");
      return;
    }

    if (!isYMD(deliveryDate)) {
      setError("Please choose a delivery date.");
      return;
    }

    if (!isYMD(pickupDate)) {
      setError("Pickup date is missing. Please go back and choose your rental timing.");
      return;
    }

    if (!rentalTermsAccepted) {
      setError("Please accept the Rental Terms and Conditions before continuing.");
      return;
    }

    setRecordingTermsConsent(true);
    try {
      const res = await fetch("/api/booking-consents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingHoldId: draft.holdId,
          consentType: "rental_terms",
          consentVersion: RENTAL_TERMS_VERSION,
          consentText: RENTAL_TERMS_CONSENT_TEXT,
          acceptedAt: new Date().toISOString(),
          sourcePage: "confirm",
        }),
      });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok) {
        setError(json?.error || "We could not record your rental terms acceptance. Please try again.");
        return;
      }
    } catch {
      setError("We could not record your rental terms acceptance. Please try again.");
      return;
    } finally {
      setRecordingTermsConsent(false);
    }

    router.push("/checkout");
  }

  const ContactIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="7" r="4" />
        <path d="M5.5 21a6.5 6.5 0 0 1 13 0" />
      </svg>
    </IconChip>
  );

  const AddressIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
        <circle cx="12" cy="10" r="2.5" />
      </svg>
    </IconChip>
  );

  const PickupIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 7h11v10H3z" />
        <path d="M14 10h4l3 3v4h-7z" />
        <circle cx="7.5" cy="19" r="1.5" />
        <circle cx="17.5" cy="19" r="1.5" />
      </svg>
    </IconChip>
  );

  const PricingIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 7h16" />
        <path d="M4 12h10" />
        <path d="M4 17h7" />
        <circle cx="18" cy="17" r="3" />
      </svg>
    </IconChip>
  );

  const PlacementIcon = (
    <IconChip>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 3v18" />
        <path d="M5 8h14" />
        <path d="M7 16h10" />
        <path d="M7 8l2-4h6l2 4" />
        <path d="M8 16l-2 5h12l-2-5" />
      </svg>
    </IconChip>
  );

  const canContinue =
    !quoteLoading &&
    !recordingTermsConsent &&
    rentalTermsAccepted &&
    !!draft.holdId &&
    !!draft.holdExpiresAt &&
    !holdExpired &&
    isYMD(deliveryDate) &&
    isYMD(pickupDate);

  if (!loadedDraft) return null;

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pt-10 pb-6 sm:pb-8">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 sm:px-12 sm:pb-12 sm:pt-8 shadow-xl ring-1 ring-slate-200/70">
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 4 of 5
                </div>
                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-4/5 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">{content.title}</h1>
            <p className="text-[#475569]">{content.description}</p>
          </div>

          <section className="mt-8 space-y-6 mb-2">
            {draft.reorderSourceBookingId ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-3 text-sm leading-6 text-slate-700">
                <div className="font-semibold text-slate-900">{content.reorderTitle}</div>
                <div className="mt-1">{getReorderNotice(draft.reorderSourceBookingRef)}</div>
              </div>
            ) : null}

            {draft.holdExpiresAt && secondsLeft != null && !holdExpired && (
              <div className="rounded-xl border border-[#FDBA74] bg-[#FFF7ED] px-4 py-3 text-sm text-slate-900">
                <div className="font-semibold">{content.holdBannerTitle.replace("{time}", formatMMSS(secondsLeft))}</div>
                <div className="text-slate-700">
                  {content.holdBannerBody}
                </div>
              </div>
            )}

            {/* Contact */}
            <div className="space-y-6">
              <CardShell title="Contact information" icon={ContactIcon} editHref="/book/placement">
                <div className="grid gap-y-2.5 text-sm">
                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Name:</span>
                    <span className="font-medium text-slate-900">{customerDisplayName || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Email:</span>
                    <span className="font-medium text-slate-900 break-all">{(draft.customerEmail || "").trim() || "—"}</span>
                  </div>

                  <div className="grid grid-cols-[72px_1fr] items-baseline gap-x-4">
                    <span className="text-slate-500">Phone:</span>
                    <span className="font-medium text-slate-900 tabular-nums">{formatPhoneUS((draft.customerPhone || "").trim())}</span>
                  </div>
                </div>
              </CardShell>

              <CardShell title="Service address" icon={AddressIcon} editHref="/book/placement">
                <div className="text-sm text-slate-700">
                  <div className="font-medium text-slate-900">{(draft.customerStreet || "").trim() || "—"}</div>
                  <div className="mt-1">
                    {[draft.customerCity, draft.customerState].filter(Boolean).join(", ") || "—"}
                    {draft.customerZip ? ` ${draft.customerZip}` : ""}
                  </div>
                </div>
              </CardShell>

              <CardShell title="Dumpster" icon={PricingIcon}>
                <div className="space-y-2 text-sm text-slate-700">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Size</span>
                    <span className="font-semibold text-slate-900">
                      {(draft.dumpsterDisplayName || draft.dumpsterSize || "").trim() || "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Service ZIP</span>
                    <span className="font-semibold text-slate-900">{(draft.zip || draft.customerZip || "").trim() || "—"}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Included tonnage</span>
                    <span className="font-semibold text-slate-900">
                      {typeof draft.includedWeightTons === "number"
                        ? `${draft.includedWeightTons} ton${draft.includedWeightTons === 1 ? "" : "s"}`
                        : "—"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-slate-600">Per-ton overage</span>
                    <span className="font-semibold text-slate-900">
                      {typeof draft.tonOveragePrice === "number"
                        ? `${formatUsdFromCents(Math.round(draft.tonOveragePrice * 100))} per ton`
                        : "—"}
                    </span>
                  </div>
                </div>
              </CardShell>

              <CardShell title="Placement and access" icon={PlacementIcon} editHref="/book/placement">
                <div className="space-y-3">
                  <DetailRow
                    label="Placement Preference"
                    value={getPlacementPreferenceLabel(placementDetails.placementPreference)}
                  />
                  {placementDetails.placementDetails ? (
                    <DetailRow label="Exact Placement" value={placementDetails.placementDetails} multiline />
                  ) : null}
                  <DetailRow
                    label="Delivery Presence"
                    value={getDeliveryPresenceLabel(placementDetails.deliveryPresence)}
                  />
                  {placementDetails.accessIssues.length ? (
                    <DetailRow
                      label="Driveway / Access Notes"
                      value={placementDetails.accessIssues.map(getAccessIssueLabel).join(", ")}
                      multiline
                    />
                  ) : null}
                  {placementDetails.gateInstructions ? (
                    <DetailRow label="Gated Property Details" value={placementDetails.gateInstructions} multiline />
                  ) : null}
                  {placementDetails.accessIssues.includes("other_concern") && draft.otherConcernDetails ? (
                    <DetailRow label="Other Concern" value={draft.otherConcernDetails} multiline />
                  ) : null}
                  {placementDetails.alternateContactName || placementDetails.alternateContactPhone ? (
                    <DetailRow
                      label="Delivery Contact"
                      value={[placementDetails.alternateContactName, formatPhoneUS(placementDetails.alternateContactPhone || "")]
                        .filter((value) => value && value !== "—")
                        .join(" • ")}
                      multiline
                    />
                  ) : null}
                  {placementDetails.specialDeliveryInstructions ? (
                    <DetailRow
                      label="Special Instructions"
                      value={placementDetails.specialDeliveryInstructions}
                      multiline
                    />
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
              </CardShell>

              <CardShell title="Rental schedule" icon={PickupIcon} editHref="/book/date">
                <div className="space-y-4">
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div>
                      <span className="text-slate-500">Delivery date:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {isYMD(deliveryDate) ? formatDateLong(deliveryDate) : "—"}
                      </span>
                    </div>
                    <div className="mt-1 text-xs text-slate-500">{content.deliveryTimeNote}</div>
                    <div>
                      <span className="font-semibold text-slate-900">
                        This rental includes {standardRentalDays} day{standardRentalDays === 1 ? "" : "s"}.
                      </span>
                    </div>
                    <div className="mt-2">
                      <span className="text-slate-500">Pickup date:</span>{" "}
                      <span className="font-semibold text-slate-900">
                        {isYMD(pickupDate) ? formatDateLong(pickupDate) : "—"}
                      </span>
                    </div>
                    {bookedRentalDays ? (
                      <div className="mt-2">
                        <span className="text-slate-500">Rental length:</span>{" "}
                        <span className="font-semibold text-slate-900">
                          {bookedRentalDays} day{bookedRentalDays === 1 ? "" : "s"}
                        </span>
                      </div>
                    ) : null}
                    {extraDays > 0 && draft.priceQuote ? (
                      <div className="mt-2">
                        <span className="text-slate-500">Extra days:</span>{" "}
                        <span className="font-semibold text-slate-900">
                          {extraDays} x {formatUsdFromCents(draft.priceQuote.dailyOveragePriceCents)}
                        </span>
                        {" = "}
                        <span className="font-semibold text-slate-900">
                          {formatUsdFromCents(extraDaysChargeCents)}
                        </span>
                      </div>
                    ) : null}
                  </div>
                </div>
              </CardShell>

              {draft.priceQuote ? (
                <CardShell title="Price summary" icon={PricingIcon}>
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-600">Base price</span>
                      <span className="font-semibold text-slate-900">
                        {formatUsdFromCents(draft.priceQuote.rentalPriceCents)}
                      </span>
                    </div>
                    {draft.priceQuote.extraDays > 0 ? (
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-600">
                          Extra days ({draft.priceQuote.extraDays} x {formatUsdFromCents(draft.priceQuote.dailyOveragePriceCents)})
                        </span>
                        <span className="font-semibold text-slate-900">
                          {formatUsdFromCents(draft.priceQuote.extraDaysChargeCents)}
                        </span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-slate-600">
                        Sales tax ({Math.round(draft.priceQuote.salesTaxRate * 100)}%)
                      </span>
                      <span className="font-semibold text-slate-900">
                        {formatUsdFromCents(draft.priceQuote.salesTaxCents)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2">
                      <span className="font-semibold text-slate-900">Total</span>
                      <span className="font-semibold text-slate-900">
                        {formatUsdFromCents(draft.priceQuote.totalCents)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500">
                      {`Includes up to ${draft.priceQuote.standardRentalDays} days. `}
                      {`${formatUsdFromCents(draft.priceQuote.dailyOveragePriceCents)} per extra day after day ${draft.priceQuote.standardRentalDays}.`}
                      {draft.priceQuote.maxRentalDays
                        ? ` Maximum rental length: ${draft.priceQuote.maxRentalDays} days.`
                        : ""}
                      {!draft.priceQuote.allowExtendedRentalAtBooking
                        ? " Online booking is limited to the included rental period."
                        : ""}
                    </div>
                    {quoteLoading ? (
                      <div className="text-xs text-slate-500">Refreshing pricing…</div>
                    ) : null}
                  </div>
                </CardShell>
              ) : null}

            </div>

            <section className="rounded-2xl border border-slate-300/80 bg-white px-5 py-5 shadow-md ring-1 ring-slate-200/60">
              <div className="space-y-4">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Rental Terms and Conditions</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-700">
                    Review the rental terms before continuing. They cover the included weight limit,
                    overage fees, damage responsibility, prohibited materials, access and placement
                    responsibility, and safety and liability rules.
                  </p>
                </div>

                <details className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                  <summary className="cursor-pointer font-semibold text-[#F97316]">
                    View Rental Terms
                  </summary>
                  <div className="mt-3 whitespace-pre-line leading-6 text-slate-700">
                    {RENTAL_TERMS_CONSENT_TEXT}
                  </div>
                </details>

                <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    checked={rentalTermsAccepted}
                    onChange={(event) => {
                      setRentalTermsAccepted(event.target.checked);
                      if (event.target.checked) setError(null);
                    }}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-[#F97316] focus:ring-[#F97316]"
                  />
                  <span>I have read and agree to the Rental Terms and Conditions.</span>
                </label>
              </div>
            </section>

            <div className="grid gap-2">
              <button
                type="button"
                disabled={!canContinue}
                onClick={handleContinueToCheckout}
                className="group w-full h-14 rounded-2xl bg-[#F97316] shadow-lg hover:shadow-xl text-white font-semibold text-base shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <span className="flex items-center justify-center gap-2">
                  {quoteLoading
                    ? "Refreshing pricing..."
                    : recordingTermsConsent
                      ? "Recording acceptance..."
                      : "Continue to payment"}
                  <span className="transition-transform group-hover:translate-x-1 text-white/90">→</span>
                </span>
              </button>
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                {error}
              </div>
            )}

            <a href="/book/placement" className="text-sm text-slate-600 hover:text-slate-900 transition-colors">
              ← Back
            </a>
          </section>
        </div>
      </div>
    </main>
  );
}
