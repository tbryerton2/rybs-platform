import { EMPTY_BOOKING_PLACEMENT_FIELDS, isBookingSchemaError } from "@/lib/booking-schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";

const SCHEDULE_PLACEMENT_SELECT =
  "placement_preference, placement_details, access_issues, gate_instructions, delivery_presence, alternate_contact_name, alternate_contact_phone, placement_photo_url, special_delivery_instructions";

const SCHEDULE_JOB_SELECT = `
        id,
        booking_ref,
        customer_first_name,
        customer_last_name,
        customer_street,
        customer_city,
        customer_zip,
        delivery_date,
        pickup_date,
        pickup_mode,
        dumpster_id,
        dumpster_size,
        assigned_dumpster:dumpster_id(display_name, equipment_id),
        status,
        notes,
        created_at,
        ${SCHEDULE_PLACEMENT_SELECT}
        `;

const BASE_SCHEDULE_JOB_SELECT = `
        id,
        booking_ref,
        customer_first_name,
        customer_last_name,
        customer_street,
        customer_city,
        customer_zip,
        delivery_date,
        pickup_date,
        pickup_mode,
        dumpster_id,
        dumpster_size,
        assigned_dumpster:dumpster_id(display_name, equipment_id),
        status,
        notes,
        created_at
        `;

type ScheduleQueryError = { message?: string | null };
type ScheduleQueryResult = {
  data: Record<string, unknown>[] | null;
  error: ScheduleQueryError | null;
};

export async function getScheduleJobs(weekStartISO: string, weekEndISO: string) {
  const tenant = await getCurrentTenant();
  const buildQuery = (selectClause: string) =>
    supabaseAdmin
      .from("bookings")
      .select(selectClause)
      .eq("business_id", tenant.id)
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
      ...((row as unknown as Record<string, unknown>) ?? {}),
      dumpster_id: null,
      dumpster_size: null,
      assigned_dumpster: null,
      ...EMPTY_BOOKING_PLACEMENT_FIELDS,
    }));
  }

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

async function getScheduleRows(
  buildQuery: (selectClause: string) => PromiseLike<unknown>,
) {
  const { data, error } = (await buildQuery(SCHEDULE_JOB_SELECT)) as ScheduleQueryResult;

  if (error && isBookingSchemaError(error)) {
    const fallback = (await buildQuery(BASE_SCHEDULE_JOB_SELECT)) as ScheduleQueryResult;
    if (fallback.error) {
      throw new Error(fallback.error.message ?? "Failed to load schedule jobs.");
    }

    return (fallback.data ?? []).map((row) => ({
      ...((row as unknown as Record<string, unknown>) ?? {}),
      dumpster_id: null,
      dumpster_size: null,
      assigned_dumpster: null,
      ...EMPTY_BOOKING_PLACEMENT_FIELDS,
    }));
  }

  if (error) {
    throw new Error(error.message ?? "Failed to load schedule jobs.");
  }

  return data ?? [];
}

export async function getOverdueScheduleJobs(todayISO: string) {
  const tenant = await getCurrentTenant();
  const [overdueDeliveries, overduePickups] = await Promise.all([
    getScheduleRows((selectClause) =>
      supabaseAdmin
        .from("bookings")
        .select(selectClause)
        .eq("business_id", tenant.id)
        .in("status", ["confirmed", "scheduled"])
        .lt("delivery_date", todayISO)
        .order("delivery_date", { ascending: true }),
    ),
    getScheduleRows((selectClause) =>
      supabaseAdmin
        .from("bookings")
        .select(selectClause)
        .eq("business_id", tenant.id)
        .eq("status", "delivered")
        .lt("pickup_date", todayISO)
        .order("pickup_date", { ascending: true }),
    ),
  ]);

  return [...overdueDeliveries, ...overduePickups];
}
