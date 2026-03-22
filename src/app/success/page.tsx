import Link from "next/link";
import { getOptionalPortalCustomer } from "@/lib/portal/auth";
import { getCustomerFacingBookingLabel } from "@/lib/identity";

type SuccessPageProps = {
  searchParams?: Promise<{
    bookingId?: string;
    bookingRef?: string;
    email?: string;
  }>;
};

export default async function SuccessPage({ searchParams }: SuccessPageProps) {
  const params = (await searchParams) ?? {};
  const portalCustomer = await getOptionalPortalCustomer();
  const bookingRef = getCustomerFacingBookingLabel(params.bookingRef);
  const bookingEmail = params.email?.trim() || null;
  const portalHref = bookingEmail ? `/portal/login?email=${encodeURIComponent(bookingEmail)}` : "/portal/login";

  return (
    <main className="min-h-screen bg-gradient-to-b from-[#F8FAFC] to-[#EEF2F7] text-[#0F172A]">
      <div className="mx-auto max-w-2xl px-6 pb-20 pt-16">
        <div className="rounded-[32px] bg-white px-10 py-12 text-center shadow-xl ring-1 ring-slate-200/70">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <span className="text-2xl">✅</span>
          </div>

          <h1 className="text-3xl font-semibold text-[#0F172A]">Booking confirmed</h1>

          <p className="mt-3 text-[#475569]">
            Your dumpster has been reserved and we’ve created a new booking for you.
          </p>

          <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 px-5 py-4 text-left">
            <div className="text-sm font-semibold text-slate-900">Booking reference</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">{bookingRef}</div>
            {bookingEmail ? (
              <p className="mt-3 text-sm leading-6 text-slate-600">
                This booking is linked to <span className="font-medium text-slate-900">{bookingEmail}</span>.
                Use that email to access your portal and manage this booking.
              </p>
            ) : null}
          </div>

          <p className="mt-6 text-sm text-slate-600">
            You’ll receive a confirmation email shortly with your delivery details and booking reference.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            {portalCustomer ? (
              <Link
                href="/portal"
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
              >
                Go to my portal
              </Link>
            ) : (
              <Link
                href={portalHref}
                className="inline-flex h-12 items-center justify-center rounded-2xl bg-[#F97316] px-6 font-semibold text-white shadow-sm transition hover:bg-[#EA580C]"
              >
                Access my portal
              </Link>
            )}
            <Link
              href="/"
              className="inline-flex h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-6 font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              Return home
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
