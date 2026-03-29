import { get14YardPriceForZip, sanitizeZip } from "@/lib/pricing";
import {
  getPricingIntroContent,
  getPricingPromisesContent,
} from "@/lib/tenant/content";
import BookOnlineButton from "@/components/BookOnlineButton";

export const dynamic = "force-dynamic";

export default async function PricingPage({
  searchParams,
}: {
  searchParams: { zip?: string; preview?: string };
}) {
  const sp = await Promise.resolve(searchParams);
  const zip = sanitizeZip(sp?.zip);
  const zipValid = zip.length === 5;
  const preview = sp?.preview === "1";

  const [{ price }, pricingIntro, pricingPromises] = await Promise.all([
    get14YardPriceForZip(zip),
    getPricingIntroContent({ preview }),
    getPricingPromisesContent({ preview }),
  ]);

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#0F172A]">
      {preview ? (
        <section className="border-b border-amber-200 bg-amber-50">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-3 text-sm text-amber-900">
            <span>Preview mode is on. You are viewing draft retail-site content.</span>
            <a
              href={`/admin/cms/preview?mode=exit&redirect=${encodeURIComponent(zipValid ? `/pricing?zip=${zip}` : "/pricing")}`}
              className="font-semibold underline decoration-amber-400 underline-offset-4"
            >
              Exit Preview
            </a>
          </div>
        </section>
      ) : null}
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* Header */}
        <section>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {pricingIntro.headline}
          </h1>

          <p className="mt-3 text-slate-600 text-lg">
            {zipValid ? (
              <>
                Showing availability for{" "}
                <span className="font-semibold text-slate-900">{zip}</span>
              </>
            ) : (
              <>{pricingIntro.defaultBody}</>
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
                {pricingPromises.productBody}
              </p>

              <ul className="mt-6 space-y-3 text-sm text-slate-600">
                <li>• {pricingPromises.dimensionLabel.replace(/'/g, "\u0027")}</li>
                {pricingPromises.featureList.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>

              <BookOnlineButton zip={zip} zipValid={zipValid} />
            </div>

            {/* Trust / Support Card */}
            <div className="rounded-[20px] bg-slate-50 p-8 shadow-sm ring-1 ring-slate-200">
              <h3 className="text-lg font-semibold text-[#0F172A]">
                {pricingPromises.includedHeading}
              </h3>
              <p className="mt-1 text-sm text-[#475569]">
                {pricingPromises.includedPricePrefix} ${price} {pricingPromises.includedPriceSuffix}
              </p>

              <ul className="mt-5 space-y-4 text-sm text-[#475569]">
                {pricingPromises.includedItems.map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span className="mt-1 h-2 w-2 rounded-full bg-[#F97316]" />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-6 text-xs text-slate-500">
                {pricingPromises.footnote}
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
