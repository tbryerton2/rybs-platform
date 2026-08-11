import "server-only";

import { cookies } from "next/headers";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  getCurrentTenant,
  getServerTenantStorageKeyForTenant,
} from "@/lib/tenant/server";
import { TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

type ValidActiveHoldExclusionInput = {
  holdId: string;
  dumpsterSize: string;
  dumpsterProductId: string | null;
  businessId?: string;
  holdDeliveryDate?: string | null;
  holdPickupDate?: string | null;
};

function normalizeText(value: string | null | undefined) {
  return String(value ?? "").trim();
}

export async function getValidActiveHoldExclusionId(input: ValidActiveHoldExclusionInput) {
  const holdId = normalizeText(input.holdId);
  if (!holdId) return null;

  const businessId = input.businessId ?? (await getCurrentTenant()).id;
  const cookieName = await getServerTenantStorageKeyForTenant(businessId, TENANT_STORAGE_KEYS.portalClientId);
  const clientId = normalizeText((await cookies()).get(cookieName)?.value);
  if (!clientId) return null;

  const { data, error } = await supabaseAdmin
    .from("booking_holds")
    .select("id, client_id, status, expires_at, delivery_date, pickup_date, dumpster_size, dumpster_product_id")
    .eq("id", holdId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message || "Hold lookup failed.");
  }

  if (!data) return null;
  if (data.client_id !== clientId) return null;
  if (data.status !== "active") return null;

  const expiresAtMs = Date.parse(normalizeText(data.expires_at));
  if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) return null;

  if (normalizeText(data.dumpster_size) !== normalizeText(input.dumpsterSize)) return null;
  if (normalizeText(data.dumpster_product_id) !== normalizeText(input.dumpsterProductId)) return null;

  const holdDeliveryDate = normalizeText(input.holdDeliveryDate);
  if (holdDeliveryDate && normalizeText(data.delivery_date) !== holdDeliveryDate) return null;

  const holdPickupDate = normalizeText(input.holdPickupDate);
  if (holdPickupDate && normalizeText(data.pickup_date) !== holdPickupDate) return null;

  return data.id as string;
}
