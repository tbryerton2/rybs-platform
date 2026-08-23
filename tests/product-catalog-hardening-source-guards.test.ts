import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("public product validator requires tenant ownership and public catalog status", () => {
  const source = readRepoFile("src/lib/public-dumpster-product.ts");

  assert.match(source, /\.from\("dumpster_product_settings"\)/);
  assert.match(source, /\.eq\("business_id", businessId\)/);
  assert.match(source, /row\.dumpster_product_id\.trim\(\) === selectedProductId/);
  assert.match(source, /matchedProduct\.is_public !== true/);
  assert.match(source, /dumpsterSizesAreCompatible\(matchedProduct\.dumpster_size, selectedSize\)/);
  assert.match(source, /matchedProduct\.dumpster_product_id\.trim\(\) !== selectedProductId/);
  assert.match(source, /getOfferedDumpsterProducts\(businessId\)/);
  assert.match(source, /dumpsterSizesAreCompatible\(product\.dumpsterSize, matchedProduct\.dumpster_size\)/);
  assert.match(source, /PublicDumpsterProductError/);
});

test("inventory-backed fallback products are accepted only when no compatible settings row exists", () => {
  const source = readRepoFile("src/lib/public-dumpster-product.ts");

  assert.match(source, /const sizeMatch = selectedSize \? findCompatibleProductBySize\(rows, selectedSize\) : null/);
  assert.match(source, /if \(!selectedSize \|\| sizeMatch\)/);
  assert.match(source, /const offeredProduct = offeredProducts\.find/);
  assert.match(source, /const fallbackId = fallbackProductId\(offeredProduct\.dumpsterSize\)/);
  assert.match(source, /if \(selectedProductId && selectedProductId !== fallbackId\)/);
  assert.match(source, /is_public: true/);
});

test("public catalog and booking validation use compatible size matching", () => {
  const catalog = readRepoFile("src/lib/dumpster-product-settings.ts");
  const validator = readRepoFile("src/lib/public-dumpster-product.ts");

  assert.match(catalog, /function findSettingForSize/);
  assert.match(catalog, /getDumpsterSizeCapacity\(setting\.dumpsterSize\) === capacity/);
  assert.match(catalog, /findSettingForSize\(productSettings, offered\.dumpsterSize\)/);

  assert.match(validator, /function dumpsterSizesAreCompatible/);
  assert.match(validator, /leftCapacity === rightCapacity/);
  assert.match(validator, /findCompatibleProductBySize\(rows, selectedSize\)/);
});

test("public quote availability hold and booking routes require public tenant products", () => {
  const files = [
    "src/app/api/availability/route.ts",
    "src/app/api/availability/calendar/route.ts",
    "src/app/api/pickup-cap/route.ts",
    "src/app/api/hold/route.ts",
    "src/app/api/bookings/create/route.ts",
    "src/app/api/bookings/route.ts",
  ];

  for (const file of files) {
    const source = readRepoFile(file);

    assert.match(source, /requirePublicProduct: true/, file);
    assert.match(source, /isPublicDumpsterProductError/, file);
    assert.match(source, /status: .*\.status/s, file);
  }

  const pricing = readRepoFile("src/lib/pricing.ts");
  assert.match(pricing, /requirePublicProduct: bookingInput\?\.requirePublicProduct \?\? true/);

  const zipCheck = readRepoFile("src/app/api/zip-check/route.ts");
  assert.match(zipCheck, /businessId: tenant\.id/);
  assert.match(zipCheck, /isPublicDumpsterProductError/);
  assert.match(zipCheck, /getDumpsterPriceForZip\(/);
  assert.match(zipCheck, /hasSelectedDumpster/);
  assert.match(zipCheck, /if \(!hasSelectedDumpster\)/);
});

test("initial ZIP checks are service-area only and do not require a default product", () => {
  const checkZip = readRepoFile("src/app/api/check-zip/route.ts");

  assert.match(checkZip, /getActiveServiceAreaZip\(sanitizedZip, tenant\.id\)/);
  assert.match(checkZip, /serviceable: true/);
  assert.match(checkZip, /serviceable: false/);
  assert.doesNotMatch(checkZip, /get14YardPriceForZip/);
  assert.doesNotMatch(checkZip, /getDumpsterPriceForZip/);
  assert.doesNotMatch(checkZip, /resolveSelectedDumpster/);
  assert.doesNotMatch(checkZip, /isPublicDumpsterProductError/);

  const zipCheck = readRepoFile("src/app/api/zip-check/route.ts");
  const serviceOnlyBranch = zipCheck.slice(
    zipCheck.indexOf("if (!hasSelectedDumpster)"),
    zipCheck.indexOf("const selectedDumpster = resolveSelectedDumpster"),
  );

  assert.match(serviceOnlyBranch, /serviced: true/);
  assert.doesNotMatch(serviceOnlyBranch, /priceQuote/);
  assert.doesNotMatch(serviceOnlyBranch, /getDumpsterPriceForZip/);
});

test("address step does not send default product params during ZIP-only checks", () => {
  const source = readRepoFile("src/app/book/address/address-step-page-client.tsx");
  const handleZipCheck = source.slice(
    source.indexOf("async function handleZipCheck"),
    source.indexOf("const res = await fetch", source.indexOf("async function handleZipCheck")),
  );

  assert.match(handleZipCheck, /const params = new URLSearchParams\(\{ zip: nextZip \}\)/);
  assert.match(handleZipCheck, /if \(hasSelectedDumpsterInQuery\)/);
  assert.doesNotMatch(handleZipCheck, /new URLSearchParams\(\{\s*zip: nextZip,\s*dumpsterSize/s);
});

test("confirmation uses product quote policy values and product-scoped hold claim", () => {
  const source = readRepoFile("src/app/api/confirm-booking/route.ts");

  assert.match(source, /getDumpsterPriceForZip\([\s\S]*businessId: tenant\.id[\s\S]*requirePublicProduct: true/);
  assert.doesNotMatch(source, /pricing\.pricingSettings\.standardRentalDays/);
  assert.doesNotMatch(source, /pricing\.pricingSettings\.dailyOveragePrice/);
  assert.match(source, /const rentalPeriod = pricing\.priceQuote/);
  assert.match(source, /rpcDays: rentalPeriod\.bookedRentalDays \?\? rentalPeriod\.includedRentalDays/);
  assert.match(source, /\.eq\("delivery_date", deliveryDate\)/);
  assert.match(source, /\.eq\("pickup_date", effectivePickup\)/);
  assert.match(source, /\.eq\("dumpster_size", selectedDumpster\.dumpsterSize\)/);
  assert.match(source, /\.eq\("dumpster_product_id", selectedDumpster\.dumpsterProductId\)/);
});

test("public pricing page shows an empty state instead of a fake 14-yard product", () => {
  const source = readRepoFile("src/app/pricing/page.tsx");

  assert.match(source, /const pricingProducts = inventoryProducts/);
  assert.match(source, /No dumpster options are currently available online\./);
  assert.doesNotMatch(source, /DEFAULT_PRICING_SETTINGS/);
  assert.doesNotMatch(source, /displayName: "14-yard dumpster"/);
});

test("checkout and confirm quote matching include product identity", () => {
  const checkout = readRepoFile("src/app/checkout/checkout-page-client.tsx");
  const confirm = readRepoFile("src/app/confirm/confirm-page-client.tsx");

  for (const source of [checkout, confirm]) {
    const matchCall = source.slice(
      source.indexOf("priceQuoteMatchesSelection(draft.priceQuote"),
      source.indexOf("})", source.indexOf("priceQuoteMatchesSelection(draft.priceQuote")),
    );

    assert.match(matchCall, /dumpsterSize: selectedDumpsterSize/);
    assert.match(matchCall, /dumpsterProductId: draft\.dumpsterProductId/);
  }
});
