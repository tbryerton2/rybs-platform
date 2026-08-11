import { formatEnumLabel } from "@/lib/admin/enum-label";

export type CoreBookingStatus =
  | "confirmed"
  | "scheduled"
  | "delivered"
  | "picked_up"
  | "cancelled"
  | "paid";

export function formatBookingStatusLabel(status: string | null | undefined) {
  return formatEnumLabel(status);
}
