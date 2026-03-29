import { getBookingDateContent } from "@/lib/tenant/content";
import DateStepPageClient from "./date-step-page-client";

export default async function DateStepPage() {
  const content = await getBookingDateContent();

  return <DateStepPageClient content={content} />;
}
