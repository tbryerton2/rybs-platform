import { Suspense } from "react";
import { getBookingDateContent } from "@/lib/tenant/content";
import { getCurrentTenant } from "@/lib/tenant/server";
import DateStepPageClient from "./date-step-page-client";

export default async function DateStepPage() {
  const tenant = await getCurrentTenant();
  const content = await getBookingDateContent({ tenantId: tenant.id });

  return (
    <Suspense fallback={null}>
      <DateStepPageClient content={content} />
    </Suspense>
  );
}
