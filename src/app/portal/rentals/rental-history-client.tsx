"use client";

import { useDeferredValue, useMemo, useState } from "react";
import type { PortalBookingSummary } from "@/lib/portal/data";
import { getPortalRentalLabel } from "@/lib/portal/rental-number";
import { PortalBookingCard } from "../_components/portal-booking-card";

type SortOption = "newest" | "oldest";

function getSortableTimestamp(booking: PortalBookingSummary) {
  return (
    booking.delivery_date ??
    booking.created_at ??
    "1970-01-01T00:00:00.000Z"
  );
}

function matchesBookingSearch(booking: PortalBookingSummary, query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return true;

  const haystack = [
    getPortalRentalLabel(booking.booking_ref),
    booking.booking_ref,
    booking.customer_street,
    booking.customer_city,
    booking.customer_zip,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function RentalHistoryClient({ bookings }: { bookings: PortalBookingSummary[] }) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("newest");
  const deferredSearch = useDeferredValue(search);

  const filteredBookings = useMemo(() => {
    const nextBookings = bookings.filter((booking) => matchesBookingSearch(booking, deferredSearch));

    nextBookings.sort((left, right) => {
      const leftTimestamp = new Date(getSortableTimestamp(left)).getTime();
      const rightTimestamp = new Date(getSortableTimestamp(right)).getTime();
      return sort === "newest" ? rightTimestamp - leftTimestamp : leftTimestamp - rightTimestamp;
    });

    return nextBookings;
  }, [bookings, deferredSearch, sort]);

  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
            {filteredBookings.length} {filteredBookings.length === 1 ? "booking" : "bookings"}
          </span>
          {deferredSearch.trim() ? (
            <span className="text-xs font-medium text-slate-500">
              Showing matches for “{deferredSearch.trim()}”
            </span>
          ) : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:min-w-[260px]">
            <span className="sr-only">Search bookings</span>
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by address or rental number"
              className="w-full border-0 bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </label>

          <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            <span className="font-medium text-slate-500">Sort</span>
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortOption)}
              className="border-0 bg-transparent pr-6 font-semibold text-slate-900 outline-none"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </label>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {bookings.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
            No rentals are linked to this portal account yet. Once bookings are connected, they
            will appear here automatically.
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-sm leading-6 text-slate-500">
            No rentals match that search yet. Try a street name, ZIP code, or rental number.
          </div>
        ) : (
          filteredBookings.map((booking) => <PortalBookingCard key={booking.id} booking={booking} />)
        )}
      </div>
    </section>
  );
}
