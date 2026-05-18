import { Suspense } from "react";
import { getBookingDateContent } from "@/lib/tenant/content";
import DateStepPageClient from "./date-step-page-client";

export default async function DateStepPage() {
  const content = await getBookingDateContent();

  return (
    <Suspense fallback={null}>
      <DateStepPageClient content={content} />
    </Suspense>
  );
}
