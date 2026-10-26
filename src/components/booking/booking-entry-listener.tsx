"use client";

import { useEffect } from "react";
import { beginBookingHistory, hasCompletedBooking, isBookingStep } from "@/lib/booking-navigation";

/** Cover retail and portal links, including links rendered by server components. */
export function BookingEntryListener() {
  useEffect(() => {
    function onHistoryReturn() {
      if (isBookingStep(window.location.pathname) && hasCompletedBooking()) {
        // A full navigation also covers cached routes that Next.js restores without
        // remounting the page guard, including Back after refreshing confirmation.
        window.location.replace("/");
      }
    }
    function onBookingLink(event: MouseEvent) {
      if (event.button !== 0 && event.button !== 1) return;
      if (event.defaultPrevented || isBookingStep(window.location.pathname)) return;
      const link = event.target instanceof Element ? event.target.closest("a[href]") : null;
      if (!link || link.hasAttribute("download")) return;
      const destination = new URL(link.getAttribute("href")!, window.location.href);
      if (destination.origin === window.location.origin &&
          (destination.pathname === "/book" || destination.pathname.startsWith("/book/"))) {
        beginBookingHistory();
      }
    }
    // Capture runs before Next.js navigates or the browser copies session storage to a new tab.
    document.addEventListener("click", onBookingLink, true);
    document.addEventListener("auxclick", onBookingLink, true);
    window.addEventListener("popstate", onHistoryReturn, true);
    window.addEventListener("pageshow", onHistoryReturn);
    onHistoryReturn();
    return () => {
      document.removeEventListener("click", onBookingLink, true);
      document.removeEventListener("auxclick", onBookingLink, true);
      window.removeEventListener("popstate", onHistoryReturn, true);
      window.removeEventListener("pageshow", onHistoryReturn);
    };
  }, []);
  return null;
}
