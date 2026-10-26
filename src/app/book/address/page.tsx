import { Suspense } from "react";
import { BookingNavigationGuard } from "@/components/booking/booking-navigation-guard";
import { getBookingAddressContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";
import AddressStepPageClient from "./address-step-page-client";

export default async function AddressStepPage() {
  const tenant = await getCurrentTenant();
  const content = await getBookingAddressContent({ tenantId: tenant.id });

  return (
    <Suspense fallback={null}>
      <BookingNavigationGuard>
        <AddressStepPageClient content={content} />
      </BookingNavigationGuard>
    </Suspense>
  );
}
