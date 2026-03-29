import { getBookingPickupContent } from "@/lib/tenant/content";
import PickupStepPageClient from "./pickup-step-page-client";

export default async function PickupStepPage() {
  const content = await getBookingPickupContent();

  return <PickupStepPageClient content={content} />;
}
