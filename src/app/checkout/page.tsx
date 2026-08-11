import { getBookingCheckoutContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";
import CheckoutPageClient from "./checkout-page-client";

export default async function CheckoutPage() {
  const tenant = await getCurrentTenant();
  const content = await getBookingCheckoutContent({ tenantId: tenant.id });

  return <CheckoutPageClient content={content} />;
}
