export function isBookingSchemaError(errorLike: { message?: string | null } | string | null | undefined) {
  const message =
    typeof errorLike === "string" ? errorLike : typeof errorLike?.message === "string" ? errorLike.message : "";
  const normalized = message.toLowerCase();

  return (
    normalized.includes("schema cache") ||
    normalized.includes("could not find the") ||
    normalized.includes("does not exist") ||
    normalized.includes("has no column") ||
    (normalized.includes("column") && normalized.includes("not found"))
  );
}

export function bookingPlacementSchemaMessage() {
  return "Booking placement fields are not available in this database yet. Run the latest booking placement migration and refresh the Supabase schema cache, then try again.";
}

export const EMPTY_BOOKING_PLACEMENT_FIELDS = {
  placement_preference: null,
  placement_details: null,
  access_issues: null,
  gate_instructions: null,
  delivery_presence: null,
  alternate_contact_name: null,
  alternate_contact_phone: null,
  placement_photo_url: null,
  special_delivery_instructions: null,
} as const;
