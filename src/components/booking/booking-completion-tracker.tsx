"use client";

import { useEffect } from "react";
import { completeBookingHistory } from "@/lib/booking-navigation";
import { getTenantStorageKey, TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";

export function BookingCompletionTracker({ bookingId }: { bookingId?: string }) {
  useEffect(() => {
    if (!bookingId) return;
    // Revisiting an older receipt must not close a new booking already in progress.
    try {
      if (sessionStorage.getItem(getTenantStorageKey(TENANT_STORAGE_KEYS.booking))) return;
    } catch {
      // Completion can still be remembered in memory when storage is unavailable.
    }
    completeBookingHistory(window, undefined, bookingId);
  }, [bookingId]);
  return null;
}
