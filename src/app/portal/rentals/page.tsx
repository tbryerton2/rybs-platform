import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalBookings } from "@/lib/portal/data";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";
import { RentalHistoryClient } from "./rental-history-client";

export default async function PortalRentalsPage() {
  const customer = await requirePortalCustomer();
  const bookings = await getPortalBookings(customer.id);

  return (
    <PortalShell pathname="/portal/rentals">
      <div className="space-y-6">
        <PortalSubpageHeader
          title="All bookings"
          description="Browse every rental linked to your portal account, reopen the details you need, and book again from completed jobs when it makes sense."
          meta={
            <span className="rounded-full bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700 ring-1 ring-rose-200">
              {bookings.length} total
            </span>
          }
        />

        <RentalHistoryClient bookings={bookings} />
      </div>
    </PortalShell>
  );
}
