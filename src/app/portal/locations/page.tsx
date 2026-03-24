import { requirePortalCustomer } from "@/lib/portal/auth";
import { listSavedServiceLocations } from "@/lib/service-locations";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";
import { SavedLocationsManager } from "./saved-locations-manager";

export default async function PortalLocationsPage() {
  const customer = await requirePortalCustomer();
  const locations = await listSavedServiceLocations(customer.id);

  return (
    <PortalShell pathname="/portal/locations">
      <div className="space-y-6">
        <PortalSubpageHeader
          title="Saved service locations"
          description="Save the places you book most often so future rentals start faster and delivery notes stay consistent."
          backHref={null}
        />

        <SavedLocationsManager initialLocations={locations} />
      </div>
    </PortalShell>
  );
}
