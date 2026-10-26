import type { ReactNode } from "react";
import { Inspector } from "./test-client";
import { BookingEntryListener } from "@/components/booking/booking-entry-listener";

export default function Layout({ children }: { children: ReactNode }) {
  return <html data-tenant-storage-namespace="booking_browser_test"><body>
    <BookingEntryListener />
    <h1>Booking navigation browser regression</h1>
    <p>Local fixture. No bookings, payments, or external services are called.</p>
    {children}<Inspector />
  </body></html>;
}
