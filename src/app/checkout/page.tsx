import { getBookingCheckoutContent } from "@/lib/tenant/content";
import CheckoutPageClient from "./checkout-page-client";

export default async function CheckoutPage() {
  const content = await getBookingCheckoutContent();

  return <CheckoutPageClient content={content} />;
}
