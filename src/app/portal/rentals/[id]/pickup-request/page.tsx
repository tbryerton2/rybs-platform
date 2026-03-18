import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalRental } from "@/lib/portal/data";
import {
  sanitizePickupRequestDetails,
  validatePickupRequestDetails,
} from "@/lib/rental-action-requests";
import { PortalShell } from "../../../_components/portal-shell";
import { submitPortalPickupRequestAction } from "../actions";
import { PickupRequestForm } from "./pickup-request-form";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00`));
}

function queryString(input: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, keyValue] of Object.entries(input)) {
    if (keyValue) params.set(key, keyValue);
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

function getMinPickupDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default async function PortalPickupRequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams?: Promise<SearchParams>;
}) {
  const customer = await requirePortalCustomer();
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const rental = await getPortalRental(customer.id, id);

  if (!rental) notFound();

  const { booking, pickupEligibility } = rental;
  const step = readValue(resolvedSearchParams, "step");
  const submitted = readValue(resolvedSearchParams, "submitted") === "1";
  const error = readValue(resolvedSearchParams, "error");

  const details = sanitizePickupRequestDetails({
    timingPreference: readValue(resolvedSearchParams, "timing") ?? "asap",
    requestedDate: readValue(resolvedSearchParams, "requestedDate") ?? null,
    accessConfirmed: readValue(resolvedSearchParams, "accessConfirmed") === "1",
    notes: readValue(resolvedSearchParams, "notes") ?? "",
  });

  const validationError = validatePickupRequestDetails(details);

  if (submitted) {
    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Pickup request received
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
            Pickup request received
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
            We&apos;ll review your request and confirm scheduling. You can track the status from your
            rental page.
          </p>
          <div className="mt-8">
            <Link
              href={`/portal/rentals/${booking.id}`}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to rental
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  if (!pickupEligibility.eligible && step !== "review") {
    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <Link href={`/portal/rentals/${booking.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to rental
          </Link>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
            Pickup request unavailable
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            {pickupEligibility.reason ?? "This rental is not currently eligible for pickup requests."}
          </p>
        </div>
      </PortalShell>
    );
  }

  if (step === "review" && !validationError) {
    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <Link href={`/portal/rentals/${booking.id}/pickup-request`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to form
          </Link>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
            Review pickup request
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Confirm the details below before submitting your pickup request.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Rental address
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {[booking.customer_street, booking.customer_city, booking.customer_zip]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Delivery date
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {formatDate(booking.delivery_date)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Pickup timing
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {details.timingPreference === "specific_date" ? "On a specific date" : "As soon as possible"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Requested pickup date
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {details.requestedDate ? formatDate(details.requestedDate) : "ASAP"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Access confirmed
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {details.accessConfirmed ? "Yes" : "No"}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Notes
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {details.notes || "No notes added"}
              </div>
            </div>
          </div>

          <form action={submitPortalPickupRequestAction} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="timing_preference" value={details.timingPreference} />
            <input type="hidden" name="requested_pickup_date" value={details.requestedDate ?? ""} />
            <input type="hidden" name="access_confirmed" value="on" />
            <input type="hidden" name="notes" value={details.notes ?? ""} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Submit pickup request
            </button>
            <Link
              href={`/portal/rentals/${booking.id}/pickup-request${queryString({
                timing: details.timingPreference,
                requestedDate: details.requestedDate ?? "",
                accessConfirmed: details.accessConfirmed ? "1" : "",
                notes: details.notes ?? "",
              })}`}
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Edit details
            </Link>
          </form>
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell pathname={`/portal/rentals/${booking.id}`}>
      <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
        <Link href={`/portal/rentals/${booking.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
          ← Back to rental
        </Link>
        <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
          Request pickup
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Tell us when you would like pickup and confirm the dumpster is accessible.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm leading-6 text-slate-600">
          Pickup timing is subject to scheduling availability. Please make sure the dumpster is
          accessible and not overfilled.
        </div>

        <PickupRequestForm
          bookingId={booking.id}
          defaultTimingPreference={details.timingPreference}
          defaultRequestedDate={details.requestedDate ?? ""}
          defaultAccessConfirmed={details.accessConfirmed}
          defaultNotes={details.notes ?? ""}
          minDate={getMinPickupDate()}
          action={submitPortalPickupRequestAction}
        />
      </div>
    </PortalShell>
  );
}
