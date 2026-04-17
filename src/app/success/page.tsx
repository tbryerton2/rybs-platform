import Link from "next/link";
import { getOptionalPortalCustomer } from "@/lib/portal/auth";
import { getCustomerFacingBookingLabel } from "@/lib/identity";
import { formatUsdFromCents } from "@/lib/money";
import { getBookingSuccessContent } from "@/lib/tenant/content";

type SuccessPageProps = {
  searchParams?: Promise<{
    bookingId?: string;
    bookingRef?: string;
    email?: string;
    rentalPriceCents?: string;
    standardRentalDays?: string;
    bookedRentalDays?: string;
    maxRentalDays?: string;
    allowExtendedRentalAtBooking?: string;
    dailyOveragePriceCents?: string;
    extraDays?: string;
    extraDaysChargeCents?: string;
    salesTaxCents?: string;
    totalCents?: string;
  }>;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = (await searchParams) ?? {};
  const portalCustomer = await getOptionalPortalCustomer();
  const content = await getBookingSuccessContent();
  const bookingRef = getCustomerFacingBookingLabel(params.bookingRef);
  const bookingEmail = params.email?.trim() || null;
  const portalHref = bookingEmail ? `/portal/login?email=${encodeURIComponent(bookingEmail)}` : "/portal/login";
  const rentalPriceCents = Number(params.rentalPriceCents);
  const standardRentalDays = Number(params.standardRentalDays);
  const bookedRentalDays = Number(params.bookedRentalDays);
  const maxRentalDays = Number(params.maxRentalDays);
  const allowExtendedRentalAtBooking = params.allowExtendedRentalAtBooking === "1";
  const dailyOveragePriceCents = Number(params.dailyOveragePriceCents);
  const extraDays = Number(params.extraDays);
  const extraDaysChargeCents = Number(params.extraDaysChargeCents);
  const salesTaxCents = Number(params.salesTaxCents);
  const totalCents = Number(params.totalCents);
  const hasPricingSummary =
    Number.isFinite(rentalPriceCents) &&
    Number.isFinite(salesTaxCents) &&
    Number.isFinite(totalCents);

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-16">
        <div className="rounded-[32px] bg-white px-10 py-12 text-center shadow-xl ring-1 ring-slate-200/70">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-2xl">✅</span>
          </div>

          <h1 className="text-3xl font-semibold text-[#0F172A]">{content.title}</h1>

          <p className="mt-3 text-[#475569]">
            {content.description}
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
            <div className="text-sm font-semibold text-slate-900">{content.bookingReferenceTitle}</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{bookingRef}</div>
            {bookingEmail ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {content.linkedBookingTemplate.replace("{email}", bookingEmail)}
              </p>
            ) : null}
          </div>

          {hasPricingSummary ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
              <div className="text-sm font-semibold text-slate-900">{content.orderSummaryTitle}</div>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between gap-4 text-slate-700">
                  <span>Base price</span>
                  <span className="font-semibold text-slate-900">
                    {formatUsdFromCents(rentalPriceCents)}
                  </span>
                </div>
                {Number.isFinite(extraDays) && extraDays > 0 ? (
                  <div className="flex items-center justify-between gap-4 text-slate-700">
                    <span>
                      Extra days ({extraDays} x {formatUsdFromCents(dailyOveragePriceCents)})
                    </span>
                    <span className="font-semibold text-slate-900">
                      {formatUsdFromCents(extraDaysChargeCents)}
                    </span>
                  </div>
                ) : null}
                <div className="flex items-center justify-between gap-4 text-slate-700">
                  <span>NY sales tax (8%)</span>
                  <span className="font-semibold text-slate-900">
                    {formatUsdFromCents(salesTaxCents)}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-4 border-t border-slate-200 pt-2 font-semibold text-slate-900">
                  <span>Total</span>
                  <span>{formatUsdFromCents(totalCents)}</span>
                </div>
                {Number.isFinite(standardRentalDays) && standardRentalDays > 0 ? (
                  <div className="pt-2 text-xs text-slate-500">
                    {`Includes up to ${standardRentalDays} days. `}
                    {Number.isFinite(dailyOveragePriceCents)
                      ? `${formatUsdFromCents(dailyOveragePriceCents)} per extra day after day ${standardRentalDays}. `
                      : ""}
                    {Number.isFinite(maxRentalDays) && maxRentalDays > 0
                      ? `Maximum rental length: ${maxRentalDays} days. `
                      : ""}
                    {!allowExtendedRentalAtBooking
                      ? "Online booking was limited to the included rental period."
                      : Number.isFinite(bookedRentalDays) && bookedRentalDays > standardRentalDays
                        ? `Booked for ${bookedRentalDays} days total.`
                        : ""}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}

          <p className="mt-6 text-sm text-slate-600">
            {content.confirmationEmailNote}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {portalCustomer ? (
              <Link
                href="/portal"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
              >
                {content.portalLoggedInCtaLabel}
              </Link>
            ) : (
              <Link
                href={portalHref}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
              >
                {content.portalLoggedOutCtaLabel}
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              {content.returnHomeCtaLabel}
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
