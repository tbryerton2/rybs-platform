import "server-only";

import { getOfferedDumpsterProducts, type OfferedDumpsterProduct } from "@/lib/admin/dumpster-inventory";
import { getZipPricingOverridesBySize } from "@/lib/pricing";
import { DEFAULT_PRICING_SETTINGS, getPricingSettingsSnapshot } from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type DumpsterProductSettingsRow = {
  id: string;
  dumpster_size: string;
  dumpster_product_id: string;
  display_name: string;
  short_description: string | null;
  customer_bullet_points: string | null;
  dimensions: string | null;
  included_weight_tons: number | string | null;
  included_rental_days: number | null;
  extra_day_price: number | string | null;
  base_price: number | string | null;
  is_public: boolean;
  sort_order: number;
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
  includedWeightTons: number | null;
  includedRentalDays: number | null;
  extraDayPrice: number | null;
  basePrice: number | null;
  isPublic: boolean;
  sortOrder: number;
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
  includedWeightTons: number;
  tonOveragePrice: number;
  includedRentalDays: number;
  extraDayPrice: number;
  basePrice: number;
  isPublic: boolean;
  sortOrder: number;
};

const DUMPSTER_PRODUCT_SETTINGS_SELECT = `
  id,
  dumpster_size,
  dumpster_product_id,
  display_name,
  short_description,
  customer_bullet_points,
  dimensions,
  included_weight_tons,
  included_rental_days,
  extra_day_price,
  base_price,
  is_public,
  sort_order,
  created_at,
  updated_at
`;

function asNumber(value: number | string | null | undefined) {
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

function mapRow(row: DumpsterProductSettingsRow): DumpsterProductSetting {
  return {
    id: row.id,
    dumpsterSize: row.dumpster_size,
    dumpsterProductId: row.dumpster_product_id,
    displayName: row.display_name,
    shortDescription: asString(row.short_description),
    customerBulletPoints: asString(row.customer_bullet_points),
    dimensions: asString(row.dimensions),
    includedWeightTons: asNumber(row.included_weight_tons),
    includedRentalDays: row.included_rental_days ?? null,
    extraDayPrice: asNumber(row.extra_day_price),
    basePrice: asNumber(row.base_price),
    isPublic: Boolean(row.is_public),
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    isDraft: false,
    isActiveSize: false,
  };
}

function compareOfferedProducts(left: OfferedDumpsterProduct, right: OfferedDumpsterProduct) {
  return left.activeCount === right.activeCount
    ? left.displayLabel.localeCompare(right.displayLabel)
    : left.activeCount - right.activeCount;
}

export async function getDumpsterProductSettings(): Promise<DumpsterProductSetting[]> {
  const { data, error } = await supabaseAdmin
    .from("dumpster_product_settings")
    .select(DUMPSTER_PRODUCT_SETTINGS_SELECT)
    .order("sort_order", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return ((data ?? []) as DumpsterProductSettingsRow[]).map(mapRow);
}

export async function getEditableDumpsterProductSettings(): Promise<DumpsterProductSetting[]> {
  const [offeredProducts, productSettings, pricingSettings] = await Promise.all([
    getOfferedDumpsterProducts(),
    getDumpsterProductSettings(),
    getPricingSettingsSnapshot(),
  ]);

  const settingsBySize = new Map(
    productSettings.map((setting) => [setting.dumpsterSize.trim().toLowerCase(), setting]),
  );
  const activeSizes = new Set(offeredProducts.map((product) => product.dumpsterSize.trim().toLowerCase()));

  const merged = offeredProducts.map((offered) => {
    const key = offered.dumpsterSize.trim().toLowerCase();
    const existing = settingsBySize.get(key);

    if (existing) {
      return {
        ...existing,
        isDraft: false,
        isActiveSize: true,
      };
    }

    return {
      id: "",
      dumpsterSize: offered.dumpsterSize,
      dumpsterProductId: fallbackProductId(offered.dumpsterSize),
      displayName: formatDefaultDisplayName(offered.dumpsterSize),
      shortDescription: "Draft defaults based on the current global pricing fallback.",
      customerBulletPoints: "",
      dimensions: "",
      includedWeightTons:
        pricingSettings.includedTons ?? DEFAULT_PRICING_SETTINGS.includedTons,
      tonOveragePrice:
        pricingSettings.tonOveragePrice ?? DEFAULT_PRICING_SETTINGS.tonOveragePrice,
      includedRentalDays:
        pricingSettings.standardRentalDays ?? DEFAULT_PRICING_SETTINGS.standardRentalDays,
      extraDayPrice:
        pricingSettings.dailyOveragePrice ?? DEFAULT_PRICING_SETTINGS.dailyOveragePrice,
      basePrice:
        pricingSettings.basePrice ?? DEFAULT_PRICING_SETTINGS.basePrice,
      isPublic: true,
      sortOrder: offered.activeCount,
      createdAt: "",
      updatedAt: "",
      isDraft: true,
      isActiveSize: true,
    };
  });

  const inactiveExisting = productSettings
    .filter((setting) => !activeSizes.has(setting.dumpsterSize.trim().toLowerCase()))
    .map((setting) => ({
      ...setting,
      isDraft: false,
      isActiveSize: false,
    }));

  return [...merged, ...inactiveExisting].sort((left, right) => {
    if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
    return left.displayName.localeCompare(right.displayName);
  });
}

export async function getPublicDumpsterProducts(
  zip?: string,
): Promise<PublicDumpsterProduct[]> {
  const [offeredProducts, productSettings, pricingSettings, zipPricingOverrides] = await Promise.all([
    getOfferedDumpsterProducts(),
    getDumpsterProductSettings(),
    getPricingSettingsSnapshot(),
    getZipPricingOverridesBySize(zip),
  ]);

  const settingsBySize = new Map(
    productSettings.map((setting) => [setting.dumpsterSize.trim().toLowerCase(), setting]),
  );

  return offeredProducts
    .slice()
    .sort(compareOfferedProducts)
    .map((offered) => {
      const setting = settingsBySize.get(offered.dumpsterSize.trim().toLowerCase());
      const basePrice =
        zipPricingOverrides.overridesBySize.get(offered.dumpsterSize.trim().toLowerCase()) ??
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
        sortOrder: setting?.sortOrder ?? offered.activeCount,
      };
    })
    .filter((product) => product.isPublic)
    .sort((left, right) => {
      if (left.sortOrder !== right.sortOrder) return left.sortOrder - right.sortOrder;
      return left.displayName.localeCompare(right.displayName);
    });
}
