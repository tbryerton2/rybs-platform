import { BookingNavigationGuard } from "@/components/booking/booking-navigation-guard";
import { Address } from "../../test-client";
export default function Page() { return <BookingNavigationGuard><Address /></BookingNavigationGuard>; }
