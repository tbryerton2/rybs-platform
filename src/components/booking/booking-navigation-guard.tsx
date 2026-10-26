"use client";

import { useLayoutEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { enterBookingHistory } from "@/lib/booking-navigation";

export function BookingNavigationGuard({ children }: { children: ReactNode }) {
  const { bfcacheId } = useRouter();
  return <BookingHistoryEntry key={bfcacheId}>{children}</BookingHistoryEntry>;
}

function BookingHistoryEntry({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [allowed, setAllowed] = useState(false);

  useLayoutEffect(() => {
    function validate() {
      const canEnter = enterBookingHistory();
      setAllowed(canEnter);
      if (!canEnter) router.replace("/");
    }

    validate();
    // Also recheck pages restored from the browser's full-document back/forward cache.
    window.addEventListener("pageshow", validate);
    return () => {
      window.removeEventListener("pageshow", validate);
      // Next.js can preserve forms with Activity. Hide them until revalidated on return.
      setAllowed(false);
    };
  }, [router]);

  return allowed ? children : null;
}
