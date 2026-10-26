import { getBookingConfirmContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";
import ConfirmPageClient from "./confirm-page-client";
import { BookingNavigationGuard } from "@/components/booking/booking-navigation-guard";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  const tenant = await getCurrentTenant();
  const content = await getBookingConfirmContent({
    preview: sp?.preview === "1",
    tenantId: tenant.id,
  });

  return (
    <BookingNavigationGuard>
      <ConfirmPageClient content={content} />
    </BookingNavigationGuard>
  );
}
