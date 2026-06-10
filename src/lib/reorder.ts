import type { SupabaseClient } from "@supabase/supabase-js";
import { isBookingSchemaError } from "@/lib/booking-schema";
import { combineCustomerNameParts } from "@/lib/customer-name";

export const REORDER_ELIGIBLE_STATUS = "picked_up";

export type ReorderDraft = {
  zip?: string;
  county?: string | null;
  town?: string | null;
  customerFirstName?: string | null;
  customerLastName?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerStreet?: string | null;
  customerCity?: string | null;
  customerState?: string | null;
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
  reorderSourceBookingRef?: string | null;
};

export type ReorderSourceBookingRow = {
  id: string;
  booking_ref?: string | null;
  customer_id: string | null;
  customer_first_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_phone: string | null;
  customer_street: string | null;
  customer_city: string | null;
  customer_state: string | null;
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
    customerFirstName: source.customer_first_name,
    customerLastName: source.customer_last_name,
    customerName: combineCustomerNameParts(source.customer_first_name, source.customer_last_name),
    customerEmail: source.customer_email,
    customerPhone: source.customer_phone,
    customerStreet: source.customer_street,
    customerCity: source.customer_city,
    customerState: source.customer_state,
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
    reorderSourceBookingRef: source.booking_ref ?? null,
  };
}

export function getReorderNotice(sourceBookingRef: string | null | undefined) {
  return sourceBookingRef
    ? `Based on ${sourceBookingRef}, we prefilled this booking for you. Review and update anything you need before confirming. Current pricing, serviceability, and scheduling still apply.`
    : "Based on your previous rental, we prefilled this booking for you. Review and update anything you need before confirming. Current pricing, serviceability, and scheduling still apply.";
}

export async function attachReorderReference(
  supabase: SupabaseClient,
  bookingId: string,
  reorderedFromBookingId: string | null | undefined,
) {
  const sourceBookingId = String(reorderedFromBookingId ?? "").trim();
  if (!sourceBookingId) {
    return {
      attempted: false,
      skipped: false,
      bookingId,
      sourceBookingId: null,
      persistedValue: null,
    };
  }

  const { data, error } = await supabase
    .from("bookings")
    .update({ reordered_from_booking_id: sourceBookingId })
    .eq("id", bookingId)
    .select("id, reordered_from_booking_id")
    .maybeSingle();

  if (!error) {
    return {
      attempted: true,
      skipped: false,
      bookingId,
      sourceBookingId,
      persistedValue: data?.reordered_from_booking_id ?? null,
    };
  }
  if (isBookingSchemaError(error)) {
    console.warn("reorder reference column unavailable on bookings; skipping reordered_from_booking_id write");
    return {
      attempted: true,
      skipped: true,
      bookingId,
      sourceBookingId,
      persistedValue: null,
    };
  }

  throw new Error(error.message);
}
