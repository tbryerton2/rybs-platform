import { getBookingConfirmContent } from "@/lib/tenant/content";
import ConfirmPageClient from "./confirm-page-client";

export default async function ConfirmPage({
  searchParams,
}: {
  searchParams?: Promise<{ preview?: string }>;
}) {
  const sp = await searchParams;
  const content = await getBookingConfirmContent({ preview: sp?.preview === "1" });

  return <ConfirmPageClient content={content} />;
}
