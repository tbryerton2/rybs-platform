import "server-only";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizePricingPageSettings } from "./pricing-page-content";

export async function getPricingPageSettings(businessId: string) {
  const { data, error } = await supabaseAdmin.from("pricing_page_settings")
    .select("headline, introduction, included_heading, included_items, bottom_note, show_size_guide, size_guide_button_text, size_guide_title")
    .eq("business_id", businessId).maybeSingle();
  if (error) throw new Error(error.message);
  return normalizePricingPageSettings(data);
}
