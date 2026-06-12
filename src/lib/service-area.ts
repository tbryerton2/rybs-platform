import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { getCurrentTenant } from "@/lib/tenant/server";

export type ServiceAreaZipRecord = {
  zip: string;
  county: string | null;
  town: string | null;
  state: string | null;
};

type ServiceAreaZipRow = {
  zip: string;
  county: string | null;
  town: string | null;
  state?: string | null;
};

let serviceAreaStateColumnAvailable: boolean | null = null;

export function sanitizeServiceAreaZip(input: string | null | undefined) {
  return (input || "").replace(/\D/g, "").slice(0, 5);
}

export async function getActiveServiceAreaZip(
  zipInput: string,
  businessId?: string,
): Promise<ServiceAreaZipRecord | null> {
  const resolvedBusinessId = businessId ?? (await getCurrentTenant()).id;
  const zip = sanitizeServiceAreaZip(zipInput);

  if (!/^\d{5}$/.test(zip)) {
    return null;
  }

  const selectColumns =
    serviceAreaStateColumnAvailable === false ? "zip, county, town" : "zip, county, town, state";
  const result = await supabaseAdmin
    .from("service_area_zips")
    .select(selectColumns)
    .eq("zip", zip)
    .eq("business_id", resolvedBusinessId)
    .eq("active", true)
    .maybeSingle();
  let data = result.data as ServiceAreaZipRow | null;
  let error = result.error;

  if (error && serviceAreaStateColumnAvailable !== false && isBookingSchemaError(error)) {
    serviceAreaStateColumnAvailable = false;
    const fallback = await supabaseAdmin
      .from("service_area_zips")
      .select("zip, county, town")
      .eq("zip", zip)
      .eq("business_id", resolvedBusinessId)
      .eq("active", true)
      .maybeSingle();
    data = fallback.data as ServiceAreaZipRow | null;
    error = fallback.error;
  } else if (!error) {
    serviceAreaStateColumnAvailable = serviceAreaStateColumnAvailable ?? true;
  }

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  const state = typeof data.state === "string" && /^[A-Za-z]{2}$/.test(data.state.trim())
    ? data.state.trim().toUpperCase()
    : null;

  return {
    zip: data.zip as string,
    county: (data.county as string | null) ?? null,
    town: (data.town as string | null) ?? null,
    state,
  };
}
