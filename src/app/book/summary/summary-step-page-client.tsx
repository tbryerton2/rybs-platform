"use client";

import { useState } from "react";
import { StepHeader } from "@/components/StepHeader";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type Booking = {
  zip?: string;
  county?: string;
  town?: string;
};

type SummaryStepPageClientProps = {
  content: {
    title: string;
    subtitle: string;
    locationSummaryTitle: string;
    locationEmptyText: string;
    totalLabel: string;
    includedTitle: string;
    includedItems: string[];
    weightPolicyTitle: string;
    weightPolicyBody: string;
    weightPolicyFootnote: string;
    checkoutCtaLabel: string;
    missingZipCtaLabel: string;
  };
};

function getBookingStorageKey() {
  return getTenantStorageKey(TENANT_STORAGE_KEYS.booking);
}

export default function SummaryStepPageClient({ content }: SummaryStepPageClientProps) {
  const [booking] = useState<Booking | null>(() => {
    try {
      const raw = sessionStorage.getItem(getBookingStorageKey());
      return raw ? (JSON.parse(raw) as Booking) : null;
    } catch {
      return null;
    }
  });

  return (
    <main className="space-y-6">
      <StepHeader step={5} total={5} title={content.title} subtitle={content.subtitle} />

      <section className="rounded-lg border p-4 space-y-4">
        <div className="rounded-md border p-3 text-sm">
          <div className="font-medium">{content.locationSummaryTitle}</div>
          {booking?.zip ? (
            <div className="text-muted-foreground">
              ZIP <span className="font-medium text-foreground">{booking.zip}</span>
              {booking.town || booking.county ? (
                <>
                  {" "}
                  — {booking.town ? booking.town : "Town"}
                  {booking.county ? `, ${booking.county} County` : ""}
                </>
              ) : null}
            </div>
          ) : (
            <div className="text-muted-foreground">{content.locationEmptyText}</div>
          )}
        </div>

        <div className="space-y-1">
          <div className="text-sm text-muted-foreground">{content.totalLabel}</div>
          <div className="text-3xl font-semibold">$XXX</div>
          <div className="text-xs text-muted-foreground">(We’ll wire real pricing next.)</div>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium">{content.includedTitle}</div>
          <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
            {content.includedItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div className="rounded-md border p-3 space-y-2">
          <div className="font-medium">{content.weightPolicyTitle}</div>
          <p className="text-sm text-muted-foreground">{content.weightPolicyBody}</p>
          <p className="text-sm text-muted-foreground">{content.weightPolicyFootnote}</p>
        </div>

        <a
          className={`block rounded-md bg-black px-4 py-3 text-center text-white ${
            booking?.zip ? "" : "pointer-events-none opacity-50"
          }`}
          href="/checkout"
        >
          {content.checkoutCtaLabel}
        </a>

        <a className="block text-center text-sm underline" href="/book/pickup">
          Back
        </a>

        {!booking?.zip && (
          <a className="block text-center text-sm underline" href="/book/address">
            {content.missingZipCtaLabel}
          </a>
        )}
      </section>
    </main>
  );
}
