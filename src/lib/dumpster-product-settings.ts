import "server-only";

import { defaultProductIdentity, findProductForSize } from "@/lib/product-position";
import { cleanProductDescription } from "@/lib/product-card-content";

import { getOfferedDumpsterProducts } from "@/lib/admin/dumpster-inventory";
import { getDumpsterSizeCapacity } from "@/lib/booking-product";
import { getZipPricingOverridesBySize } from "@/lib/pricing";
import { DEFAULT_PRICING_SETTINGS, getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

export type DumpsterProductSettingsRow = {
  id: string;
  dumpster_size: string;
  dumpster_product_id: string;
  display_name: string;
  short_description: string | null;
  customer_bullet_points: string | null;
  dimensions: string | null;
  truck_load_estimate: string | null;
  size_guide_examples: string | null;
  included_weight_tons: number | string | null;
  included_rental_days: number | null;
  extra_day_price: number | string | null;
  base_price: number | string | null;
  is_public: boolean;
  position: number;
  created_at: string;
  updated_at: string;
};

export type DumpsterProductSetting = {
  id: string;
  dumpsterSize: string;
  dumpsterProductId: string;
  displayName: string;
  shortDescription: string;
  customerBulletPoints: string;
  dimensions: string;
  truckLoadEstimate: string;
  sizeGuideExamples: string;
  includedWeightTons: number | null;
  includedRentalDays: number | null;
  extraDayPrice: number | null;
  basePrice: number | null;
  isPublic: boolean;
  position: number;
  createdAt: string;
  updatedAt: string;
  isDraft: boolean;
  isActiveSize: boolean;
};

export type PublicDumpsterProduct = {
  dumpsterSize: string;
  dumpsterProductId: string;
  displayName: string;
  shortDescription: string;
  customerBulletPoints: string;
  dimensions: string;
  truckLoadEstimate: string;
  sizeGuideExamples: string;
  includedWeightTons: number;
  tonOveragePrice: number;
  includedRentalDays: number;
  extraDayPrice: number;
  basePrice: number;
  isPublic: boolean;
  position: number;
};

const DUMPSTER_PRODUCT_SETTINGS_SELECT = `
  id,
  dumpster_size,
  dumpster_product_id,
  display_name,
  short_description,
  customer_bullet_points,
  dimensions,
  truck_load_estimate,
  size_guide_examples,
  included_weight_tons,
  included_rental_days,
  extra_day_price,
  base_price,
  is_public,
  position,
  created_at,
  updated_at
`;

function asNumber(value: number | string | null | undefined) {
  if (value == null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asString(value: string | null | undefined) {
  return value?.trim() || "";
}

function formatDefaultDisplayName(size: string) {
  return `${size.trim().replace(/\s+/g, "-")} dumpster`;
}

function fallbackProductId(size: string) {
  const normalized = size.trim().toLowerCase();
  if (normalized === "14 yard") return "default";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

function normalizeSizeText(value: string | null | undefined) {
  return value?.trim().toLowerCase().replace(/\s+/g, " ") || "";
}

function findOverridePrice(overridesBySize: Map<string, number>, size: string) {
  const normalizedSize = normalizeSizeText(size);

  for (const [overrideSize, price] of overridesBySize) {
    if (normalizeSizeText(overrideSize) === normalizedSize) return price;
  }

  const capacity = getDumpsterSizeCapacity(size);
  if (capacity === null) return undefined;

  for (const [overrideSize, price] of overridesBySize) {
    if (getDumpsterSizeCapacity(overrideSize) === capacity) return price;
  }

  return undefined;
}

function mapRow(row: DumpsterProductSettingsRow): DumpsterProductSetting {
  return {
    id: row.id,
    dumpsterSize: row.dumpster_size,
    dumpsterProductId: row.dumpster_product_id,
    displayName: row.display_name,
    shortDescription: asString(cleanProductDescription(row.short_description)),
    customerBulletPoints: asString(row.customer_bullet_points),
    dimensions: asString(row.dimensions),
    truckLoadEstimate: asString(row.truck_load_estimate),
    sizeGuideExamples: asString(row.size_guide_examples),
    includedWeightTons: asNumber(row.included_weight_tons),
    includedRentalDays: row.included_rental_days ?? null,
    extraDayPrice: asNumber(row.extra_day_price),
    basePrice: asNumber(row.base_price),
    isPublic: Boolean(row.is_public),
    position: row.position,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDraft: false,
    isActiveSize: false,
  };
}

export async function getDumpsterProductSettings(businessId?: string): Promise<DumpsterProductSetting[]> {
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  const { data, error } = await supabaseAdmin
    .from("dumpster_product_settings")
    .select(DUMPSTER_PRODUCT_SETTINGS_SELECT)
    .eq("business_id", resolvedBusinessId)
    .order("position", { ascending: true })
    .order("id", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DumpsterProductSettingsRow[]).map(mapRow);
}

async function ensureOfferedProductSettings(businessId: string) {
  const [offered, settings, pricing] = await Promise.all([
    getOfferedDumpsterProducts(businessId), getDumpsterProductSettings(businessId), getPricingSettingsSnapshot(businessId),
  ]);
  const missing = offered.filter((product) => !findProductForSize(settings, product.dumpsterSize));
  if (missing.length) {
    const { error } = await supabaseAdmin.rpc("ensure_dumpster_product_positions", {
      p_business_id: businessId,
      p_products: missing.map((product) => ({
        ...defaultProductIdentity(product.dumpsterSize),
        base_price: pricing.basePrice ?? DEFAULT_PRICING_SETTINGS.basePrice,
        extra_day_price: pricing.dailyOveragePrice ?? DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
        included_weight_tons: pricing.includedTons ?? DEFAULT_PRICING_SETTINGS.includedTons,
        included_rental_days: pricing.standardRentalDays ?? DEFAULT_PRICING_SETTINGS.standardRentalDays,
      })),
    });
    if (error) throw new Error(error.message);
  }
  const persisted = missing.length ? await getDumpsterProductSettings(businessId) : settings;
  if (persisted.some((product) => product.position == null)) {
    throw new Error("Product position backfill must complete before using Sizes & Pricing.");
  }
  return { offered, settings: persisted, pricing };
}

export async function getEditableDumpsterProductSettings(businessId?: string): Promise<DumpsterProductSetting[]> {
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  const { offered, settings } = await ensureOfferedProductSettings(resolvedBusinessId);
  const activeIds = new Set(offered.map((product) => findProductForSize(settings, product.dumpsterSize)?.id));
  return settings.map((setting) => ({ ...setting, isActiveSize: activeIds.has(setting.id) }))
    .sort((left, right) => left.position - right.position);
}

export async function getPublicDumpsterProducts(
  zip?: string,
  businessId?: string,
): Promise<PublicDumpsterProduct[]> {
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  const [{ offered: offeredProducts, settings: productSettings, pricing: pricingSettings }, zipPricingOverrides] = await Promise.all([
    ensureOfferedProductSettings(resolvedBusinessId), getZipPricingOverridesBySize(zip, resolvedBusinessId),
  ]);

  return offeredProducts
    .slice()
    .map((offered) => {
      const setting = findProductForSize(productSettings, offered.dumpsterSize);
      const basePrice =
        findOverridePrice(zipPricingOverrides.overridesBySize, offered.dumpsterSize) ??
        setting?.basePrice ??
        pricingSettings.basePrice ??
        DEFAULT_PRICING_SETTINGS.basePrice;

      return {
        dumpsterSize: offered.dumpsterSize,
        dumpsterProductId: setting?.dumpsterProductId || fallbackProductId(offered.dumpsterSize),
        displayName: setting?.displayName || formatDefaultDisplayName(offered.dumpsterSize),
        shortDescription: setting?.shortDescription || "",
        customerBulletPoints: setting?.customerBulletPoints || "",
        dimensions: setting?.dimensions || "",
        truckLoadEstimate: setting?.truckLoadEstimate || "",
        sizeGuideExamples: setting?.sizeGuideExamples || "",
        includedWeightTons:
          setting?.includedWeightTons ?? pricingSettings.includedTons ?? DEFAULT_PRICING_SETTINGS.includedTons,
        tonOveragePrice:
          pricingSettings.tonOveragePrice ?? DEFAULT_PRICING_SETTINGS.tonOveragePrice,
        includedRentalDays:
          setting?.includedRentalDays ??
          pricingSettings.standardRentalDays ??
          DEFAULT_PRICING_SETTINGS.standardRentalDays,
        extraDayPrice:
          setting?.extraDayPrice ??
          pricingSettings.dailyOveragePrice ??
          DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
        basePrice,
        isPublic: setting?.isPublic ?? true,
        position: setting!.position,
      };
    })
    .filter((product) => product.isPublic)
    .sort((left, right) => left.position - right.position);
}
