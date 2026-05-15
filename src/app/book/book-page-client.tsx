"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BlockedZipPanel } from "@/components/BlockedZipPanel";
import { normalizeBookingOrigin } from "@/lib/booking-origin";
import type { BookingPriceQuote } from "@/lib/booking-pricing";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import { resolveSelectedDumpster } from "@/lib/booking-product";
import { parseCustomerBulletPoints } from "@/lib/product-card-content";
import type { PublicDumpsterProduct } from "@/lib/dumpster-product-settings";

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
  bookingOrigin?: string | null;
};

type BookPageClientProps = {
  zip: string;
  zipValid: boolean;
  blocked: boolean;
  entryContent: {
    title: string;
    subtitle: string;
    sectionTitle: string;
    sectionDescription: string;
    blockedCtaText: string;
  };
  products: PublicDumpsterProduct[];
  initialSelectedDumpster: {
    dumpsterSize?: string | null;
    dumpsterProductId?: string | null;
  };
  initialOrigin?: string | null;
  isEditingDumpster?: boolean;
};

const DIMENSIONS_FALLBACK = "Approximate dimensions available at booking";

function formatIncludedWeight(tons: number) {
  return `Includes ${tons} ton${tons === 1 ? "" : "s"}`;
}

function formatDimensions(dimensions?: string | null) {
  const trimmed = dimensions?.trim();
  return trimmed || DIMENSIONS_FALLBACK;
}

function formatShortDescription(description?: string | null) {
  return description?.trim() || "";
}

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

export default function BookPageClient({
  zip,
  zipValid,
  blocked,
  entryContent,
  products,
  initialSelectedDumpster,
  initialOrigin,
  isEditingDumpster = false,
}: BookPageClientProps) {
  const router = useRouter();
  const [isContinuing, setIsContinuing] = useState(false);
  const [selectionError, setSelectionError] = useState<string | null>(null);
  const [selectedDumpster, setSelectedDumpster] = useState(() => {
    const fallback = resolveSelectedDumpster(initialSelectedDumpster);
    if (typeof window === "undefined") return fallback;

    try {
      const raw = window.sessionStorage.getItem(getBookingStorageKey());
      const stored: BookingDraft = raw ? JSON.parse(raw) : {};
      return resolveSelectedDumpster({
        dumpsterSize: stored.dumpsterSize ?? initialSelectedDumpster.dumpsterSize,
        dumpsterProductId: stored.dumpsterProductId ?? initialSelectedDumpster.dumpsterProductId,
      });
    } catch {
      return fallback;
    }
  });

  const selectedKey = `${selectedDumpster.dumpsterSize}:${selectedDumpster.dumpsterProductId ?? ""}`;

  const selectedProduct = useMemo(() => {
    return products.find(
      (product) =>
        product.dumpsterSize === selectedDumpster.dumpsterSize &&
        product.dumpsterProductId === selectedDumpster.dumpsterProductId,
    ) ?? null;
  }, [products, selectedDumpster.dumpsterProductId, selectedDumpster.dumpsterSize]);

  useEffect(() => {
    if (isEditingDumpster) return;
    if (!zipValid || blocked || !selectedProduct) return;

    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      const storedZip = String(existing.zip || "").replace(/\D/g, "").slice(0, 5);
      const hasStoredDumpsterSelection = Boolean(
        (existing.dumpsterSize || "").trim() || (existing.dumpsterProductId || "").trim(),
      );

      if (storedZip === zip && hasStoredDumpsterSelection) {
        const params = new URLSearchParams({ zip });
        params.set("dumpsterSize", selectedProduct.dumpsterSize);
        if (selectedProduct.dumpsterProductId) {
          params.set("dumpsterProductId", selectedProduct.dumpsterProductId);
        }
        params.set("origin", "book");
        router.replace(`/book/date?${params.toString()}`);
      }
    } catch {
      // ignore
    }
  }, [blocked, isEditingDumpster, router, selectedProduct, zip, zipValid]);

  function persistSelection(product: PublicDumpsterProduct) {
    const selectionChanged =
      selectedDumpster.dumpsterSize !== product.dumpsterSize ||
      selectedDumpster.dumpsterProductId !== product.dumpsterProductId;

    setSelectedDumpster({
      dumpsterSize: product.dumpsterSize,
      dumpsterProductId: product.dumpsterProductId,
    });

    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          zip: zipValid ? zip : existing.zip,
          dumpsterSize: product.dumpsterSize,
          dumpsterProductId: product.dumpsterProductId,
          dumpsterDisplayName: product.displayName,
          includedWeightTons: product.includedWeightTons,
          tonOveragePrice: product.tonOveragePrice,
          includedRentalDays: product.includedRentalDays,
          extraDayPrice: product.extraDayPrice,
          basePrice: product.basePrice,
          ...(selectionChanged
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
                priceQuote: null,
              }
            : {}),
          bookingOrigin: normalizeBookingOrigin(existing.bookingOrigin ?? initialOrigin),
        }),
      );
    } catch {
      // ignore
    }
  }

  function buildDateHref(product: PublicDumpsterProduct) {
    const params = new URLSearchParams();

    if (zipValid && zip) {
      params.set("zip", zip);
    }

    params.set("dumpsterSize", product.dumpsterSize);
    if (product.dumpsterProductId) {
      params.set("dumpsterProductId", product.dumpsterProductId);
    }
    params.set("origin", "book");

    const query = params.toString();
    return query ? `/book/date?${query}` : "/book/date";
  }

  async function handleContinue(product: PublicDumpsterProduct) {
    if (!zipValid || blocked) return;

    setIsContinuing(true);
    setSelectionError(null);
    persistSelection(product);

    try {
      const params = new URLSearchParams({
        zip,
        dumpsterSize: product.dumpsterSize,
      });

      if (product.dumpsterProductId) {
        params.set("dumpsterProductId", product.dumpsterProductId);
      }

      const res = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.serviced) {
        setSelectionError(
          json?.error || "We couldn’t confirm service and pricing for that dumpster. Please try again.",
        );
        return;
      }

      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing: BookingDraft = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          zip,
          county: json.county,
          town: json.town,
          dumpsterSize: product.dumpsterSize,
          dumpsterProductId: product.dumpsterProductId,
          dumpsterDisplayName: product.displayName,
          includedWeightTons: product.includedWeightTons,
          tonOveragePrice: product.tonOveragePrice,
          includedRentalDays: product.includedRentalDays,
          extraDayPrice: product.extraDayPrice,
          basePrice: product.basePrice,
          priceQuote: json.priceQuote ?? null,
          bookingOrigin: normalizeBookingOrigin(existing.bookingOrigin ?? initialOrigin),
        }),
      );

      router.push(buildDateHref(product));
    } catch {
      setSelectionError("We couldn’t confirm pricing for that dumpster. Please try again.");
    } finally {
      setIsContinuing(false);
    }
  }

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-16 pt-10">
        <section className="rounded-[32px] bg-white px-10 pb-12 pt-5 shadow-xl ring-1 ring-slate-200/70 sm:px-12 sm:pb-12 sm:pt-8">
          <div className="space-y-3">
            <div className="mx-auto mb-4 w-full max-w-2xl">
              <div className="flex flex-col gap-2">
                <div className="inline-flex w-fit items-center rounded-full bg-[#F97316]/10 px-4 py-1 text-xs font-semibold text-[#F97316]">
                  Step 2 of 4
                </div>

                <div className="h-2 w-full rounded-full bg-slate-200/60">
                  <div className="h-2 w-1/2 rounded-full bg-[#F97316]" />
                </div>
              </div>
            </div>

            <h1 className="mt-6 text-3xl font-semibold text-[#0F172A]">Choose your dumpster</h1>
            <p className="text-[#475569]">
              Pricing and availability are based on delivery ZIP <span className="font-semibold text-slate-900">{zip}</span>.
            </p>
          </div>

          <div className="mt-8 text-xl font-semibold tracking-tight text-slate-900">
            {entryContent.sectionTitle}
          </div>
          <p className="mt-2 text-slate-600">{entryContent.sectionDescription}</p>

          <div className="mt-6 grid gap-6 md:grid-cols-2">
            {products.map((product) => {
              const productKey = `${product.dumpsterSize}:${product.dumpsterProductId}`;
              const isSelected = productKey === selectedKey;

              return (
                <button
                  key={productKey}
                  type="button"
                  onClick={() => persistSelection(product)}
                  className={`rounded-[24px] p-6 text-left shadow-sm ring-1 transition ${
                    isSelected
                      ? "bg-orange-50 ring-[#F97316] shadow-md"
                      : "bg-white ring-slate-200 hover:ring-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-2xl font-semibold tracking-tight text-[#F97316]">
                        {product.displayName}
                      </div>
                      <div className="mt-2 text-sm font-medium text-slate-600">
                        {formatDimensions(product.dimensions)}
                      </div>
                    </div>
                    {isSelected ? (
                      <div className="rounded-full bg-[#F97316] px-3 py-1 text-xs font-semibold text-white">
                        Selected
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                    {money.format(product.basePrice)}
                  </div>

                  <div className="mt-4 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-sm text-slate-700">
                    <div className="font-semibold text-slate-900">
                      Includes up to {product.includedRentalDays} day{product.includedRentalDays === 1 ? "" : "s"}
                    </div>
                    <div className="mt-1">
                      {money.format(product.extraDayPrice)} per extra day after day {product.includedRentalDays}.
                    </div>
                    <div className="mt-4 font-semibold text-slate-900">
                      {formatIncludedWeight(product.includedWeightTons)}
                    </div>
                    <div className="mt-1">
                      {money.format(product.tonOveragePrice)} per ton over.
                    </div>
                  </div>

                  {(() => {
                    const shortDescription = formatShortDescription(product.shortDescription);
                    const bulletItems = parseCustomerBulletPoints(product.customerBulletPoints);

                    return (
                      <>
                        {shortDescription ? (
                          <p className="mt-4 text-sm leading-6 text-slate-600">{shortDescription}</p>
                        ) : null}
                        {bulletItems.length ? (
                          <ul className="mt-3 space-y-2 text-sm text-slate-600">
                            {bulletItems.map((item) => (
                              <li key={item}>• {item}</li>
                            ))}
                          </ul>
                        ) : null}
                      </>
                    );
                  })()}
                </button>
              );
            })}
          </div>

          {!products.length ? (
            <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-4 text-sm text-amber-900">
              No dumpster sizes are available for online booking in this service area right now.
            </div>
          ) : null}

          {blocked ? <BlockedZipPanel zip={zip} /> : null}

          {selectionError ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
              {selectionError}
            </div>
          ) : null}

          <div className="mt-8">
            {blocked ? (
              <div className="w-full rounded-2xl bg-slate-100 px-6 py-4 text-center text-sm font-semibold text-slate-500">
                {entryContent.blockedCtaText}
              </div>
            ) : selectedProduct ? (
              <button
                type="button"
                onClick={() => {
                  void handleContinue(selectedProduct);
                }}
                disabled={isContinuing}
                className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-[#F97316] px-7 text-base font-semibold text-white shadow-md transition hover:bg-[#EA580C] hover:shadow-lg focus:outline-none focus:ring-4 focus:ring-[#F97316]/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isContinuing ? "Checking pricing..." : "Continue to delivery date"}
              </button>
            ) : products.length ? (
              <div className="w-full rounded-2xl bg-slate-100 px-6 py-4 text-center text-sm font-semibold text-slate-500">
                Select a dumpster size to continue
              </div>
            ) : null}
          </div>

          <div className="mt-5">
            <a
              href={`/book/address?zip=${encodeURIComponent(zip)}`}
              className="text-sm text-slate-600 transition-colors hover:text-slate-900"
            >
              ← Back
            </a>
          </div>
        </section>
      </div>
    </main>
  );
}
