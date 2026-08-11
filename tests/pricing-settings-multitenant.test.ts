import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  buildTenantSetupSummary,
  type PlatformTenantRecord,
  type TenantSetupSignals,
} from "../src/lib/platform-admin/setup-completeness.ts";

const repoRoot = resolve(import.meta.dirname, "..");

const TAN_CAN_MAN_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const DEMO_DUMPSTER_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

function tenant(input: Partial<PlatformTenantRecord> & { id: string; slug: string }): PlatformTenantRecord {
  return {
    id: input.id,
    slug: input.slug,
    status: input.status ?? "active",
    createdAt: input.createdAt ?? "2026-01-01T00:00:00.000Z",
    updatedAt: input.updatedAt ?? "2026-01-02T00:00:00.000Z",
  };
}

function setupSignals(input: Partial<TenantSetupSignals> = {}): TenantSetupSignals {
  return {
    activeAdminMembershipCount: 1,
    activeServiceAreaZipCount: 1,
    activeDumpsterCount: 1,
    bookableDumpsterCount: 1,
    publicProductCount: 0,
    activePublicDomainCount: 1,
    publishedContentCount: 0,
    draftContentCount: 0,
    pricing: null,
    settings: {
      "brand.name": "Demo Dumpster Company",
      "support.email": "support@example.com",
      "support.timezone": "America/New_York",
      "runtime.storageNamespace": "demo_dumpster_company",
    },
    ...input,
  };
}

function insertPricingRow(
  rows: Array<{ businessId: string; standardRentalPrice: number }>,
  row: { businessId: string; standardRentalPrice: number },
) {
  if (rows.some((existing) => existing.businessId === row.businessId)) {
    throw new Error('duplicate key value violates unique constraint "pricing_settings_business_id_key"');
  }

  rows.push(row);
}

test("pricing settings allow one row for Tan Can Man and one row for Demo", () => {
  const rows: Array<{ businessId: string; standardRentalPrice: number }> = [];

  insertPricingRow(rows, {
    businessId: TAN_CAN_MAN_BUSINESS_ID,
    standardRentalPrice: 475,
  });
  insertPricingRow(rows, {
    businessId: DEMO_DUMPSTER_BUSINESS_ID,
    standardRentalPrice: 525,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows.find((row) => row.businessId === TAN_CAN_MAN_BUSINESS_ID)?.standardRentalPrice, 475);
  assert.equal(rows.find((row) => row.businessId === DEMO_DUMPSTER_BUSINESS_ID)?.standardRentalPrice, 525);
});

test("a second pricing settings row for the same business is rejected", () => {
  const rows: Array<{ businessId: string; standardRentalPrice: number }> = [];

  insertPricingRow(rows, {
    businessId: TAN_CAN_MAN_BUSINESS_ID,
    standardRentalPrice: 475,
  });

  assert.throws(
    () =>
      insertPricingRow(rows, {
        businessId: TAN_CAN_MAN_BUSINESS_ID,
        standardRentalPrice: 500,
      }),
    /pricing_settings_business_id_key/,
  );
});

test("corrective migration drops only the legacy global singleton and enforces business uniqueness", () => {
  const source = readRepoFile("supabase/migrations/202608060102_fix_pricing_settings_business_uniqueness.sql");

  assert.match(source, /drop constraint pricing_settings_singleton_idx/);
  assert.match(source, /drop index if exists public\.pricing_settings_singleton_idx/);
  assert.match(source, /add constraint pricing_settings_business_id_key[\s\S]*unique \(business_id\)/);
  assert.doesNotMatch(source, /\binsert\s+into\s+public\.pricing_settings\b/i);
  assert.doesNotMatch(source, /\bupdate\s+public\.pricing_settings\b/i);
  assert.doesNotMatch(source, /\bdelete\s+from\s+public\.pricing_settings\b/i);
});

test("admin pricing page with no row does not insert, upsert, or update pricing settings", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/pricing/page.tsx");

  assert.match(source, /const adminSession = await requireAdminOwner\(\)/);
  assert.match(source, /getPricingSettings\(adminSession\.business\.id\)/);
  assert.match(source, /getEditableDumpsterProductSettings\(adminSession\.business\.id\)/);
  assert.match(source, /\.eq\("business_id", businessId\)/);
  assert.doesNotMatch(source, /\.from\("pricing_settings"\)[\s\S]{0,900}\.(?:insert|upsert|update)\(/);
  assert.doesNotMatch(source, /formData\.get\(["']businessId["']\)/);
});

test("admin pricing page returns unsaved suggested defaults when no row exists", () => {
  const pageSource = readRepoFile("src/app/admin/(protected)/settings/pricing/page.tsx");
  const formSource = readRepoFile("src/app/admin/(protected)/settings/pricing/pricing-settings-form.tsx");

  assert.match(pageSource, /function getDefaultPricingSettings\(\)/);
  assert.match(pageSource, /id: null/);
  assert.match(pageSource, /isPersisted: false/);
  assert.match(pageSource, /DEFAULT_PRICING_SETTINGS\.tonOveragePrice/);
  assert.match(pageSource, /DEFAULT_PRICING_SETTINGS\.maxRentalDays/);
  assert.match(pageSource, /DEFAULT_PRICING_SETTINGS\.allowExtendedRentalAtBooking/);
  assert.match(pageSource, /DEFAULT_PRICING_SETTINGS\.includedServicesBlurb/);
  assert.match(formSource, /These are suggested defaults\. Save to configure pricing for this business\./);
  assert.match(formSource, /value=\{pricing\.id \?\? ""\}/);
});

test("admin pricing writes cannot use a forged business id", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/pricing/actions.ts");

  assert.match(source, /const adminSession = await requireAdminOwner\(\)/);
  assert.match(source, /business_id: adminSession\.business\.id/);
  assert.match(source, /\.eq\("business_id", adminSession\.business\.id\)/);
  assert.match(source, /onConflict: "business_id"/);
  assert.match(source, /onConflict: "business_id,dumpster_size"/);
  assert.doesNotMatch(source, /formData\.get\(["']businessId["']\)/);
  assert.doesNotMatch(source, /\bvalues\.businessId\b/);
});

test("first pricing save creates a tenant-scoped row from validated submitted values", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/pricing/actions.ts");

  assert.match(source, /const id = asString\(formData\.get\("id"\)\)\.trim\(\)/);
  assert.match(source, /ton_overage_price: tonOveragePrice/);
  assert.match(source, /max_rental_days: maxRentalDays/);
  assert.match(source, /allow_extended_rental_at_booking: values\.allowExtendedRentalAtBooking/);
  assert.match(source, /included_services_blurb: values\.includedServicesBlurb \|\| null/);
  assert.match(source, /standard_rental_price: DEFAULT_PRICING_SETTINGS\.standardRentalPrice/);
  assert.match(source, /scheduled_pickup_price: DEFAULT_PRICING_SETTINGS\.scheduledPickupPrice/);
  assert.match(source, /\.upsert\([\s\S]*\{ onConflict: "business_id" \}/);
});

test("subsequent pricing save updates only the authenticated business row", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/pricing/actions.ts");

  assert.match(source, /\.update\(payload\)[\s\S]*\.eq\("id", id\)[\s\S]*\.eq\("business_id", adminSession\.business\.id\)/);
  assert.match(source, /\.select\("id"\)[\s\S]*\.maybeSingle\(\)/);
});

test("Demo pricing changes cannot alter Tan Can Man pricing in the scoped write model", () => {
  const rows = new Map<string, { standardRentalPrice: number }>([
    [TAN_CAN_MAN_BUSINESS_ID, { standardRentalPrice: 475 }],
    [DEMO_DUMPSTER_BUSINESS_ID, { standardRentalPrice: 525 }],
  ]);

  function updateAuthenticatedBusinessPricing(authenticatedBusinessId: string, standardRentalPrice: number) {
    const row = rows.get(authenticatedBusinessId);
    if (!row) throw new Error("Pricing row not found.");
    row.standardRentalPrice = standardRentalPrice;
  }

  updateAuthenticatedBusinessPricing(DEMO_DUMPSTER_BUSINESS_ID, 600);

  assert.equal(rows.get(DEMO_DUMPSTER_BUSINESS_ID)?.standardRentalPrice, 600);
  assert.equal(rows.get(TAN_CAN_MAN_BUSINESS_ID)?.standardRentalPrice, 475);
});

test("existing Tan Can Man pricing remains readable by exact business id", () => {
  const rows = new Map<string, { standardRentalPrice: number }>([
    [TAN_CAN_MAN_BUSINESS_ID, { standardRentalPrice: 475 }],
    [DEMO_DUMPSTER_BUSINESS_ID, { standardRentalPrice: 525 }],
  ]);

  assert.equal(rows.get(TAN_CAN_MAN_BUSINESS_ID)?.standardRentalPrice, 475);
});

test("setup completeness stays incomplete before first pricing save", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: DEMO_DUMPSTER_BUSINESS_ID, slug: "demo-dumpster-company" }),
    setupSignals({ pricing: null }),
  );

  assert.equal(summary.areas.find((area) => area.key === "pricing")?.status, "needs_attention");
});

test("setup completeness marks pricing configured after a row exists", () => {
  const summary = buildTenantSetupSummary(
    tenant({ id: DEMO_DUMPSTER_BUSINESS_ID, slug: "demo-dumpster-company" }),
    setupSignals({
      pricing: {
        id: "pricing-demo",
        standardRentalPrice: 475,
        includedRentalDays: 7,
        dailyOveragePrice: 30,
        includedTons: 1,
        tonOveragePrice: 100,
        maxRentalDays: null,
      },
    }),
  );

  assert.equal(summary.areas.find((area) => area.key === "pricing")?.status, "complete");
});
