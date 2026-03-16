import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const FLEET_SIZE = 3;

export async function getScheduleJobs(weekStartISO: string, weekEndISO: string) {
  const { data, error } = await supabaseAdmin
    .from("bookings")
    .select(`
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
        `)
    .in("status", ["confirmed", "scheduled", "delivered"])
    .lte("delivery_date", weekEndISO)
    .not("status", "eq", "cancelled")
    .or(`pickup_date.is.null,pickup_date.gte.${weekStartISO}`)
    .order("delivery_date", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}