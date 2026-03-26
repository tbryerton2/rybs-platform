import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalBookings } from "@/lib/portal/data";
import { listSavedServiceLocations } from "@/lib/service-locations";
import { PortalShell } from "../_components/portal-shell";
import { SavedLocationsManager } from "./saved-locations-manager";

export default async function PortalLocationsPage() {
  const customer = await requirePortalCustomer();
  const [locations, bookings] = await Promise.all([
    listSavedServiceLocations(customer.id),
    getPortalBookings(customer.id),
  ]);

  const suggestedLocation =
    bookings.find(
      (booking) =>
        booking.customer_street?.trim() &&
        booking.customer_city?.trim() &&
        booking.customer_state?.trim() &&
        booking.customer_zip?.trim(),
    ) ?? null;

  return (
    <PortalShell pathname="/portal/locations">
      <SavedLocationsManager
        initialLocations={locations}
        suggestedLocation={
          suggestedLocation
            ? {
                label: "Recent booking address",
                street: suggestedLocation.customer_street!,
                city: suggestedLocation.customer_city!,
                state: suggestedLocation.customer_state!,
                zip: suggestedLocation.customer_zip!,
                note: "Used on your most recent booking.",
              }
            : null
        }
      />
    </PortalShell>
  );
}
