import Link from "next/link";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";

function HelpCard({
  title,
  description,
  href,
  ctaLabel,
}: {
  title: string;
  description: string;
  href: string;
  ctaLabel: string;
}) {
  return (
    <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
      <div className="mt-4">
        <Link
          href={href}
          className="inline-flex items-center justify-center rounded-2xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          {ctaLabel}
        </Link>
      </div>
    </div>
  );
}

export default async function PortalHelpPage() {
  const customer = await requirePortalCustomer();
  const { activeRentals } = await getPortalDashboardData(customer.id);
  const activeRental = activeRentals[0] ?? null;

  return (
    <PortalShell pathname="/portal/help">
      <div className="space-y-6">
        <PortalSubpageHeader
          title="Help / Contact"
          description="Use the path that matches what you need. Current rental issues should go through the rental so the team sees the right context."
          backHref={null}
        />

        <div className="grid gap-4 lg:grid-cols-3">
          <HelpCard
            title="Current rental issue"
            description="Report a delivery, pickup, or on-site issue from the rental tied to it so the team sees the right booking details."
            href={activeRental ? `/portal/rentals/${activeRental.id}/issue-report` : "/portal/rentals"}
            ctaLabel={activeRental ? "Report an issue" : "Open rentals"}
          />
          <HelpCard
            title="Need pickup or more time"
            description="Use the rental actions built into your active booking instead of sending a generic message."
            href={activeRental ? `/portal/rentals/${activeRental.id}` : "/portal/rentals"}
            ctaLabel={activeRental ? "Open active rental" : "View rentals"}
          />
          <HelpCard
            title="Account or saved location help"
            description="Review your account details and saved service locations, then contact the team from your booking thread if something needs correction."
            href="/portal/account"
            ctaLabel="Open account"
          />
        </div>

        <div className="rounded-[26px] border border-slate-200 bg-slate-50/70 px-5 py-5">
          <h2 className="text-lg font-semibold text-slate-900">Best contact path right now</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            The fastest route is still the rental-specific action inside the portal. That keeps your request attached to the correct booking and avoids back-and-forth about address, dates, and service status.
          </p>
        </div>
      </div>
    </PortalShell>
  );
}
