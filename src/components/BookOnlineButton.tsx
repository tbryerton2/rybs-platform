"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LoadingButton } from "@/components/ui/loading-button";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

export default function BookOnlineButton({
  zip,
  zipValid,
  dumpsterSize,
  dumpsterProductId,
  dumpsterDisplayName,
  includedWeightTons,
  tonOveragePrice,
  includedRentalDays,
  extraDayPrice,
  basePrice,
}: {
  zip: string;
  zipValid: boolean;
  dumpsterSize?: string;
  dumpsterProductId?: string | null;
  dumpsterDisplayName?: string;
  includedWeightTons?: number;
  tonOveragePrice?: number;
  includedRentalDays?: number;
  extraDayPrice?: number;
  basePrice?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function getBookingStorageKey() {
    return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
  }

  function getBookingHref() {
    const params = new URLSearchParams();

    if (zipValid && zip) {
      params.set("zip", zip);
    }
    if ((dumpsterSize || "").trim()) {
      params.set("dumpsterSize", dumpsterSize!.trim());
    }
    if ((dumpsterProductId || "").trim()) {
      params.set("dumpsterProductId", dumpsterProductId!.trim());
    }
    params.set("origin", "pricing");

    const query = params.toString();
    return query ? `/book/date?${query}` : "/book/date";
  }

  async function handleBookOnline() {
    if (loading) return;

    setLoading(true);
    setError(null);

    const selectedZip = zip.replace(/\D/g, "").slice(0, 5);
    const selectedDumpsterSize = (dumpsterSize || "").trim();
    const selectedDumpsterProductId = (dumpsterProductId || "").trim() || null;

    if (!zipValid || !selectedZip) {
      router.push("/book/address");
      return;
    }

    if (!selectedDumpsterSize) {
      router.push(`/book?zip=${encodeURIComponent(selectedZip)}`);
      return;
    }

    try {
      const params = new URLSearchParams({
        zip: selectedZip,
        dumpsterSize: selectedDumpsterSize,
      });

      if (selectedDumpsterProductId) {
        params.set("dumpsterProductId", selectedDumpsterProductId);
      }

      const res = await fetch(`/api/zip-check?${params.toString()}`, { cache: "no-store" });
      const json = await res.json().catch(() => ({}));

      if (!res.ok || !json?.serviced) {
        setError(json?.error || "We couldn’t confirm service for this ZIP. Please check your ZIP and try again.");
        setLoading(false);
        return;
      }

      const raw = sessionStorage.getItem(getBookingStorageKey());
      const existing = raw ? JSON.parse(raw) : {};
      const previousZip = String(existing.zip || existing.customerZip || "").replace(/\D/g, "").slice(0, 5);
      const previousDumpsterSize = String(existing.dumpsterSize || "").trim();
      const previousDumpsterProductId = String(existing.dumpsterProductId || "").trim() || null;
      const upstreamChanged =
        previousZip !== selectedZip ||
        previousDumpsterSize !== selectedDumpsterSize ||
        previousDumpsterProductId !== selectedDumpsterProductId;

      sessionStorage.setItem(
        getBookingStorageKey(),
        JSON.stringify({
          ...existing,
          zip: selectedZip,
          county: json.county,
          town: json.town,
          dumpsterSize: selectedDumpsterSize,
          dumpsterProductId: selectedDumpsterProductId,
          dumpsterDisplayName: (dumpsterDisplayName || selectedDumpsterSize).trim(),
          includedWeightTons,
          tonOveragePrice,
          includedRentalDays,
          extraDayPrice,
          basePrice,
          priceQuote: json.priceQuote ?? null,
          bookingOrigin: "pricing",
          ...(upstreamChanged
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

      router.push(getBookingHref());
    } catch {
      setError("We couldn’t start booking right now. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="mt-8 space-y-3">
      <LoadingButton
        onClick={() => {
          void handleBookOnline();
        }}
        loading={loading}
        loadingLabel="Loading..."
        className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#F97316] px-6 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] active:scale-[0.99] disabled:opacity-70 disabled:cursor-not-allowed"
      >
        Book Now
      </LoadingButton>
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
          {error}
        </div>
      ) : null}
    </div>
  );
}
