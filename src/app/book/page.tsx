import { StepHeader } from "@/components/StepHeader";
import { get14YardPriceForZip } from "@/lib/pricing";
import {
  getBookingEntryContent,
  getProductMarketingContent,
} from "@/lib/tenant/content";
import Link from "next/link";
import { BlockedZipPanel } from "@/components/BlockedZipPanel";

export const dynamic = "force-dynamic";

export default async function BookPage({
  searchParams,
}: {
  searchParams: { zip?: string };
}) {
  const sp = await Promise.resolve(searchParams);

  const { zip, zipValid, price, serviceable } = await get14YardPriceForZip(
    sp?.zip
  );
  const [entryContent, productContent] = await Promise.all([
    getBookingEntryContent(),
    getProductMarketingContent(),
  ]);

  const blocked = zipValid && serviceable === false;

  // Preserve zip into next step if valid (and not blocked)
  const nextHref =
    zipValid && !blocked
      ? `/book/address?zip=${encodeURIComponent(zip)}`
      : "/book/address";

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-12 space-y-10">
        <StepHeader
          step={1}
          total={6}
          title={entryContent.title}
          subtitle={entryContent.subtitle}
        />

        <section className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="text-sm font-semibold text-[#F97316]">Step 1</div>

          <div className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
            {entryContent.sectionTitle}
          </div>

          <p className="mt-2 text-slate-600">
            {entryContent.sectionDescription}
          </p>

          <div className="mt-6 rounded-[20px] bg-white p-6 ring-2 ring-[#F97316]/20 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-slate-900">
                  {productContent.headline}
                </div>

                <div className="mt-2 text-2xl font-semibold text-slate-900">
                  ${price}
                </div>

                <div className="mt-1 text-sm text-slate-600">
                  {productContent.dimensionsLabel}
                </div>
              </div>

              <div className="text-right">
                <div className="rounded-full bg-[#F97316]/10 px-3 py-1 text-xs font-semibold text-[#F97316]">
                  {productContent.badge}
                </div>
              </div>
            </div>

            <div className="mt-2 text-sm text-slate-600">
              {productContent.description}
            </div>

            <ul className="mt-4 grid gap-2 text-sm text-slate-600">
              {productContent.highlightBullets.map((bullet) => (
                <li key={bullet}>• {bullet}</li>
              ))}
            </ul>
          </div>

          {/* Blocked ZIP panel (client component w/ modal + form) */}
          {blocked && <BlockedZipPanel zip={zip} />}

          {/* CTA */}
          <div className="mt-8">
            {blocked ? (
              <div className="w-full rounded-2xl bg-slate-100 px-6 py-4 text-center text-sm font-semibold text-slate-500">
                {entryContent.blockedCtaText}
              </div>
            ) : (
              <Link
                href={nextHref}
                className="inline-flex h-12 w-full items-center justify-center rounded-2xl bg-[#F97316] px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-[#EA580C] hover:shadow-md focus:outline-none focus:ring-4 focus:ring-[#F97316]/20"
              >
                Continue
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
