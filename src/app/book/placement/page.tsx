import { getBookingPlacementContent } from "@/lib/tenant/content";
import PlacementStepPageClient from "./placement-step-page-client";

export default async function PlacementStepPage() {
  const content = await getBookingPlacementContent();

  return <PlacementStepPageClient content={content} />;
}
