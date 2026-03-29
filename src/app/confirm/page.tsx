import { getBookingConfirmContent } from "@/lib/tenant/content";
import ConfirmPageClient from "./confirm-page-client";

export default async function ConfirmPage() {
  const content = await getBookingConfirmContent();

  return <ConfirmPageClient content={content} />;
}
