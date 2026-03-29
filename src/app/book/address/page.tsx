import { getBookingAddressContent } from "@/lib/tenant/content";
import AddressStepPageClient from "./address-step-page-client";

export default async function AddressStepPage() {
  const content = await getBookingAddressContent();

  return <AddressStepPageClient content={content} />;
}
