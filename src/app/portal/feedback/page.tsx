import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";

export default async function PortalFeedbackPage() {
  const customer = await requirePortalCustomer();
  const { activeRentals, latestPastRental } = await getPortalDashboardData(customer.id);
  const feedbackRental = activeRentals[0] ?? latestPastRental;

  return (
    <PortalShell pathname="/portal/feedback">
      <div className="space-y-6">
        <PortalSubpageHeader
          title="Feedback"
          description="Feedback is secondary to active rental actions, but there is still a place for it in the portal."
          backHref={null}
        />

        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">Share something specific</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
            If your feedback is tied to a rental, use the rental itself so the team has the right context. This is especially important for service issues, timing problems, or anything that needs a response.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            {feedbackRental ? (
              <Link
                href={`/portal/rentals/${feedbackRental.id}`}
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Open a rental
              </Link>
            ) : (
              <Link
                href="/book"
                className="inline-flex items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
              >
                Start a booking
              </Link>
            )}
            <Link
              href="/portal/help"
              className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Help / Contact
            </Link>
          </div>
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 px-5 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Future improvement</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            The portal does not have a dedicated customer feedback submission flow yet. A small, purpose-built feedback form would be the right follow-up if you want this nav item to become more than a routing and guidance page.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
