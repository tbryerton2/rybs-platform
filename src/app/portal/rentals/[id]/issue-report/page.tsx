import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalRental } from "@/lib/portal/data";
import {
  getIssueCategoryLabel,
  getIssuePreferredContactMethodLabel,
  getIssueUrgencyLabel,
  sanitizeIssueReportDetails,
  validateIssueReportDetails,
} from "@/lib/rental-action-requests";
import { PortalShell } from "../../../_components/portal-shell";
import { submitPortalIssueReportAction } from "../actions";
import { IssueReportForm } from "./issue-report-form";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function queryString(input: Record<string, string>) {
  const params = new URLSearchParams();
  for (const [key, keyValue] of Object.entries(input)) {
    if (keyValue) params.set(key, keyValue);
  }
  const result = params.toString();
  return result ? `?${result}` : "";
}

export default async function PortalIssueReportPage({
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

  const { booking, issueReportEligibility } = rental;
  const step = readValue(resolvedSearchParams, "step");
  const submitted = readValue(resolvedSearchParams, "submitted") === "1";
  const error = readValue(resolvedSearchParams, "error");

  const details = sanitizeIssueReportDetails({
    issueCategory: readValue(resolvedSearchParams, "issueCategory") ?? null,
    urgency: readValue(resolvedSearchParams, "urgency") ?? null,
    description: readValue(resolvedSearchParams, "description") ?? "",
    preferredContactMethod: readValue(resolvedSearchParams, "preferredContactMethod") ?? null,
  });

  const validationError = validateIssueReportDetails(details);

  if (submitted) {
    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            Issue report received
          </div>
          <h2 className="mt-6 text-3xl font-semibold tracking-tight text-slate-900">
            Issue report received
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
            We&apos;ll review your report and update your rental page as soon as we have next steps.
          </p>
          <div className="mt-8">
            <Link
              href={`/portal/rentals/${booking.id}?submitted=issue`}
              className="inline-flex items-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Back to rental
            </Link>
          </div>
        </div>
      </PortalShell>
    );
  }

  if (!issueReportEligibility.eligible && step !== "review") {
    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-10 shadow-sm">
          <Link href={`/portal/rentals/${booking.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to rental
          </Link>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
            Issue reporting unavailable
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-500">
            {issueReportEligibility.reason ?? "This rental is not eligible for issue reporting."}
          </p>
        </div>
      </PortalShell>
    );
  }

  if (step === "review" && !validationError) {
    if (!issueReportEligibility.eligible) {
      return (
        <PortalShell pathname={`/portal/rentals/${booking.id}`}>
          <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-10 shadow-sm">
            <Link href={`/portal/rentals/${booking.id}`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
              ← Back to rental
            </Link>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
              Issue reporting unavailable
            </h2>
            <p className="mt-4 text-sm leading-7 text-slate-500">
              {issueReportEligibility.reason ?? "This rental is not eligible for issue reporting."}
            </p>
          </div>
        </PortalShell>
      );
    }

    return (
      <PortalShell pathname={`/portal/rentals/${booking.id}`}>
        <div className="mx-auto max-w-3xl rounded-[32px] border border-slate-200 bg-white px-6 py-8 shadow-sm">
          <Link href={`/portal/rentals/${booking.id}/issue-report`} className="text-sm font-medium text-slate-500 hover:text-slate-900">
            ← Back to form
          </Link>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-slate-900">
            Review issue report
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Confirm the details below before submitting your issue report.
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
                Issue type
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {getIssueCategoryLabel(details.issueCategory)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Urgency
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {getIssueUrgencyLabel(details.urgency)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Preferred contact
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900">
                {getIssuePreferredContactMethodLabel(details.preferredContactMethod)}
              </div>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-4 sm:col-span-2">
              <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-900 whitespace-pre-wrap">
                {details.description}
              </div>
            </div>
          </div>

          <form action={submitPortalIssueReportAction} className="mt-8 flex flex-col gap-3 sm:flex-row">
            <input type="hidden" name="booking_id" value={booking.id} />
            <input type="hidden" name="issue_category" value={details.issueCategory ?? ""} />
            <input type="hidden" name="urgency" value={details.urgency ?? ""} />
            <input type="hidden" name="description" value={details.description} />
            <input type="hidden" name="preferred_contact_method" value={details.preferredContactMethod ?? ""} />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              Submit issue report
            </button>
            <Link
              href={`/portal/rentals/${booking.id}/issue-report${queryString({
                issueCategory: details.issueCategory ?? "",
                urgency: details.urgency ?? "",
                description: details.description,
                preferredContactMethod: details.preferredContactMethod ?? "",
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
          Report an issue
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-500">
          Tell us what&apos;s wrong and our team will review it.
        </p>

        {error ? (
          <div className="mt-6 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
            {error}
          </div>
        ) : null}

        <div className="mt-6 rounded-3xl border border-orange-100 bg-orange-50/70 px-5 py-4 text-sm leading-6 text-slate-600">
          Use this form for service or rental issues that need a team response. If something is urgent today, choose that urgency so we can triage it correctly.
        </div>

        <IssueReportForm
          bookingId={booking.id}
          defaultIssueCategory={details.issueCategory ?? ""}
          defaultUrgency={details.urgency ?? ""}
          defaultDescription={details.description}
          defaultPreferredContactMethod={details.preferredContactMethod ?? ""}
          action={submitPortalIssueReportAction}
        />
      </div>
    </PortalShell>
  );
}
