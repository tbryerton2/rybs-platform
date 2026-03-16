import Link from "next/link";
import { get14YardPriceForZip, sanitizeZip } from "@/lib/pricing";
import BookOnlineButton from "@/components/BookOnlineButton";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { zip?: string };
}) {
  const sp = await Promise.resolve(searchParams);
  const zip = sanitizeZip(sp?.zip);
  const zipValid = zip.length === 5;

  const { price } = await get14YardPriceForZip(zip);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* Header */}
        <section>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            Dumpster Pricing
          </h1>

          <p className="mt-3 text-slate-600 text-lg">
            {zipValid ? (
              <>
                Showing availability for{" "}
                <span className="font-semibold text-slate-900">{zip}</span>
              </>
            ) : (
              <>Simple flat-rate pricing for Central New York.</>
            )}
          </p>
        </section>

        {/* Pricing Card */}
        <section>
          <div className="grid gap-8 md:grid-cols-2">
            {/* Main Dumpster Option */}
            <div className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
              <div className="text-sm font-semibold text-[#F97316]">
                14-Foot Dumpster
              </div>

              <div className="mt-3 text-4xl font-semibold tracking-tight">
                ${price}
              </div>

              <p className="mt-2 text-slate-600">
                Flat-rate pricing includes delivery, pickup, and standard weight
                allowance.
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>• 7' × 14' × 4'</li>
                <li>• Driveway friendly</li>
                <li>• Up to 3 tons included</li>
                <li>• Flexible rental period</li>
              </ul>

              <BookOnlineButton zip={zip} zipValid={zipValid} />
            </div>

            {/* Trust / Support Card */}
            <div className="rounded-[20px] bg-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-[#0F172A]">
                What’s included in your rental
              </h3>
              <p className="mt-1 text-sm text-[#475569]">
                All included in the ${price} flat rate
              </p>

              <ul className="mt-5 space-y-4 text-sm text-[#475569]">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#F97316]" />
                  Delivery & pickup included
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#F97316]" />
                  Up to 3 tons included
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#F97316]" />
                  Flexible rental period
                </li>

                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-[#F97316]" />
                  No hidden fees
                </li>
              </ul>

              <p className="mt-6 text-xs text-slate-500">
                Overage charges apply only if weight allowance is exceeded.
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}