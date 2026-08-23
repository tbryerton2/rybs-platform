import "server-only";

import { getOfferedDumpsterProducts } from "@/lib/admin/dumpster-inventory";
import { getDumpsterSizeCapacity } from "@/lib/booking-product";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

type PublicDumpsterProductInput = {
  businessId: string;
  dumpsterSize?: string | null;
  dumpsterProductId?: string | null;
};

export type PublicDumpsterProductSetting = {
  dumpster_size: string;
  dumpster_product_id: string;
  display_name: string | null;
  included_rental_days: number | null;
  extra_day_price: number | string | null;
  base_price: number | string | null;
  is_public: boolean;
};

export class PublicDumpsterProductError extends Error {
  status = 404;

  constructor(message = "That dumpster option is not available for online booking.") {
    super(message);
    this.name = "PublicDumpsterProductError";
  }
}

export function isPublicDumpsterProductError(error: unknown): error is PublicDumpsterProductError {
  return error instanceof PublicDumpsterProductError;
}

function normalizeText(value: string | null | undefined) {
  const trimmed = String(value ?? "").trim();
  return trimmed || null;
}

function normalizeSizeText(value: string | null | undefined) {
  return normalizeText(value)?.toLowerCase().replace(/\s+/g, " ") ?? null;
}

function dumpsterSizesAreCompatible(left: string | null | undefined, right: string | null | undefined) {
  const leftSize = normalizeText(left);
  const rightSize = normalizeText(right);

  if (!leftSize || !rightSize) {
    return false;
  }

  const leftCapacity = getDumpsterSizeCapacity(leftSize);
  const rightCapacity = getDumpsterSizeCapacity(rightSize);

  if (leftCapacity !== null && rightCapacity !== null) {
    return leftCapacity === rightCapacity;
  }

  return normalizeSizeText(leftSize) === normalizeSizeText(rightSize);
}

function findCompatibleProductBySize(
  rows: PublicDumpsterProductSetting[],
  selectedSize: string,
) {
  const exact = rows.find(
    (row) => normalizeSizeText(row.dumpster_size) === normalizeSizeText(selectedSize),
  );

  return exact ?? rows.find((row) => dumpsterSizesAreCompatible(row.dumpster_size, selectedSize)) ?? null;
}

function fallbackProductId(size: string) {
  const normalized = size.trim().toLowerCase();
  if (normalized === "14 yard") return "default";
  return normalized.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "default";
}

function formatDefaultDisplayName(size: string) {
  return `${size.trim().replace(/\s+/g, "-")} dumpster`;
}

export async function getPublicDumpsterProductSetting({
  businessId,
  dumpsterSize,
  dumpsterProductId,
}: PublicDumpsterProductInput): Promise<PublicDumpsterProductSetting> {
  const selectedSize = normalizeText(dumpsterSize);
  const selectedProductId = normalizeText(dumpsterProductId);

  if (!businessId || (!selectedSize && !selectedProductId)) {
    throw new PublicDumpsterProductError();
  }

  const query = supabaseAdmin
    .from("dumpster_product_settings")
    .select(
      "dumpster_size, dumpster_product_id, display_name, included_rental_days, extra_day_price, base_price, is_public",
    )
    .eq("business_id", businessId);

  const { data, error } = await query;

  if (error) {
    throw new Error(error.message);
  }

  const rows = (Array.isArray(data) ? data : []) as PublicDumpsterProductSetting[];
  const productIdMatch = selectedProductId
    ? rows.find((row) => row.dumpster_product_id.trim() === selectedProductId) ?? null
    : null;
  const sizeMatch = selectedSize ? findCompatibleProductBySize(rows, selectedSize) : null;
  const matchedProduct = productIdMatch ?? (!selectedProductId ? sizeMatch : null);
  const offeredProducts = await getOfferedDumpsterProducts(businessId);

  if (matchedProduct) {
    if (matchedProduct.is_public !== true) {
      throw new PublicDumpsterProductError();
    }

    if (selectedSize && !dumpsterSizesAreCompatible(matchedProduct.dumpster_size, selectedSize)) {
      throw new PublicDumpsterProductError();
    }

    if (selectedProductId && matchedProduct.dumpster_product_id.trim() !== selectedProductId) {
      throw new PublicDumpsterProductError();
    }

    const isOffered = offeredProducts.some((product) =>
      dumpsterSizesAreCompatible(product.dumpsterSize, matchedProduct.dumpster_size),
    );

    if (!isOffered) {
      throw new PublicDumpsterProductError();
    }

    return matchedProduct;
  }

  if (!selectedSize || sizeMatch) {
    throw new PublicDumpsterProductError();
  }

  const offeredProduct = offeredProducts.find((product) =>
    dumpsterSizesAreCompatible(product.dumpsterSize, selectedSize),
  );

  if (!offeredProduct) {
    throw new PublicDumpsterProductError();
  }

  const fallbackId = fallbackProductId(offeredProduct.dumpsterSize);
  if (selectedProductId && selectedProductId !== fallbackId) {
    throw new PublicDumpsterProductError();
  }

  return {
    dumpster_size: offeredProduct.dumpsterSize,
    dumpster_product_id: fallbackId,
    display_name: formatDefaultDisplayName(offeredProduct.dumpsterSize),
    included_rental_days: null,
    extra_day_price: null,
    base_price: null,
    is_public: true,
  };
}
