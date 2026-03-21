import { getCustomerFacingBookingLabel } from "@/lib/identity";

export function getPortalRentalLabel(bookingRef: string | null | undefined) {
  return `Rental ${getCustomerFacingBookingLabel(bookingRef)}`;
}
