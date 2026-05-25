/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BlockedZipPanel } from "@/components/BlockedZipPanel";
import { normalizeBookingOrigin } from "@/lib/booking-origin";
import type { BookingPriceQuote } from "@/lib/booking-pricing";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { getReorderNotice } from "@/lib/reorder";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type BookingDraft = {
  zip?: string;
  county?: string;
  town?: string;
  serviceState?: string | null;
  dumpsterSize?: string;
  dumpsterProductId?: string | null;
  dumpsterDisplayName?: string;
  includedWeightTons?: number;
  tonOveragePrice?: number;
  includedRentalDays?: number;
  extraDayPrice?: number;
  basePrice?: number;
  deliveryDate?: string;
  holdId?: string;
  holdDeliveryDate?: string;
  holdExpiresAt?: string;
  priceQuote?: BookingPriceQuote | null;
  pickupMode?: "unspecified" | "date";
  pickupDate?: string;
  maxPickupDate?: string;
  maxDaysAllowed?: number;
  limitedAck?: boolean;
  reorderSourceBookingId?: string;
  reorderSourceBookingRef?: string | null;
  bookingOrigin?: string | null;
};

type ZipStatus =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "valid"; county: string; town: string; serviceState?: string | null }
  | { state: "invalid"; message: string };

function inputClass() {
  return "h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-900 shadow-sm outline-none transition focus:border-[#F97316] focus:ring-4 focus:ring-[#F97316]/15";
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

function formatTemplate(template: string, values: Record<string, string>) {
  return Object.entries(values).reduce(
    (message, [key, value]) => message.replace(`{${key}}`, value),
    template,
  );
}

function sanitizeZip(value: string | null | undefined) {
  return String(value ?? "").replace(/\D/g, "").slice(0, 5);
}

type AddressStepPageClientProps = {
  content: {
    title: string;
    description: string;
    serviceAreaNotice: string;
    zipIdleHelper: string;
    zipValidTemplate: string;
    unsupportedZipMessage: string;
  };
};

export default function AddressStepPageClient({ content }: AddressStepPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const zipSectionRef = useRef<HTMLDivElement | null>(null);
  const [zip, setZip] = useState("");
  const [zipStatus, setZipStatus] = useState<ZipStatus>({ state: "idle" });
  const [bookingOrigin, setBookingOrigin] = useState<"pricing" | "book">("book");
  const [reorderNotice, setReorderNotice] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);

  const reorderFromQuery = useMemo(() => (searchParams.get("reorderFrom") || "").trim(), [searchParams]);
  const originFromQuery = useMemo(
    () => normalizeBookingOrigin(searchParams.get("origin")),
    [searchParams],
  );
  const zipFromQuery = useMemo(() => sanitizeZip(searchParams.get("zip")), [searchParams]);
  const selectedDumpsterFromQuery = useMemo(
    () =>
      resolveSelectedDumpster({
        dumpsterSize: searchParams.get("dumpsterSize"),
        dumpsterProductId: searchParams.get("dumpsterProductId"),
      }),
    [searchParams],
  );
  const hasSelectedDumpsterInQuery = useMemo(
    () =>
      Boolean(
        (searchParams.get("dumpsterSize") || "").trim() ||
          (searchParams.get("dumpsterProductId") || "").trim(),
      ),
    [searchParams],
  );

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      const nextOrigin = normalizeBookingOrigin(existing.bookingOrigin ?? originFromQuery);
      const storedZip = sanitizeZip(existing.zip);
      const nextZip = zipFromQuery || storedZip;
      const hasValidatedStoredZip = Boolean(storedZip && existing.town && existing.county);
      const hasStoredDumpsterSelection = Boolean(
        (existing.dumpsterSize || "").trim() || (existing.dumpsterProductId || "").trim(),
      );

      setBookingOrigin(nextOrigin);
      if (nextZip) setZip(nextZip);

      if (existing.reorderSourceBookingRef) {
        setReorderNotice(getReorderNotice(existing.reorderSourceBookingRef));
      }

      if (existing.town && existing.county && storedZip && storedZip === nextZip) {
        setZipStatus({
          state: "valid",
          town: existing.town,
          county: existing.county,
          serviceState: existing.serviceState ?? null,
        });
      }

      if (hasValidatedStoredZip) {
        if (hasStoredDumpsterSelection || hasSelectedDumpsterInQuery) {
          if (hasSelectedDumpsterInQuery) {
            const params = new URLSearchParams({
              zip: storedZip,
              dumpsterSize: selectedDumpsterFromQuery.dumpsterSize,
            });
            if (selectedDumpsterFromQuery.dumpsterProductId) {
              params.set("dumpsterProductId", selectedDumpsterFromQuery.dumpsterProductId);
            }
            router.replace(`/book/date?${params.toString()}`);
          } else {
            router.replace("/book/date");
          }
        } else {
          router.replace(`/book?zip=${encodeURIComponent(storedZip)}`);
        }
        return;
      }

      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          bookingOrigin: nextOrigin,
          ...(hasSelectedDumpsterInQuery
            ? {
                dumpsterSize: selectedDumpsterFromQuery.dumpsterSize,
                dumpsterProductId: selectedDumpsterFromQuery.dumpsterProductId,
              }
            : {}),
        }),
      );
    } catch {
      // ignore
    }
  }, [hasSelectedDumpsterInQuery, originFromQuery, router, selectedDumpsterFromQuery, zipFromQuery]);

  useEffect(() => {
    if (!reorderFromQuery) return;

    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};

      if (existing.reorderSourceBookingId === reorderFromQuery) {
        setReorderError(null);
        setReorderNotice(getReorderNotice(existing.reorderSourceBookingRef));
        const existingZip = sanitizeZip(existing.zip);
        if (existingZip) setZip(existingZip);
        return;
      }
    } catch {
      // ignore
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`/api/portal/reorder-source?bookingId=${encodeURIComponent(reorderFromQuery)}`, {
          cache: "no-store",
        });
        const json = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (!res.ok || !json?.ok || !json?.draft) {
          setReorderError(json?.error || "We couldn’t reuse that past rental. You can still book manually.");
          setReorderNotice(null);
          return;
        }

        const nextDraft = json.draft as BookingDraft;
        const nextZip = sanitizeZip(nextDraft.zip);
        sessionStorage.setItem(
          getBookingStorageKey(),
          JSON.stringify({
            ...nextDraft,
            deliveryDate: undefined,
            holdId: undefined,
            holdDeliveryDate: undefined,
            holdExpiresAt: undefined,
            pickupMode: "unspecified",
            pickupDate: undefined,
            maxPickupDate: undefined,
            maxDaysAllowed: undefined,
            limitedAck: false,
            bookingOrigin: originFromQuery,
          }),
        );

        setZip(nextZip);
        setZipStatus({ state: "idle" });
        setReorderError(null);
        setReorderNotice(getReorderNotice(nextDraft.reorderSourceBookingRef));
      } catch {
        if (cancelled) return;
        setReorderError("We couldn’t reuse that past rental. You can still book manually.");
        setReorderNotice(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [originFromQuery, reorderFromQuery]);

  function persistServiceArea({
    nextZip,
    county,
    town,
    serviceState,
    priceQuote,
  }: {
    nextZip: string;
    county: string;
    town: string;
    serviceState?: string | null;
    priceQuote: BookingPriceQuote | null;
  }) {
    const raw = sessionStorage.getItem(getBookingStorageKey());
    const existing: BookingDraft = raw ? JSON.parse(raw) : {};
    const previousZip = sanitizeZip(existing.zip);
    const zipChanged = Boolean(previousZip && previousZip !== nextZip);

    sessionStorage.setItem(
      getBookingStorageKey(),
      JSON.stringify({
        ...existing,
        zip: nextZip,
        county,
        town,
        serviceState,
        bookingOrigin,
        priceQuote: zipChanged ? null : priceQuote,
        ...(zipChanged && !hasSelectedDumpsterInQuery
          ? {
              dumpsterSize: undefined,
              dumpsterProductId: undefined,
              dumpsterDisplayName: undefined,
              includedWeightTons: undefined,
              tonOveragePrice: undefined,
              includedRentalDays: undefined,
              extraDayPrice: undefined,
              basePrice: undefined,
            }
          : hasSelectedDumpsterInQuery
            ? {
                dumpsterSize: selectedDumpsterFromQuery.dumpsterSize,
                dumpsterProductId: selectedDumpsterFromQuery.dumpsterProductId,
              }
            : {}),
        ...(zipChanged
          ? {
              deliveryDate: undefined,
              holdId: undefined,
              holdDeliveryDate: undefined,
              holdExpiresAt: undefined,
              pickupMode: "unspecified",
              pickupDate: undefined,
              maxPickupDate: undefined,
              maxDaysAllowed: undefined,
              limitedAck: false,
            }
          : {}),
      }),
    );
  }

  async function handleZipCheck(zipOverride?: string): Promise<boolean> {
    const nextZip = sanitizeZip(zipOverride ?? zip);

    if (!/^\d{5}$/.test(nextZip)) {
      setZipStatus({ state: "invalid", message: "Enter a valid 5-digit ZIP code." });
      return false;
    }

    setZipStatus({ state: "checking" });

    const params = new URLSearchParams({
      zip: nextZip,
      dumpsterSize: selectedDumpsterFromQuery.dumpsterSize,
    });
    if (selectedDumpsterFromQuery.dumpsterProductId) {
      params.set("dumpsterProductId", selectedDumpsterFromQuery.dumpsterProductId);
    }

    const res = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
    const json = await res.json().catch(() => ({}));

    if (!res.ok) {
      setZipStatus({ state: "invalid", message: json?.error || "ZIP check failed." });
      return false;
    }

    if (!json?.serviced) {
      setZipStatus({ state: "invalid", message: content.unsupportedZipMessage });
      return false;
    }

    const county = String(json.county ?? "");
    const town = String(json.town ?? "");
    const serviceState = /^[A-Za-z]{2}$/.test(String(json.state ?? "").trim())
      ? String(json.state).trim().toUpperCase()
      : null;
    persistServiceArea({
      nextZip,
      county,
      town,
      serviceState,
      priceQuote: json.priceQuote ?? null,
    });

    setZip(nextZip);
    setZipStatus({ state: "valid", county, town, serviceState });
    return true;
  }

  async function handleContinue() {
    const ok = zipStatus.state === "valid" ? true : await handleZipCheck();
    if (!ok) {
      zipSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const params = new URLSearchParams({ zip: sanitizeZip(zip), origin: bookingOrigin });
    if (hasSelectedDumpsterInQuery) {
      params.set("dumpsterSize", selectedDumpsterFromQuery.dumpsterSize);
      if (selectedDumpsterFromQuery.dumpsterProductId) {
        params.set("dumpsterProductId", selectedDumpsterFromQuery.dumpsterProductId);
      }
    }

    router.push(`/book?${params.toString()}`);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <div className="rounded-[32px] bg-white px-10 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          <div className="space-y-3">
            <div className="mx-auto mb-4 w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Service area
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-0 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Service ZIP</h1>
            <p className="text-[#475569]">
              Enter the ZIP where the dumpster will be delivered. We will check service area before showing dumpster sizes.
            </p>
          </div>

          <section className="mt-8 space-y-6">
            {reorderNotice ? (
              <div className="rounded-xl border border-orange-200 bg-orange-50 px-4 py-4 text-sm leading-6 text-slate-700">
                <div className="font-semibold text-slate-900">Booking from a previous rental</div>
                <div className="mt-1">{reorderNotice}</div>
              </div>
            ) : null}

            {reorderError ? (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm leading-6 text-amber-900">
                {reorderError}
              </div>
            ) : null}

            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-sm text-slate-600">{content.serviceAreaNotice}</div>
            </div>

            <div ref={zipSectionRef} className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Delivery ZIP code</label>
                <input
                  value={zip}
                  onChange={(e) => {
                    setZip(sanitizeZip(e.target.value));
                    setZipStatus({ state: "idle" });
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void handleZipCheck();
                    }
                  }}
                  className={inputClass()}
                  placeholder="e.g., 13202"
                  inputMode="numeric"
                  autoComplete="postal-code"
                  maxLength={5}
                />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  className="inline-flex h-11 items-center justify-center rounded-2xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={() => void handleZipCheck()}
                  disabled={zipStatus.state === "checking"}
                >
                  {zipStatus.state === "checking" ? "Checking..." : "Check service area"}
                </button>

                {zipStatus.state === "idle" ? (
                  <div className="text-sm text-slate-600">{content.zipIdleHelper}</div>
                ) : null}
              </div>

              {zipStatus.state === "valid" ? (
                <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
                  {formatTemplate(content.zipValidTemplate, {
                    town: zipStatus.town,
                    county: zipStatus.county,
                  })}
                </div>
              ) : null}

              {zipStatus.state === "invalid" ? (
                <div className="mt-4 space-y-4">
                  <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
                    {zipStatus.message}
                  </div>
                  {/^\d{5}$/.test(sanitizeZip(zip)) ? <BlockedZipPanel zip={sanitizeZip(zip)} /> : null}
                </div>
              ) : null}
            </div>

            <div className="grid gap-2">
              <button
                type="button"
                disabled={zipStatus.state === "checking" || !/^\d{5}$/.test(sanitizeZip(zip))}
                onClick={() => void handleContinue()}
                className="group h-14 w-full rounded-2xl bg-[#F97316] text-base font-semibold text-white shadow-md transition-all duration-200 ease-out hover:bg-[#EA6A10] hover:shadow-lg active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex items-center justify-center gap-2">
                  Check availability
                  <span className="text-white/90 transition-transform group-hover:translate-x-1">→</span>
                </span>
              </button>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
