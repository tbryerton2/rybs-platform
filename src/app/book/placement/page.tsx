import { getBookingPlacementContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";
import PlacementStepPageClient from "./placement-step-page-client";

export default async function PlacementStepPage() {
  const tenant = await getCurrentTenant();
  const content = await getBookingPlacementContent({ tenantId: tenant.id });

  return <PlacementStepPageClient content={content} />;
}
