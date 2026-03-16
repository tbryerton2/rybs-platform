import { createClient } from "@supabase/supabase-js";

const DEFAULT_PRICE = 399;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export function sanitizeZip(input?: string) {
  return (input || "").toString().replace(/\D/g, "").slice(0, 5);
}

export async function get14YardPriceForZip(inputZip?: string) {
  const zip = sanitizeZip(inputZip);
  const zipValid = zip.length === 5;

  // If zip invalid, return default
  if (!zipValid) {
    return {
      zip,
      zipValid,
      price: DEFAULT_PRICE,
      defaultPrice: DEFAULT_PRICE,
      overridePrice: null as number | null,
      serviceable: null as boolean | null,
    };
  }

  const { data, error } = await supabase
    .from("service_area_zips")
    .select("active, price_14_yard_override")
    .eq("zip", zip)
    .maybeSingle();

  if (error) throw error;

  // If no row or inactive → not serviceable
  if (!data || data.active === false) {
    return {
      zip,
      zipValid,
      price: DEFAULT_PRICE,
      defaultPrice: DEFAULT_PRICE,
      overridePrice: null,
      serviceable: false,
    };
  }

  const overrideRaw = data.price_14_yard_override;
  const overridePrice =
    overrideRaw === null || overrideRaw === undefined
      ? null
      : Number(overrideRaw);

  const price =
    Number.isFinite(overridePrice) && overridePrice! > 0
      ? overridePrice!
      : DEFAULT_PRICE;

  return {
    zip,
    zipValid,
    price,
    defaultPrice: DEFAULT_PRICE,
    overridePrice,
    serviceable: true,
  };
}