import { getBookingSummaryContent } from "@/lib/tenant/content";
import SummaryStepPageClient from "./summary-step-page-client";

export default async function SummaryStepPage() {
  const content = await getBookingSummaryContent();

  return <SummaryStepPageClient content={content} />;
}
