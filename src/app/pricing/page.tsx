import { sanitizeZip } from "@/lib/pricing";
import { getPublicDumpsterProducts } from "@/lib/dumpster-product-settings";
import { getProductSizeGuideRows } from "@/lib/pricing-size-guide";
import { getPricingPageSettings } from "@/lib/pricing-page-settings";
import { getCurrentTenant } from "@/lib/tenant/server";
import BookOnlineButton from "@/components/BookOnlineButton";
import { parseCustomerBulletPoints } from "@/lib/product-card-content";
import PricingZipSwitcher from "./pricing-zip-switcher";
import PricingSizeGuide from "./pricing-size-guide";

export const dynamic = "force-dynamic";

const DIMENSIONS_FALLBACK = "Approximate dimensions available at booking";

function formatDimensions(dimensions?: string | null) {
  const trimmed = dimensions?.trim();
  return trimmed ? trimmed.replace(/'/g, "\u0027") : DIMENSIONS_FALLBACK;
}

function formatIncludedWeight(tons: number) {
  return `Includes ${tons} ton${tons === 1 ? "" : "s"}`;
}

function formatShortDescription(description?: string | null) {
  return description?.trim() || "";
}

export default async function PricingPage({
  searchParams,
}: {
  searchParams?: Promise<{ zip?: string }>;
}) {
  const sp = await searchParams;
  const zip = sanitizeZip(sp?.zip);
  const zipValid = zip.length === 5;
  const tenant = await getCurrentTenant();
  const [pageContent, inventoryProducts] = await Promise.all([
    getPricingPageSettings(tenant.id),
    getPublicDumpsterProducts(zip, tenant.id),
  ]);
  const sizeGuideContent = pageContent.sizeGuide;
  const sizeGuideRows = getProductSizeGuideRows(inventoryProducts);
  const showSizeGuide = sizeGuideContent.enabled && sizeGuideRows.length > 0;
  const pricingProducts = inventoryProducts;

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

  return (
    <main className="min-h-screen bg-[#f5f4f0] text-[#0F172A]">
      <div className="mx-auto max-w-6xl px-6 py-16 space-y-16">
        {/* Header */}
        <section>
          <h1 className="text-3xl sm:text-4xl font-semibold tracking-tight">
            {pageContent.headline}
          </h1>

          <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-2 text-lg text-slate-600">
            {zipValid ? (
              <>
                <span>
                  Delivering to <span className="font-semibold text-slate-900">{zip}</span>
                </span>
                <PricingZipSwitcher currentZip={zip} />
              </>
            ) : (
              <span>{pageContent.introduction}</span>
            )}
          </div>

        </section>

        {/* Pricing Card */}
        <section>
          {showSizeGuide ? (
            <div className="mb-5">
              <PricingSizeGuide content={sizeGuideContent} rows={sizeGuideRows} />
            </div>
          ) : null}
          {pricingProducts.length ? (
            <div className="grid gap-8 md:grid-cols-2">
              {pricingProducts.map((product) => (
              <div
                key={`${product.dumpsterSize}:${product.dumpsterProductId}`}
                className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200"
              >
                <div className="text-2xl font-semibold tracking-tight text-[#F97316] sm:text-3xl">
                  {product.displayName}
                </div>

                <div className="mt-2 whitespace-pre-line text-sm font-medium text-slate-600">
                  {formatDimensions(product.dimensions)}
                </div>
                <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                  {money.format(product.basePrice)}
                </div>

                <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-sm text-slate-700">
                  <div className="grid gap-4 sm:grid-cols-2 sm:gap-0">
                    <div className="min-w-0 sm:pr-5">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#C2410C] sm:min-h-[2.25rem]">
                        Included rental duration
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">
                        Includes up to {product.includedRentalDays} day{product.includedRentalDays === 1 ? "" : "s"}
                      </div>
                      <div className="mt-1">
                        {money.format(product.extraDayPrice)} per extra day after day {product.includedRentalDays}.
                      </div>
                    </div>
                    <div className="min-w-0 border-t border-orange-200 pt-4 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
                      <div className="text-xs font-semibold uppercase tracking-wide text-[#C2410C] sm:min-h-[2.25rem]">
                        Included weight allowance
                      </div>
                      <div className="mt-2 font-semibold text-slate-900">
                        {formatIncludedWeight(product.includedWeightTons)}
                      </div>
                      <div className="mt-1">
                        Extra weight fee: {money.format(product.tonOveragePrice)}/ton
                      </div>
                    </div>
                  </div>
                </div>

                {(() => {
                  const shortDescription = formatShortDescription(product.shortDescription);
                  const bulletItems = parseCustomerBulletPoints(product.customerBulletPoints);

                  return (
                    <>
                      {shortDescription ? (
                        <p className="mt-6 whitespace-pre-line text-sm leading-6 text-slate-600">
                          {shortDescription}
                        </p>
                      ) : null}
                      {bulletItems.length ? (
                        <ul className="mt-4 space-y-3 text-sm text-slate-600">
                          {bulletItems.map((item) => (
                            <li key={item}>• {item}</li>
                          ))}
                        </ul>
                      ) : null}
                    </>
                  );
                })()}

                <BookOnlineButton
                  zip={zip}
                  zipValid={zipValid}
                  dumpsterSize={product.dumpsterSize}
                  dumpsterProductId={product.dumpsterProductId}
                  dumpsterDisplayName={product.displayName}
                  includedWeightTons={product.includedWeightTons}
                  tonOveragePrice={product.tonOveragePrice}
                  includedRentalDays={product.includedRentalDays}
                  extraDayPrice={product.extraDayPrice}
                  basePrice={product.basePrice}
                />
              </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] bg-white p-8 text-sm font-medium text-slate-600 shadow-sm ring-1 ring-slate-200">
              No dumpster options are currently available online.
            </div>
          )}
        </section>
        {pageContent.includedHeading || pageContent.includedItems.length || pageContent.bottomNote ? (
          <section className="space-y-4">
            {pageContent.includedHeading ? <h2 className="text-2xl font-semibold tracking-tight">{pageContent.includedHeading}</h2> : null}
            {pageContent.includedItems.length ? (
              <ul className="space-y-3 text-sm text-slate-600">
                {pageContent.includedItems.map((item, index) => <li key={index}>• {item}</li>)}
              </ul>
            ) : null}
            {pageContent.bottomNote ? <p className="whitespace-pre-line text-sm leading-6 text-slate-600">{pageContent.bottomNote}</p> : null}
          </section>
        ) : null}
      </div>
    </main>
  );
}
