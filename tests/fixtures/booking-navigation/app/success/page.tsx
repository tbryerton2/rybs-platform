import Link from "next/link";
import { BookingCompletionTracker } from "@/components/booking/booking-completion-tracker";
export default async function Page({ searchParams }: { searchParams: Promise<{bookingId?:string}> }) {
  return <><BookingCompletionTracker bookingId={(await searchParams).bookingId} />
    <h2>Booking confirmed</h2><Link href="/">Return home</Link></>;
}
