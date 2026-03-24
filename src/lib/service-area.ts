import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type ServiceAreaZipRecord = {
  zip: string;
  county: string | null;
  town: string | null;
};

export function sanitizeServiceAreaZip(input: string | null | undefined) {
  return (input || "").replace(/\D/g, "").slice(0, 5);
}

export async function getActiveServiceAreaZip(zipInput: string): Promise<ServiceAreaZipRecord | null> {
  const zip = sanitizeServiceAreaZip(zipInput);

  if (!/^\d{5}$/.test(zip)) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("service_area_zips")
    .select("zip, county, town")
    .eq("zip", zip)
    .eq("active", true)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return {
    zip: data.zip as string,
    county: (data.county as string | null) ?? null,
    town: (data.town as string | null) ?? null,
  };
}
