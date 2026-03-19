import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FLEET_SIZE = 3;

const SCHEDULE_PLACEMENT_SELECT =
  "placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions";

const SCHEDULE_JOB_SELECT = `
        id,
        customer_name,
        customer_city,
        customer_zip,
        delivery_date,
        pickup_date,
        pickup_mode,
        job_type,
        status,
        created_at,
        ${SCHEDULE_PLACEMENT_SELECT}
        `;

const BASE_SCHEDULE_JOB_SELECT = `
        id,
        customer_name,
        customer_city,
        customer_zip,
        delivery_date,
        pickup_date,
        pickup_mode,
        job_type,
        status,
        created_at
        `;

export async function getScheduleJobs(weekStartISO: string, weekEndISO: string) {
  const buildQuery = (selectClause: string) =>
    supabaseAdmin
      .from("bookings")
      .select(selectClause)
      .in("status", ["confirmed", "scheduled", "delivered"])
      .lte("delivery_date", weekEndISO)
      .not("status", "eq", "cancelled")
      .or(`pickup_date.is.null,pickup_date.gte.${weekStartISO}`)
      .order("delivery_date", { ascending: true });

  const { data, error } = await buildQuery(SCHEDULE_JOB_SELECT);

  if (error && isBookingSchemaError(error)) {
    const fallback = await buildQuery(BASE_SCHEDULE_JOB_SELECT);
    if (fallback.error) {
      throw new Error(fallback.error.message);
    }

    return (fallback.data ?? []).map((row) => ({
      ...row,
      ...EMPTY_BOOKING_PLACEMENT_FIELDS,
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}
