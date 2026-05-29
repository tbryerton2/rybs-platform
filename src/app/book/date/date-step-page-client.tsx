// src/app/book/date/page.tsx
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  addDaysYmd,
  getMaximumBookablePickupDate,
  getRentalPeriodDetails,
  priceQuoteMatchesSelection,
  type BookingPriceQuote,
} from "@/lib/booking-pricing";
import {
  buildBookingOriginBackHref,
  normalizeBookingOrigin,
  type BookingOrigin,
} from "@/lib/booking-origin";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getHoldMinutes } from "@/lib/config";
import { formatUsdFromCents } from "@/lib/money";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import {
  AvailabilityCalendar,
  type CalendarAvailabilityEntry,
} from "@/components/booking/AvailabilityCalendar";

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
  holdPickupDate?: string;
  holdExpiresAt?: string;
  holdDumpsterSize?: string;
  holdDumpsterProductId?: string | null;
  priceQuote?: BookingPriceQuote | null;

  // pickup fields (used later on confirm/checkout)
  pickupMode?: "unspecified" | "date";
  pickupDate?: string; // YYYY-MM-DD

  maxPickupDate?: string;          // YYYY-MM-DD (only when capped)
  maxDaysAllowed?: number;         // number
  limitedAck?: boolean;            // user checkbox
  bookingOrigin?: string | null;
};

type AvailState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ok"; remaining: number; requestedPickupDate: string | null }
  | { state: "none" }
  | { state: "error"; message: string };

type HoldState =
  | { state: "idle" }
  | { state: "creating" }
  | { state: "error"; message: string };

type PickupCapState =
  | { state: "idle" }
  | { state: "loading" }
  | { state: "ready"; maxPickupDate: string | null; maxDaysAllowed: number | null }
  | { state: "error"; message: string };

function isYmd(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test((value || "").trim());
}

function parseYmd(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toYmd(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function formatDateLong(value: string) {
  if (!isYmd(value)) return value || "—";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(parseYmd(value));
}

function formatDateShort(value: string) {
  if (!isYmd(value)) return value || "—";
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(parseYmd(value));
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

type DateStepPageClientProps = {
  content: {
    title: string;
    description: string;
    earliestAvailablePrefix: string;
    holdNoteTemplate: string;
    footerNote: string;
    nextAvailablePrefix: string;
    availabilityError: string;
  };
};

export default function DateStepPageClient({ content }: DateStepPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const holdMinutes = getHoldMinutes();

  const [deliveryDate, setDeliveryDate] = useState(""); // YYYY-MM-DD (from <input type="date">)
  const [availability, setAvailability] = useState<AvailState>({ state: "idle" });
  const [hold, setHold] = useState<HoldState>({ state: "idle" });
  const [cap] = useState<null | { maxPickupDate: string; maxDaysAllowed: number }>(null);
  const [limitedAck] = useState(false);
  const [calendarEntries, setCalendarEntries] = useState<CalendarAvailabilityEntry[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [nextAvailableDate, setNextAvailableDate] = useState<string | null>(null);
  const [selectedDumpster, setSelectedDumpster] = useState(resolveSelectedDumpster);
  const [bookingZip, setBookingZip] = useState("");
  const [bookingOrigin, setBookingOrigin] = useState<BookingOrigin>("book");
  const [ready, setReady] = useState(false);
  const [draftQuote, setDraftQuote] = useState<BookingPriceQuote | null>(null);
  const [pickupDate, setPickupDate] = useState("");
  const [needsExtraDays, setNeedsExtraDays] = useState(false);
  const [pickupCap, setPickupCap] = useState<PickupCapState>({ state: "idle" });
  const [pickupCalendarEntries, setPickupCalendarEntries] = useState<CalendarAvailabilityEntry[]>([]);
  const [pickupCalendarLoading, setPickupCalendarLoading] = useState(false);
  const [pickupCalendarError, setPickupCalendarError] = useState<string | null>(null);
  const [pickupNextAvailableDate, setPickupNextAvailableDate] = useState<string | null>(null);
  const [pickupAvailabilityRetryKey, setPickupAvailabilityRetryKey] = useState(0);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [timingError, setTimingError] = useState<string | null>(null);

  const queryZip = useMemo(
    () => (searchParams.get("zip") || "").replace(/\D/g, "").slice(0, 5),
    [searchParams],
  );
  const queryDumpsterSize = useMemo(() => (searchParams.get("dumpsterSize") || "").trim(), [searchParams]);
  const queryDumpsterProductId = useMemo(
    () => (searchParams.get("dumpsterProductId") || "").trim() || null,
    [searchParams],
  );
  const queryOrigin = useMemo(() => searchParams.get("origin"), [searchParams]);
  const hasQueryDumpsterSelection = Boolean(queryDumpsterSize || queryDumpsterProductId);

  // Load saved date (if user navigates back)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const raw = sessionStorage.getItem(getBookingStorageKey());
        const data: BookingDraft = raw ? JSON.parse(raw) : {};
        const nextOrigin = normalizeBookingOrigin(queryOrigin ?? data.bookingOrigin);
        const storedZip = (data?.zip || data?.customerZip || "").replace(/\D/g, "").slice(0, 5);
        const nextZip = queryZip || storedZip;
        const storedHasDumpsterSelection = Boolean(
          (data?.dumpsterSize || "").trim() || (data?.dumpsterProductId || "").trim(),
        );
        const nextDumpster = hasQueryDumpsterSelection
          ? resolveSelectedDumpster({
              dumpsterSize: queryDumpsterSize,
              dumpsterProductId: queryDumpsterProductId,
            })
          : resolveSelectedDumpster({
              dumpsterSize: data?.dumpsterSize,
              dumpsterProductId: data?.dumpsterProductId,
            });
        const hasDumpsterSelection = hasQueryDumpsterSelection || storedHasDumpsterSelection;

        if (!/^\d{5}$/.test(nextZip)) {
          router.replace("/book/address");
          return;
        }

        if (!hasDumpsterSelection) {
          router.replace(`/book?zip=${encodeURIComponent(nextZip)}`);
          return;
        }

        const upstreamChanged =
          data.zip !== nextZip ||
          data.dumpsterSize !== nextDumpster.dumpsterSize ||
          (data.dumpsterProductId ?? null) !== (nextDumpster.dumpsterProductId ?? null);

        if (hasQueryDumpsterSelection || queryZip) {
          const params = new URLSearchParams({
            zip: nextZip,
            dumpsterSize: nextDumpster.dumpsterSize,
          });

          if (nextDumpster.dumpsterProductId) {
            params.set("dumpsterProductId", nextDumpster.dumpsterProductId);
          }

          const res = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
          const json = await res.json().catch(() => ({}));

          if (cancelled) return;

          if (!res.ok || !json?.serviced) {
            router.replace(`/book/address?zip=${encodeURIComponent(nextZip)}`);
            return;
          }

          const nextDraft: BookingDraft = {
            ...data,
            zip: nextZip,
            county: json.county,
            town: json.town,
            dumpsterSize: nextDumpster.dumpsterSize,
            dumpsterProductId: nextDumpster.dumpsterProductId,
            priceQuote: json.priceQuote ?? null,
            bookingOrigin: nextOrigin,
            ...(upstreamChanged
              ? {
                  deliveryDate: undefined,
                  holdId: undefined,
                  holdDeliveryDate: undefined,
                  holdPickupDate: undefined,
                  holdExpiresAt: undefined,
                  holdDumpsterSize: undefined,
                  holdDumpsterProductId: undefined,
                  pickupMode: "unspecified",
                  pickupDate: undefined,
                  maxPickupDate: undefined,
                  maxDaysAllowed: undefined,
                  limitedAck: false,
                }
              : {}),
          };

          sessionStorage.setItem(getBookingStorageKey(), JSON.stringify(nextDraft));
          setDeliveryDate(upstreamChanged ? "" : nextDraft.deliveryDate ?? "");
          setPickupDate(upstreamChanged ? "" : nextDraft.pickupDate ?? "");
          setNeedsExtraDays(
            !upstreamChanged &&
              Boolean(nextDraft.priceQuote?.allowExtendedRentalAtBooking && (nextDraft.priceQuote?.extraDays ?? 0) > 0),
          );
          setDraftQuote(nextDraft.priceQuote ?? null);
        } else if (upstreamChanged) {
          sessionStorage.setItem(
            getBookingStorageKey(),
            JSON.stringify({
              ...data,
              zip: nextZip,
              dumpsterSize: nextDumpster.dumpsterSize,
              dumpsterProductId: nextDumpster.dumpsterProductId,
              deliveryDate: undefined,
              holdId: undefined,
              holdDeliveryDate: undefined,
              holdPickupDate: undefined,
              holdExpiresAt: undefined,
              holdDumpsterSize: undefined,
              holdDumpsterProductId: undefined,
              pickupMode: "unspecified",
              pickupDate: undefined,
              maxPickupDate: undefined,
              maxDaysAllowed: undefined,
              limitedAck: false,
            }),
          );
          setDeliveryDate("");
          setPickupDate("");
          setNeedsExtraDays(false);
          setDraftQuote(data.priceQuote ?? null);
        } else if (data?.deliveryDate) {
          setDeliveryDate(data.deliveryDate);
          setPickupDate(data.pickupDate ?? "");
          setNeedsExtraDays(Boolean(data.priceQuote?.allowExtendedRentalAtBooking && (data.priceQuote?.extraDays ?? 0) > 0));
          setDraftQuote(data.priceQuote ?? null);
        } else {
          setDraftQuote(data.priceQuote ?? null);
        }

        if (cancelled) return;
        setBookingZip(nextZip);
        setSelectedDumpster(nextDumpster);
        setBookingOrigin(nextOrigin);
        setReady(true);
      } catch {
        if (!cancelled) router.replace("/book/address");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasQueryDumpsterSelection, queryDumpsterProductId, queryDumpsterSize, queryOrigin, queryZip, router]);

  // Normalize (future-proof if we ever change date input type)
  const normalizedDate = useMemo(() => (deliveryDate || "").trim(), [deliveryDate]);
  const calendarRangeStart = useMemo(() => toYmd(startOfMonth(new Date())), []);
  const rentalTimingPolicy = useMemo(() => {
    if (!draftQuote) return null;
    return {
      standardRentalDays: draftQuote.standardRentalDays,
      dailyOveragePrice: draftQuote.dailyOveragePrice,
      maxRentalDays: draftQuote.maxRentalDays,
      allowExtendedRentalAtBooking: draftQuote.allowExtendedRentalAtBooking,
    };
  }, [draftQuote]);
  const hasPriceQuote = Boolean(draftQuote);
  const baseRentalTiming = useMemo(() => {
    if (!isYmd(normalizedDate) || !rentalTimingPolicy) return null;
    return getRentalPeriodDetails({
      ...rentalTimingPolicy,
      deliveryDate: normalizedDate,
      pickupMode: "unspecified",
      pickupDate: null,
    });
  }, [normalizedDate, rentalTimingPolicy]);
  const standardRentalDays = baseRentalTiming?.standardRentalDays ?? draftQuote?.standardRentalDays ?? draftQuote?.includedRentalDays ?? null;
  const allowExtendedRentalAtBooking = baseRentalTiming?.allowExtendedRentalAtBooking ?? false;
  const dailyOveragePriceCents = draftQuote?.dailyOveragePriceCents ?? 0;
  const standardPickupDate = baseRentalTiming?.standardPickupDate ?? "";
  const displayRentalWindowDeliveryDate = isYmd(normalizedDate) ? normalizedDate : "";
  const displayRentalWindowPickupDate = isYmd(normalizedDate) ? standardPickupDate : "";
  const hasSelectedDeliveryDate = isYmd(normalizedDate);
  const pricingMaxPickupDate = useMemo(() => {
    if (!isYmd(normalizedDate) || !rentalTimingPolicy) return "";
    return (
      getMaximumBookablePickupDate(
        normalizedDate,
        rentalTimingPolicy,
        null,
      ) || ""
    );
  }, [rentalTimingPolicy, normalizedDate]);
  const operationalMaxPickupDate = useMemo(() => {
    if (pickupCap.state !== "ready") return "";
    const max = pickupCap.maxPickupDate || "";
    return isYmd(max) ? max : "";
  }, [pickupCap]);
  const maxPickupDate = useMemo(() => {
    const candidates = [operationalMaxPickupDate, pricingMaxPickupDate].filter(Boolean).sort();
    return candidates[0] || "";
  }, [operationalMaxPickupDate, pricingMaxPickupDate]);
  const selectedPickupDate = pickupDate || standardPickupDate;
  const pickupMode = "date" as const;
  const selectedRentalTiming = useMemo(() => {
    if (!isYmd(normalizedDate) || !isYmd(selectedPickupDate) || !rentalTimingPolicy) return null;
    return getRentalPeriodDetails({
      ...rentalTimingPolicy,
      deliveryDate: normalizedDate,
      pickupMode,
      pickupDate: selectedPickupDate,
    });
  }, [normalizedDate, pickupMode, rentalTimingPolicy, selectedPickupDate]);
  const extraDays = selectedRentalTiming?.overageDays ?? 0;
  const extraDaysChargeCents = extraDays * dailyOveragePriceCents;
  const estimatedSubtotalCents = draftQuote
    ? draftQuote.rentalPriceCents + extraDaysChargeCents
    : 0;
  const estimatedSalesTaxCents = draftQuote
    ? Math.round(estimatedSubtotalCents * draftQuote.salesTaxRate)
    : 0;
  const estimatedTotalCents = estimatedSubtotalCents + estimatedSalesTaxCents;
  const quoteMatchesCurrentSelection =
    ready &&
    Boolean(bookingZip) &&
    isYmd(normalizedDate) &&
    isYmd(selectedPickupDate) &&
    priceQuoteMatchesSelection(draftQuote, {
      zip: bookingZip,
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
      deliveryDate: normalizedDate,
      pickupDate: selectedPickupDate,
      pickupMode,
    });

  const highlightedEarliestDate = nextAvailableDate;
  const deliveryCalendarLoading =
    !calendarError && (!ready || calendarLoading || calendarEntries.length === 0);
  const pickupCalendarIsLoading =
    needsExtraDays &&
    !pickupCalendarError &&
    pickupCap.state !== "error" &&
    (pickupCalendarLoading || pickupCap.state === "loading" || pickupCalendarEntries.length === 0);

  const getActiveHoldContext = useCallback(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      const holdId = (existing.holdId || "").trim();
      const holdDeliveryDate = (existing.holdDeliveryDate || "").trim();
      const holdPickupDate = (existing.holdPickupDate || "").trim();
      const holdExpiresAt = (existing.holdExpiresAt || "").trim();

      if (!holdId || !isYmd(holdDeliveryDate) || !isYmd(holdPickupDate) || !holdExpiresAt) return null;

      const expiresAtMs = Date.parse(holdExpiresAt);
      if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;

      const holdDumpsterSize = (existing.holdDumpsterSize || "").trim();
      const holdDumpsterProductId = (existing.holdDumpsterProductId || "").trim();
      const hasStoredHoldProduct = Boolean(holdDumpsterSize || holdDumpsterProductId);

      if (hasStoredHoldProduct) {
        if (holdDumpsterSize && holdDumpsterSize !== selectedDumpster.dumpsterSize) return null;
        if (holdDumpsterProductId && holdDumpsterProductId !== (selectedDumpster.dumpsterProductId || "")) {
          return null;
        }
      }

      return { holdId, holdDeliveryDate, holdPickupDate };
    } catch {
      return null;
    }
  }, [selectedDumpster.dumpsterProductId, selectedDumpster.dumpsterSize]);

  const getActiveHoldId = useCallback(() => getActiveHoldContext()?.holdId ?? null, [getActiveHoldContext]);

  const addActiveHoldContextParams = useCallback(
    (params: URLSearchParams) => {
      const holdContext = getActiveHoldContext();
      if (!holdContext) return;

      params.set("holdId", holdContext.holdId);
      params.set("holdDeliveryDate", holdContext.holdDeliveryDate);
      params.set("holdPickupDate", holdContext.holdPickupDate);
    },
    [getActiveHoldContext],
  );

  const loadCalendarRange = useCallback(async (start: string, days = 186) => {
    if (!ready || !bookingZip) return;

    setCalendarLoading(true);
    setCalendarError(null);

    try {
      const params = new URLSearchParams({
        start,
        days: String(days),
        zip: bookingZip,
        dumpsterSize: selectedDumpster.dumpsterSize,
      });

      if (selectedDumpster.dumpsterProductId) {
        params.set("dumpsterProductId", selectedDumpster.dumpsterProductId);
      }

      addActiveHoldContextParams(params);

      const res = await fetch(
        `/api/availability/calendar?${params.toString()}`,
        { cache: "no-store" },
      );
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.ok || !Array.isArray(json?.dates)) {
        setCalendarError(json?.error || content.availabilityError);
        return;
      }

      const nextEntries = json.dates as CalendarAvailabilityEntry[];
      setCalendarEntries(nextEntries);
      setNextAvailableDate(typeof json?.nextAvailableDate === "string" ? json.nextAvailableDate : null);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : content.availabilityError;
      setCalendarError(message);
    } finally {
      setCalendarLoading(false);
    }
  }, [addActiveHoldContextParams, bookingZip, content.availabilityError, ready, selectedDumpster]);

  useEffect(() => {
    if (!ready) return;
    void loadCalendarRange(calendarRangeStart);
  }, [calendarRangeStart, loadCalendarRange, ready]);

  const backToDumpsterHref = useMemo(() => {
    if (!bookingZip) return "/book/address";

    return buildBookingOriginBackHref({
      origin: bookingOrigin,
      zip: bookingZip,
      dumpsterSize: selectedDumpster.dumpsterSize,
      dumpsterProductId: selectedDumpster.dumpsterProductId,
    });
  }, [bookingOrigin, bookingZip, selectedDumpster]);

  function updateDeliveryDate(d: string) {
    if (!ready) return;

    setDeliveryDate(d);
    setPickupDate("");
    setNeedsExtraDays(false);
    setPickupCap({ state: "idle" });
    setPickupCalendarEntries([]);
    setPickupCalendarError(null);
    setPickupNextAvailableDate(null);
    setTimingError(null);

    const raw = sessionStorage.getItem(getBookingStorageKey());
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};

    sessionStorage.setItem(
      getBookingStorageKey(),
      JSON.stringify({
        ...existing,
        deliveryDate: d,

        maxPickupDate: undefined,
        maxDaysAllowed: undefined,
        limitedAck: false,

        pickupMode: "unspecified",
        pickupDate: undefined,
      }),
    );

    setHold({ state: "idle" });
  }

  function resetHoldState() {
    setHold({ state: "idle" });
  }

  function hasActiveHoldForDate(
    draft: Partial<BookingDraft>,
    selectedDeliveryYMD: string,
    selectedPickupYMD: string,
  ) {
    const holdId = (draft?.holdId || "").trim();
    const holdDelivery = (draft?.holdDeliveryDate || "").trim(); // should be YYYY-MM-DD
    const holdPickup = (draft?.holdPickupDate || "").trim();
    const expiresAt = (draft?.holdExpiresAt || "").trim();

    if (!holdId || !holdDelivery || !holdPickup || !expiresAt) return false;
    if (holdDelivery !== selectedDeliveryYMD) return false;
    if (holdPickup !== selectedPickupYMD) return false;

    const ms = Date.parse(expiresAt);
    if (!Number.isFinite(ms)) return false;

    return ms > Date.now();
  }

  // When date changes, check availability
  useEffect(() => {
    if (!ready || !bookingZip) return;

    const d = normalizedDate;

    // No date picked yet
    if (!d) {
      setAvailability({ state: "idle" });
      return;
    }

    // Invalid format (shouldn't happen with type="date", but safe)
    if (!isYmd(d)) {
      setAvailability({ state: "error", message: "Please select a valid date." });
      return;
    }

    let cancelled = false;

    (async () => {
      setAvailability({ state: "loading" });

      try {
        const params = new URLSearchParams({
          date: d,
          zip: bookingZip,
          dumpsterSize: selectedDumpster.dumpsterSize,
        });

        if (selectedDumpster.dumpsterProductId) {
          params.set("dumpsterProductId", selectedDumpster.dumpsterProductId);
        }

        const activeHoldId = getActiveHoldId();
        if (activeHoldId) {
          params.set("holdId", activeHoldId);
        }

        const res = await fetch(`/api/availability?${params.toString()}`, {
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
        const requestedPickupDate =
          typeof json?.requestedPickupDate === "string" ? json.requestedPickupDate : null;

        if (!Number.isFinite(remaining) || remaining <= 0) {
          setAvailability({ state: "none" });

          // ✅ clear persisted cap/ack
          const raw = sessionStorage.getItem(getBookingStorageKey());
          const existing: BookingDraft = raw ? JSON.parse(raw) : {};
          sessionStorage.setItem(
            getBookingStorageKey(),
            JSON.stringify({
              ...existing,
              maxPickupDate: undefined,
              maxDaysAllowed: undefined,
              limitedAck: false,
            })
          );

        } else {
          setAvailability({ state: "ok", remaining, requestedPickupDate });
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
  }, [
    bookingZip,
    getActiveHoldId,
    normalizedDate,
    ready,
    selectedDumpster,
    selectedPickupDate,
  ]);

  useEffect(() => {
    if (!ready || !isYmd(normalizedDate) || !hasPriceQuote) {
      setPickupCap({ state: "idle" });
      return;
    }

    let cancelled = false;
    setPickupCap({ state: "loading" });

    (async () => {
      try {
        const params = new URLSearchParams({
          deliveryDate: normalizedDate,
          dumpsterSize: selectedDumpster.dumpsterSize,
        });

        if (selectedDumpster.dumpsterProductId) {
          params.set("dumpsterProductId", selectedDumpster.dumpsterProductId);
        }

        const res = await fetch(`/api/pickup-cap?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.ok) {
          setPickupCap({
            state: "error",
            message: json?.error || "Could not verify pickup availability. Please try another delivery date.",
          });
          return;
        }

        setPickupCap({
          state: "ready",
          maxPickupDate: typeof json.maxPickupDate === "string" && isYmd(json.maxPickupDate) ? json.maxPickupDate : null,
          maxDaysAllowed: typeof json.maxDaysAllowed === "number" ? json.maxDaysAllowed : null,
        });
      } catch {
        if (cancelled) return;
        setPickupCap({
          state: "error",
          message: "Could not verify pickup availability. Please try another delivery date.",
        });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [hasPriceQuote, normalizedDate, pickupAvailabilityRetryKey, ready, selectedDumpster]);

  useEffect(() => {
    if (!ready || !isYmd(normalizedDate) || !standardPickupDate) return;

    if (!allowExtendedRentalAtBooking && needsExtraDays) {
      setNeedsExtraDays(false);
    }

    if (!allowExtendedRentalAtBooking || !needsExtraDays) {
      if (pickupDate !== standardPickupDate) {
        setPickupDate(standardPickupDate);
      }
    } else if (pickupDate && pickupDate <= standardPickupDate) {
      setPickupDate("");
    }
  }, [
    allowExtendedRentalAtBooking,
    needsExtraDays,
    normalizedDate,
    pickupDate,
    ready,
    standardPickupDate,
  ]);

  useEffect(() => {
    if (!ready || !bookingZip || !isYmd(normalizedDate) || !standardPickupDate) {
      setPickupCalendarEntries([]);
      setPickupCalendarLoading(false);
      setPickupCalendarError(null);
      setPickupNextAvailableDate(null);
      return;
    }

    let cancelled = false;
    const firstExtraPickupDate = addDaysYmd(standardPickupDate, 1);
    const pickupCalendarStart = toYmd(startOfMonth(parseYmd(standardPickupDate)));

    setPickupCalendarLoading(true);
    setPickupCalendarError(null);

    (async () => {
      try {
        const params = new URLSearchParams({
          start: pickupCalendarStart,
          days: "186",
          zip: bookingZip,
          deliveryDate: normalizedDate,
          dumpsterSize: selectedDumpster.dumpsterSize,
        });

        if (selectedDumpster.dumpsterProductId) {
          params.set("dumpsterProductId", selectedDumpster.dumpsterProductId);
        }

        addActiveHoldContextParams(params);

        const res = await fetch(`/api/availability/calendar?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.ok || !Array.isArray(json?.dates)) {
          const message = json?.error || "Could not load pickup availability. Please try another delivery date.";
          setPickupCalendarError(message);
          setPickupCalendarEntries([]);
          setPickupNextAvailableDate(null);
          return;
        }

        const nextEntries = (json.dates as CalendarAvailabilityEntry[]).map((entry) => {
          const beforeExtraWindow = entry.date < firstExtraPickupDate;
          const inIncludedRentalWindow = entry.date >= normalizedDate && entry.date <= standardPickupDate;
          const afterWindow = Boolean(maxPickupDate && entry.date > maxPickupDate);

          if (!beforeExtraWindow && !afterWindow && pickupCap.state !== "error") {
            return entry;
          }

          return {
            ...entry,
            remaining: 0,
            state: entry.state === "past" ? "past" : "unavailable",
            label: beforeExtraWindow
              ? inIncludedRentalWindow
                ? entry.date === standardPickupDate
                  ? "Pickup"
                  : "Included"
                : undefined
              : "Unavailable",
          } satisfies CalendarAvailabilityEntry;
        });

        setPickupCalendarEntries(nextEntries);
        setPickupNextAvailableDate(
          nextEntries.find((entry) => entry.state === "available" || entry.state === "limited")?.date ?? null,
        );
      } catch (error) {
        if (cancelled) return;
        const message =
          error instanceof Error ? error.message : "Could not load pickup availability. Please try another delivery date.";
        setPickupCalendarError(message);
        setPickupCalendarEntries([]);
        setPickupNextAvailableDate(null);
      } finally {
        if (!cancelled) setPickupCalendarLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bookingZip,
    maxPickupDate,
    normalizedDate,
    pickupCap.state,
    pickupAvailabilityRetryKey,
    ready,
    addActiveHoldContextParams,
    selectedDumpster,
    standardPickupDate,
  ]);

  const selectedPickupCalendarEntry = useMemo(
    () => pickupCalendarEntries.find((entry) => entry.date === pickupDate) || null,
    [pickupCalendarEntries, pickupDate],
  );

  const pickupTimingError = useMemo(() => {
    if (!isYmd(normalizedDate)) return null;
    if (pickupCap.state === "error") return pickupCap.message;
    if (pickupCalendarError) return pickupCalendarError;
    if (!standardPickupDate) return "We couldn’t determine the scheduled pickup date for this rental.";
    if (pickupCap.state === "ready" && operationalMaxPickupDate && standardPickupDate > operationalMaxPickupDate) {
      return `This delivery date isn’t available online because the included rental period would run past ${formatDateLong(
        operationalMaxPickupDate,
      )}. Please choose a different delivery date.`;
    }
    if (needsExtraDays) {
      if (!pickupDate) return "Choose a pickup date for your extra days.";
      if (!isYmd(pickupDate)) return "Choose a valid pickup date.";
      if (pickupDate <= standardPickupDate) {
        return `Extra-day pickup must be after ${formatDateLong(standardPickupDate)}.`;
      }
      if (maxPickupDate && pickupDate > maxPickupDate) {
        return `Pickup date must be on or before ${formatDateLong(maxPickupDate)}.`;
      }
      if (
        selectedPickupCalendarEntry &&
        selectedPickupCalendarEntry.state !== "available" &&
        selectedPickupCalendarEntry.state !== "limited"
      ) {
        return "That pickup date is unavailable. Please choose another date.";
      }
    }
    return null;
  }, [
    maxPickupDate,
    needsExtraDays,
    normalizedDate,
    operationalMaxPickupDate,
    pickupCap,
    pickupCalendarError,
    pickupDate,
    selectedPickupCalendarEntry,
    standardPickupDate,
  ]);

  useEffect(() => {
    if (!ready || !bookingZip || !isYmd(normalizedDate) || !isYmd(selectedPickupDate)) {
      setQuoteLoading(false);
      return;
    }

    if (
      priceQuoteMatchesSelection(draftQuote, {
        zip: bookingZip,
        dumpsterSize: selectedDumpster.dumpsterSize,
        dumpsterProductId: selectedDumpster.dumpsterProductId,
        deliveryDate: normalizedDate,
        pickupDate: selectedPickupDate,
        pickupMode,
      })
    ) {
      setQuoteLoading(false);
      return;
    }

    let cancelled = false;
    setQuoteLoading(true);
    setTimingError(null);

    (async () => {
      try {
        const params = new URLSearchParams({
          zip: bookingZip,
          deliveryDate: normalizedDate,
          pickupMode,
          pickupDate: selectedPickupDate,
          dumpsterSize: selectedDumpster.dumpsterSize,
        });

        if (selectedDumpster.dumpsterProductId) {
          params.set("dumpsterProductId", selectedDumpster.dumpsterProductId);
        }

        const res = await fetch(`/api/zip-check?${params.toString()}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.serviced || !json?.priceQuote) {
          setTimingError(json?.error || "We couldn’t refresh pricing for this rental period. Please try again.");
          return;
        }

        const nextQuote = json.priceQuote as BookingPriceQuote;
        setDraftQuote(nextQuote);

        const raw = sessionStorage.getItem(getBookingStorageKey());
        const existing: BookingDraft = raw ? JSON.parse(raw) : {};
        sessionStorage.setItem(
          getBookingStorageKey(),
          JSON.stringify({
            ...existing,
            deliveryDate: normalizedDate,
            pickupMode,
            pickupDate: selectedPickupDate,
            maxPickupDate: pickupCap.state === "ready" ? pickupCap.maxPickupDate ?? undefined : existing.maxPickupDate,
            maxDaysAllowed:
              pickupCap.state === "ready" ? pickupCap.maxDaysAllowed ?? undefined : existing.maxDaysAllowed,
            limitedAck: false,
            priceQuote: nextQuote,
          }),
        );
      } catch {
        if (cancelled) return;
        setTimingError("We couldn’t refresh pricing for this rental period. Please try again.");
      } finally {
        if (!cancelled) setQuoteLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    bookingZip,
    draftQuote,
    normalizedDate,
    pickupCap,
    pickupMode,
    ready,
    selectedDumpster,
    selectedPickupDate,
  ]);

  const canContinue =
    ready &&
    isYmd(normalizedDate) &&
    isYmd(selectedPickupDate) &&
    availability.state === "ok" &&
    availability.remaining > 0 &&
    pickupCap.state === "ready" &&
    !pickupTimingError &&
    !timingError &&
    !quoteLoading &&
    quoteMatchesCurrentSelection &&
    (!needsExtraDays || !pickupCalendarLoading) &&
    hold.state !== "creating" &&
    (!cap || limitedAck); // ✅ require ack only when capped;

  async function handleContinue() {
    if (!ready) return;

    const d = normalizedDate;

    // guard
    if (!isYmd(d)) return;
    if (!isYmd(selectedPickupDate)) {
      setHold({
        state: "error",
        message: "Please choose a pickup date before continuing.",
      });
      return;
    }

    if (
      pickupTimingError ||
      timingError ||
      quoteLoading ||
      !quoteMatchesCurrentSelection ||
      pickupCap.state !== "ready" ||
      (needsExtraDays && pickupCalendarLoading)
    ) {
      setHold({
        state: "error",
        message: pickupTimingError || timingError || "Please wait while we verify rental timing.",
      });
      return;
    }

    // ✅ if we already have an active hold for this same date, reuse it
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      if (hasActiveHoldForDate(existing, d, selectedPickupDate)) {
        sessionStorage.setItem(
          getBookingStorageKey(),
          JSON.stringify({
            ...existing,
            deliveryDate: d,
            pickupMode,
            pickupDate: selectedPickupDate,
            holdPickupDate: selectedPickupDate,
            priceQuote: draftQuote ?? existing.priceQuote ?? null,
            maxPickupDate: pickupCap.maxPickupDate ?? undefined,
            maxDaysAllowed: pickupCap.maxDaysAllowed ?? undefined,
          }),
        );
        router.push("/book/placement");
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
    let bodyRentalDays = 1;
    let dumpsterSize = "";
    let dumpsterProductId: string | null = null;
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      zip = (existing.zip || existing.customerZip || "").trim();
      bodyRentalDays = Math.max(1, Math.round((Date.parse(selectedPickupDate) - Date.parse(d)) / 86400000));
      dumpsterSize = (existing.dumpsterSize || "").trim();
      dumpsterProductId = (existing.dumpsterProductId || "").trim() || null;
    } catch {
      zip = "";
      bodyRentalDays = 1;
      dumpsterSize = "";
      dumpsterProductId = null;
    }

    if (!zip || !dumpsterSize) {
      setHold({
        state: "error",
        message: "Your booking session is missing the service ZIP or dumpster size. Please go back and choose your dumpster again.",
      });
      return;
    }

    try {
      const res = await fetch("/api/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          deliveryDate: d,
          rentalDays: bodyRentalDays,
          zip,
          dumpsterSize,
          dumpsterProductId,
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
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          deliveryDate: d,
          pickupMode,
          pickupDate: selectedPickupDate,
          holdId: json.holdId,
          holdDeliveryDate: d,
          holdPickupDate: selectedPickupDate,
          holdExpiresAt: json.expiresAt,
          holdDumpsterSize: selectedDumpster.dumpsterSize,
          holdDumpsterProductId: selectedDumpster.dumpsterProductId,
          maxPickupDate: pickupCap.maxPickupDate ?? undefined,
          maxDaysAllowed: pickupCap.maxDaysAllowed ?? undefined,
          priceQuote: draftQuote ?? existing.priceQuote ?? null,
        })
      );

      setHold({ state: "idle" });
      router.push("/book/placement");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "Hold failed. Please try again.";
      setHold({
        state: "error",
        message,
      });
    }
  }

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-3 pt-10 pb-16 sm:px-6">
        <div className="min-w-0 rounded-[32px] bg-white px-4 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          {/* Header stack (match Step 1 style) */}
          <div className="space-y-3">
            <div className="mx-auto w-full max-w-2xl mb-4">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 2 of 5
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-2/5 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">
              {content.title}
            </h1>
          </div>

          <section className="mt-8">
            <div className="mx-auto grid w-full max-w-[640px] min-w-0 gap-6 [&>*]:w-full">
              <div className="min-w-0">
                {isYmd(normalizedDate) ? (
                  <div className="inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-[#F97316]/20 bg-[#FFF7ED] px-3 py-1.5 text-center text-sm font-semibold leading-5 text-[#C2410C] shadow-sm sm:h-9 sm:px-3.5 sm:py-0">
                    Selected delivery: {formatDateLong(normalizedDate)}
                  </div>
                ) : highlightedEarliestDate ? (
                  <button
                    type="button"
                    onClick={() => updateDeliveryDate(highlightedEarliestDate)}
                    className="inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-center text-sm font-semibold leading-5 text-emerald-800 shadow-sm transition hover:border-emerald-300 hover:bg-white focus:outline-none focus:ring-4 focus:ring-emerald-100 sm:h-9 sm:px-3.5 sm:py-0"
                  >
                    <span className="sm:hidden">Earliest delivery: {formatDateShort(highlightedEarliestDate)}</span>
                    <span className="hidden sm:inline">
                      {content.earliestAvailablePrefix} {formatDateLong(highlightedEarliestDate)}
                    </span>
                  </button>
                ) : null}

                <p className="mt-5 text-sm leading-6 text-slate-600">
                  Available dates show when a full rental window can be scheduled.
                </p>
                {standardRentalDays ? (
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    This dumpster includes a {standardRentalDays}-day rental. Available delivery dates must also have an open pickup date.
                  </p>
                ) : null}

                <div className="mt-4 mb-5 min-w-0">
                  <AvailabilityCalendar
                    selectedDate={normalizedDate}
                    onSelectDate={updateDeliveryDate}
                    entries={calendarEntries}
                    loading={deliveryCalendarLoading}
                    loadError={calendarError}
                    nextAvailableDate={nextAvailableDate}
                    loadingMessage="Checking delivery availability..."
                    availabilityNote={content.footerNote}
                    onRetry={() => {
                      void loadCalendarRange(calendarRangeStart);
                    }}
                    getTileVariant={(entry, context) => {
                      if (!entry) return null;
                      if (hasSelectedDeliveryDate && standardPickupDate) {
                        if (context.date <= normalizedDate || context.date > standardPickupDate) return null;
                        return context.date === standardPickupDate ? "rental-pickup" : "rental-day";
                      }
                      return null;
                    }}
                    getTileLabel={(entry, context) => {
                      if (!context.isCurrentMonth) return null;
                      if (hasSelectedDeliveryDate && context.date === normalizedDate) return "Selected";
                      if (
                        hasSelectedDeliveryDate &&
                        standardPickupDate &&
                        entry &&
                        context.date > normalizedDate &&
                        context.date <= standardPickupDate
                      ) {
                        return context.date === standardPickupDate ? "Pickup" : "Included";
                      }
                      if (!entry || entry.state === "past") return "Past";
                      if (entry.state === "unavailable") return "Unavailable";
                      return `${entry.remaining} left`;
                    }}
                    getAriaLabel={(entry, date) => {
                      const baseDate = formatDateLong(date);
                      if (date === normalizedDate) {
                        return `${baseDate}. Selected delivery date.`;
                      }
                      if (hasSelectedDeliveryDate && standardPickupDate && date > normalizedDate && date <= standardPickupDate) {
                        return date === standardPickupDate
                          ? `${baseDate}. Recommended pickup date for this rental.`
                          : `${baseDate}. Included rental day.`;
                      }
                      return `${baseDate}. ${
                        !entry
                          ? "Availability not loaded"
                          : entry.state === "past"
                            ? "Past"
                            : entry.state === "available"
                              ? "Available for delivery"
                              : entry.state === "limited"
                                ? `${entry.remaining} delivery slot${entry.remaining === 1 ? "" : "s"} left`
                                : "Unavailable for delivery"
                      }.`;
                    }}
                  />
                </div>

                {displayRentalWindowDeliveryDate && displayRentalWindowPickupDate && draftQuote ? (
                  <div className="max-w-full rounded-2xl border border-[#FDBA74]/60 bg-[#FFF7ED] px-4 py-4 text-sm text-[#9A3412]">
                    <div className="mb-3 text-sm font-semibold text-slate-950">
                      Selected rental window
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2">
                      <div>
                        <span className="font-semibold text-slate-950">Delivery:</span>{" "}
                        {formatDateShort(displayRentalWindowDeliveryDate)}
                      </div>
                      <div>
                        <span className="font-semibold text-slate-950">Pickup:</span>{" "}
                        {formatDateShort(displayRentalWindowPickupDate)}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

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
                      onChange={() => {}}
                    />
                    <span>I understand my rental must end by {cap.maxPickupDate}.</span>
                  </label>
                </div>
              )}

              {isYmd(normalizedDate) && draftQuote ? (
                <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">Rental timing</h3>
                    <p className="text-sm leading-6 text-slate-600">
                      Your rental includes{" "}
                      <span className="font-semibold text-slate-900">
                        {standardRentalDays} day{standardRentalDays === 1 ? "" : "s"}
                      </span>
                      .
                    </p>
                  </div>

                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                    <div>
                      Pickup is scheduled for{" "}
                      <span className="font-semibold text-slate-900">
                        {standardPickupDate ? formatDateLong(standardPickupDate) : "Checking..."}
                      </span>
                      .
                    </div>
                  </div>

                  {pickupCap.state === "loading" ? (
                    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      Checking pickup availability...
                    </div>
                  ) : null}

                  {allowExtendedRentalAtBooking ? (
                    <div className="mt-4 min-w-0 space-y-4">
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm transition hover:border-slate-300 hover:bg-slate-50">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={needsExtraDays}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setNeedsExtraDays(checked);
                            setTimingError(null);
                            resetHoldState();
                            if (!checked) {
                              setPickupDate(standardPickupDate);
                            } else {
                              setPickupDate("");
                            }
                          }}
                        />
                        <span>
                          <span className="block font-semibold text-slate-900">Need more time?</span>
                          <span className="mt-1 block leading-6 text-slate-600">
                            Keep the dumpster longer by choosing a later pickup date. Extra days are{" "}
                            {formatUsdFromCents(dailyOveragePriceCents)} per day.
                          </span>
                          <span className="mt-2 block font-semibold text-[#F97316]">
                            {needsExtraDays ? "Remove extra days" : "Add extra days"}
                          </span>
                        </span>
                      </label>

                      {needsExtraDays ? (
                        <div className="min-w-0 space-y-3">
                          <div className="space-y-1">
                            <h4 className="text-base font-semibold text-slate-900">Choose a pickup date</h4>
                            <p className="text-sm leading-6 text-slate-600">
                              Your included pickup date is {formatDateLong(standardPickupDate)}. Choose a later available pickup date if you need more time.
                            </p>
                          </div>

                          {pickupNextAvailableDate ? (
                            <button
                              type="button"
                              onClick={() => {
                                setPickupDate(pickupNextAvailableDate);
                                setTimingError(null);
                                resetHoldState();
                              }}
                              className="inline-flex min-h-9 max-w-full items-center justify-center rounded-full border border-[#F97316]/20 bg-[#FFF7ED] px-3 py-1.5 text-center text-sm font-semibold leading-5 text-[#C2410C] shadow-sm transition hover:border-[#F97316]/35 hover:bg-white focus:outline-none focus:ring-4 focus:ring-[#F97316]/15 sm:h-9 sm:px-3.5 sm:py-0"
                            >
                              <span className="sm:hidden">Earliest extra pickup: {formatDateShort(pickupNextAvailableDate)}</span>
                              <span className="hidden sm:inline">
                                Earliest extra-day pickup: {formatDateLong(pickupNextAvailableDate)}
                              </span>
                            </button>
                          ) : null}

                          <AvailabilityCalendar
                            selectedDate={needsExtraDays ? pickupDate : ""}
                            onSelectDate={(value) => {
                              setPickupDate(value);
                              setTimingError(null);
                              resetHoldState();
                            }}
                            entries={pickupCalendarEntries}
                            loading={pickupCalendarIsLoading}
                            loadError={pickupCalendarError || (pickupCap.state === "error" ? pickupCap.message : null)}
                            nextAvailableDate={pickupNextAvailableDate}
                            onRetry={() => {
                              setPickupCalendarError(null);
                              setTimingError(null);
                              setPickupAvailabilityRetryKey((key) => key + 1);
                            }}
                            getTileVariant={(entry, context) => {
                              if (!entry || !context.isCurrentMonth || !isYmd(normalizedDate) || !standardPickupDate) {
                                return null;
                              }

                              if (context.date >= normalizedDate && context.date <= standardPickupDate) {
                                return context.date === standardPickupDate ? "rental-pickup" : "rental-day";
                              }

                              if (
                                isYmd(pickupDate) &&
                                pickupDate > standardPickupDate &&
                                context.date > standardPickupDate &&
                                context.date < pickupDate
                              ) {
                                return "rental-day";
                              }

                              return null;
                            }}
                            getTileLabel={(entry, context) => {
                              if (!context.isCurrentMonth) return null;
                              if (isYmd(normalizedDate) && context.date < normalizedDate) return null;
                              if (isYmd(pickupDate) && context.date === pickupDate) return "Pickup";
                              if (
                                isYmd(pickupDate) &&
                                pickupDate > standardPickupDate &&
                                context.date > standardPickupDate &&
                                context.date < pickupDate
                              ) {
                                return "Extra";
                              }
                              if (!entry || entry.state === "past") return "Past";
                              if (entry.label) return entry.label;
                              if (entry.state === "available") return "Open";
                              if (entry.state === "limited") {
                                return entry.remaining > 0 ? `${entry.remaining} left` : "Open";
                              }
                              return "Unavailable";
                            }}
                            legendItems={[
                              { label: "Available pickup date", shortLabel: "Available", dotClassName: "bg-emerald-500" },
                              { label: "Unavailable pickup date", shortLabel: "Unavailable", dotClassName: "bg-slate-400" },
                              { label: "Selected rental window", shortLabel: "Selected", dotClassName: "bg-[#F97316]" },
                            ]}
                            loadingMessage="Checking pickup availability..."
                            emptyMonthMessage={(monthLabel, nextAvailable) =>
                              `No pickup dates are available in ${monthLabel}.${nextAvailable ? ` Earliest pickup: ${formatDateLong(nextAvailable)}.` : ""}`
                            }
                            getAriaLabel={(entry, date) =>
                              `${formatDateLong(date)}. ${
                                date === pickupDate
                                  ? "Selected pickup date"
                                  : isYmd(normalizedDate) && date < normalizedDate
                                    ? "Unavailable for pickup"
                                    : isYmd(normalizedDate) && date >= normalizedDate && date < standardPickupDate
                                      ? "Included rental day"
                                      : date === standardPickupDate
                                        ? "Scheduled pickup date"
                                        : isYmd(pickupDate) &&
                                            pickupDate > standardPickupDate &&
                                            date > standardPickupDate &&
                                            date < pickupDate
                                          ? "Extra rental day"
                                          : !entry || entry.state === "past"
                                            ? "Past"
                                            : entry.state === "available"
                                              ? "Open for pickup"
                                              : entry.state === "limited"
                                                ? `${entry.remaining} pickup slot${entry.remaining === 1 ? "" : "s"} left`
                                                : "Unavailable for pickup"
                              }.`
                            }
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {needsExtraDays && isYmd(selectedPickupDate) ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-700 shadow-sm">
                      <div>
                        Selected pickup date:{" "}
                        <span className="font-semibold text-slate-900">
                          {formatDateLong(selectedPickupDate)}
                        </span>
                      </div>
                      {extraDays > 0 ? (
                        <>
                          <div className="mt-2">
                            You added{" "}
                            <span className="font-semibold text-slate-900">
                              {extraDays} extra day{extraDays === 1 ? "" : "s"}
                            </span>{" "}
                            at {formatUsdFromCents(dailyOveragePriceCents)} per day.
                          </div>
                          <div className="mt-2">
                            Extra days total:{" "}
                            <span className="font-semibold text-slate-900">
                              {formatUsdFromCents(extraDaysChargeCents)}
                            </span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  ) : null}

                  {draftQuote ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-700">
                      <div className="flex items-center justify-between gap-4">
                        <span>Base price</span>
                        <span className="font-semibold text-slate-900">
                          {formatUsdFromCents(draftQuote.rentalPriceCents)}
                        </span>
                      </div>
                      {extraDays > 0 ? (
                        <div className="mt-2 flex items-center justify-between gap-4">
                          <span>
                            Extra days ({extraDays} x {formatUsdFromCents(dailyOveragePriceCents)})
                          </span>
                          <span className="font-semibold text-slate-900">
                            {formatUsdFromCents(extraDaysChargeCents)}
                          </span>
                        </div>
                      ) : null}
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <span>Estimated tax</span>
                        <span className="font-semibold text-slate-900">
                          {quoteLoading ? "Calculating..." : formatUsdFromCents(estimatedSalesTaxCents)}
                        </span>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-4 border-t border-slate-200 pt-3">
                        <span className="font-semibold text-slate-900">Estimated total</span>
                        <span className="font-semibold text-slate-900">
                          {quoteLoading ? "Calculating..." : formatUsdFromCents(estimatedTotalCents)}
                        </span>
                      </div>
                    </div>
                  ) : null}

                  {pickupTimingError || timingError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                      {pickupTimingError || timingError}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {/* Note */}
              <div className="w-full rounded-xl bg-slate-50 border border-slate-200 p-4 text-sm text-slate-600">
                {"We'll hold your selected dates for "}
                {holdMinutes}
                {" minutes while you finish booking."}
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
                    {hold.state === "creating"
                      ? "Holding..."
                      : isYmd(normalizedDate)
                        ? "Continue to your details"
                        : "Select a delivery date to continue"}
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
                  href={backToDumpsterHref}
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
