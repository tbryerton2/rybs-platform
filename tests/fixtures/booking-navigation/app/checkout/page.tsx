import { BookingNavigationGuard } from "@/components/booking/booking-navigation-guard";
import { Checkout } from "../test-client";
export default function Page() { return <BookingNavigationGuard><Checkout /></BookingNavigationGuard>; }
