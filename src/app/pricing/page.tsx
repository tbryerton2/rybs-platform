import { sanitizeZip } from "@/lib/pricing";
import { getPublicDumpsterProducts } from "@/lib/dumpster-product-settings";
import { DEFAULT_PRICING_SETTINGS } from "@/lib/pricing-settings";
import { getPricingIntroContent } from "@/lib/tenant/content";
import BookOnlineButton from "@/components/BookOnlineButton";
import { parseCustomerBulletPoints } from "@/lib/product-card-content";

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
  searchParams?: Promise<{ zip?: string; preview?: string }>;
}) {
  const sp = await searchParams;
  const zip = sanitizeZip(sp?.zip);
  const zipValid = zip.length === 5;
  const preview = sp?.preview === "1";

  const [pricingIntro, inventoryProducts] = await Promise.all([
    getPricingIntroContent({ preview }),
    getPublicDumpsterProducts(zip),
  ]);
  const pricingProducts = inventoryProducts.length
    ? inventoryProducts
    : [
        {
          dumpsterSize: "14 yard",
          dumpsterProductId: "default",
          displayName: "14-yard dumpster",
          shortDescription: "",
          customerBulletPoints: "",
          dimensions: "",
          includedWeightTons: DEFAULT_PRICING_SETTINGS.includedTons,
          tonOveragePrice: DEFAULT_PRICING_SETTINGS.tonOveragePrice,
          includedRentalDays: DEFAULT_PRICING_SETTINGS.standardRentalDays,
          extraDayPrice: DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
          basePrice: DEFAULT_PRICING_SETTINGS.basePrice,
          isPublic: true,
          sortOrder: 10,
        },
      ];

  const money = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

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
            {pricingProducts.map((product) => (
              <div
                key={`${product.dumpsterSize}:${product.dumpsterProductId}`}
                className="rounded-[28px] bg-white p-8 shadow-sm ring-1 ring-slate-200"
              >
                <div className="text-2xl font-semibold tracking-tight text-[#F97316] sm:text-3xl">
                  {product.displayName}
                </div>

                <div className="mt-2 text-sm font-medium text-slate-600">
                  {formatDimensions(product.dimensions)}
                </div>
                <div className="mt-5 text-3xl font-semibold tracking-tight text-slate-950">
                  {money.format(product.basePrice)}
                </div>

                <div className="mt-5 rounded-2xl border border-orange-200 bg-orange-50/70 p-4 text-sm text-slate-700">
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
                        <p className="mt-6 text-sm leading-6 text-slate-600">{shortDescription}</p>
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
        </section>
      </div>
    </main>
  );
}
