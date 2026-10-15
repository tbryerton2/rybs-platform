import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import { getDumpsterRentalPolicy } from "../src/lib/dumpster-rental-policy.ts";
import {
  getEditableDumpsterProductSettings,
  getPublicDumpsterProducts,
} from "../src/lib/dumpster-product-settings.ts";
import { getDumpsterPriceForZip } from "../src/lib/pricing.ts";
import { supabaseAdmin } from "../src/lib/supabaseAdmin.ts";

const businessId = "22222222-2222-4222-8222-222222222222";
const selection = { dumpsterSize: "55 yard", dumpsterProductId: "55-yard" };

function mockPricing(t: TestContext, extraDayPrice: number | string | null | undefined) {
  const products = extraDayPrice === undefined ? [] : [{
    id: "product-55",
    dumpster_size: "55 yard",
    dumpster_product_id: "55-yard",
    display_name: "55-yard dumpster",
    included_rental_days: 7,
    extra_day_price: extraDayPrice,
    base_price: 395,
    is_public: true,
    sort_order: 0,
  }];
  const rows: Record<string, unknown[]> = {
    dumpster_product_settings: products,
    pricing_settings: [{
      standard_rental_price: 395,
      included_rental_days: 7,
      daily_overage_price: 25,
      max_rental_days: 14,
      allow_extended_rental_at_booking: true,
    }],
    dumpsters: [{ size: "55 yard", active: true, service_status: "Ready" }],
    service_area_zips: [{ active: true, price_14_yard_override: null }],
  };
  t.mock.method(supabaseAdmin, "from", (table: string) => {
    assert.ok(table in rows, `Unexpected table: ${table}`);
    const result = { data: rows[table], error: null };
    const query = {
      select: () => query,
      eq: (column: string, value: unknown) => {
        if (column.endsWith("business_id")) assert.equal(value, businessId);
        return query;
      },
      order: () => query,
      limit: () => query,
      maybeSingle: async () => ({ data: result.data[0] ?? null, error: null }),
      then: (resolve: (value: typeof result) => unknown) => Promise.resolve(result).then(resolve),
    };
    return query;
  });
}

test("new inventory size uses the same default rate in admin, catalog, and booking", async (t) => {
  mockPricing(t, undefined);
  const [editable, catalog, pricing] = await Promise.all([
    getEditableDumpsterProductSettings(businessId),
    getPublicDumpsterProducts("13617", businessId),
    getDumpsterPriceForZip("13617", selection, {
      businessId,
      deliveryDate: "2026-10-20",
      pickupDate: "2026-10-30",
      pickupMode: "date",
    }),
  ]);
  assert.equal(editable[0].isDraft, true);
  assert.equal(editable[0].extraDayPrice, 25);
  assert.equal(catalog[0].extraDayPrice, 25);
  assert.equal(pricing.priceQuote.dailyOveragePrice, 25);
  assert.equal(pricing.priceQuote.extraDays, 3);
  assert.equal(pricing.priceQuote.extraDaysChargeCents, 7500);
  assert.equal(pricing.priceQuote.totalCents, 50760);
});

for (const requirePublicProduct of [true, false]) {
  for (const [label, value, expected] of [
    ["unset rate inherits company default", null, 25],
    ["explicit zero remains free", 0, 0],
    ["saved numeric rate is respected", 35, 35],
    ["saved decimal string is respected", "25.00", 25],
  ] as const) {
    test(`${requirePublicProduct ? "public" : "internal"} rental policy: ${label}`, async (t) => {
      mockPricing(t, value);
      const policy = await getDumpsterRentalPolicy({ ...selection, businessId, requirePublicProduct });
      assert.equal(policy.dailyOveragePrice, expected);
    });
  }
}

test("catalog inherits an unset product rate and preserves an explicit free rate", async (t) => {
  for (const value of [null, 0]) {
    mockPricing(t, value);
    const products = await getPublicDumpsterProducts("13617", businessId);
    assert.equal(products[0].extraDayPrice, value === null ? 25 : 0);
    t.mock.restoreAll();
  }
});
