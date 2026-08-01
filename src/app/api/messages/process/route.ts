import { NextResponse } from "next/server";
import { processQueuedBookingMessages } from "@/lib/messages/process-booking-messages";

export async function POST() {
  const result = await processQueuedBookingMessages();
  return NextResponse.json(
    result.ok ? { ok: true, processed: result.processed } : { ok: false, error: result.error },
    { status: result.status ?? 200 },
  );
}
