import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingSchemaError } from "@/lib/booking-schema";

export const REORDER_ELIGIBLE_STATUS = "picked_up";

export type ReorderDraft = {
  zip?: string;
  county?: string | null;
  town?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerStreet?: string | null;
  customerCity?: string | null;
  customerZip?: string | null;
  placementPreference?: string | null;
  placementDetails?: string | null;
  accessIssues?: string[];
  gateInstructions?: string | null;
  deliveryPresence?: string | null;
  alternateContactName?: string | null;
  alternateContactPhone?: string | null;
  placementPhotoUrl?: string | null;
  specialDeliveryInstructions?: string | null;
  reorderSourceBookingId?: string;
  reorderSourceBookingShortId?: string;
};

export type ReorderSourceBookingRow = {
  id: string;
  customer_id: string | null;
  customer_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_zip: string | null;
  service_county: string | null;
  service_town: string | null;
  status: string | null;
  placement_preference: string | null;
  placement_details: string | null;
  access_issues: string[] | null;
  gate_instructions: string | null;
  delivery_presence: string | null;
  alternate_contact_name: string | null;
  alternate_contact_phone: string | null;
  placement_photo_url: string | null;
  special_delivery_instructions: string | null;
};

export function canReorderBooking(status: string | null | undefined) {
  return String(status ?? "").toLowerCase() === REORDER_ELIGIBLE_STATUS;
}

export function buildReorderDraft(source: ReorderSourceBookingRow): ReorderDraft {
  return {
    zip: source.customer_zip ?? undefined,
    county: source.service_county,
    town: source.service_town,
    customerName: source.customer_name,
    customerEmail: source.customer_email,
    customerPhone: source.customer_phone,
    customerStreet: source.customer_street,
    customerCity: source.customer_city,
    customerZip: source.customer_zip,
    placementPreference: source.placement_preference,
    placementDetails: source.placement_details,
    accessIssues: source.access_issues ?? [],
    gateInstructions: source.gate_instructions,
    deliveryPresence: source.delivery_presence,
    alternateContactName: source.alternate_contact_name,
    alternateContactPhone: source.alternate_contact_phone,
    placementPhotoUrl: source.placement_photo_url,
    specialDeliveryInstructions: source.special_delivery_instructions,
    reorderSourceBookingId: source.id,
    reorderSourceBookingShortId: source.id.slice(0, 8),
  };
}

export function getReorderNotice(sourceBookingShortId: string | null | undefined) {
  return sourceBookingShortId
    ? `We prefilled this booking using your previous rental #${sourceBookingShortId}. Review and update anything you need before confirming.`
    : "We prefilled this booking using your previous rental. Review and update anything you need before confirming.";
}

export async function attachReorderReference(
  supabase: SupabaseClient,
  bookingId: string,
  reorderedFromBookingId: string | null | undefined,
) {
  const sourceBookingId = String(reorderedFromBookingId ?? "").trim();
  if (!sourceBookingId) return { skipped: false };

  const { error } = await supabase
    .from("bookings")
    .update({ reordered_from_booking_id: sourceBookingId })
    .eq("id", bookingId);

  if (!error) return { skipped: false };
  if (isBookingSchemaError(error)) {
    console.warn("reorder reference column unavailable on bookings; skipping reordered_from_booking_id write");
    return { skipped: true };
  }

  throw new Error(error.message);
}
