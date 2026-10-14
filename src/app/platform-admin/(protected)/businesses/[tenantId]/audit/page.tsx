import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import {
  listPlatformTenantPaymentSettingEvents,
  type PlatformTenantPaymentMode,
} from "@/lib/platform-admin/payment-settings";
import { getPlatformTenantDetail } from "@/lib/platform-admin/tenants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type AuditSection = "all" | "payments";

type PageProps = {
  params: Promise<{ tenantId: string }>;
  searchParams?: Promise<{
    section?: string;
  }>;
};

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function normalizeSection(value: string | undefined): AuditSection {
  return value === "payments" ? "payments" : "all";
}

function paymentModeLabel(mode: PlatformTenantPaymentMode) {
  return mode === "production"
    ? "Live"
    : mode.charAt(0).toUpperCase() + mode.slice(1);
}

function sectionHref(tenantId: string, section: AuditSection) {
  return section === "all"
    ? `/platform-admin/businesses/${tenantId}/audit`
    : `/platform-admin/businesses/${tenantId}/audit?section=${section}`;
}

export default async function PlatformBusinessAuditPage({ params, searchParams }: PageProps) {
  const { tenantId } = await params;
  const search = searchParams ? await searchParams : {};
  const activeSection = normalizeSection(search.section);
  const detail = await getPlatformTenantDetail(tenantId);

  if (!detail) {
    notFound();
  }

  const { tenant } = detail;
  const paymentEvents = await listPlatformTenantPaymentSettingEvents(tenant.id, "square");
  const auditEvents = paymentEvents.map((event) => ({
    id: event.id,
    section: "payments" as const,
    sectionLabel: "Payments",
    title: "Payment mode changed",
    detail: `${paymentModeLabel(event.previousMode)} to ${paymentModeLabel(event.newMode)}`,
    createdAt: event.createdAt,
    actor: event.actorPlatformAdminUserId,
  }));
  const visibleEvents = activeSection === "all"
    ? auditEvents
    : auditEvents.filter((event) => event.section === activeSection);

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <div>
        <Link
          href={`/platform-admin/businesses/${tenant.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to Business
        </Link>
      </div>

      <AdminPageHeader
        title="Audit log"
        description={`Change history for ${tenant.displayName}.`}
      />

      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-slate-900">Changes</h2>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Filter by section to review a focused audit trail.
            </p>
          </div>
          <div className="flex flex-wrap gap-2" aria-label="Audit section filters">
            {[
              { label: "All", value: "all" as const },
              { label: "Payments", value: "payments" as const },
            ].map((section) => (
              <Link
                key={section.value}
                href={sectionHref(tenant.id, section.value)}
                aria-current={activeSection === section.value ? "page" : undefined}
                className={joinClasses(
                  "inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset",
                  activeSection === section.value
                    ? "bg-slate-900 text-white ring-slate-900"
                    : "bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900",
                )}
              >
                {section.label}
              </Link>
            ))}
          </div>
        </div>

        {visibleEvents.length ? (
          <ol className="mt-5 divide-y divide-slate-100">
            {visibleEvents.map((event) => (
              <li key={event.id} className="grid gap-3 py-4 first:pt-0 last:pb-0 sm:grid-cols-[160px_minmax(0,1fr)]">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {formatDateTime(event.createdAt)}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-700 ring-1 ring-inset ring-sky-200">
                      {event.sectionLabel}
                    </span>
                    <h3 className="text-sm font-semibold text-slate-900">{event.title}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{event.detail}</p>
                  {event.actor ? (
                    <p className="mt-1 break-all text-xs text-slate-500">
                      Changed by {event.actor}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div className="mt-5 rounded-[8px] border border-dashed border-slate-300 px-4 py-6 text-sm text-slate-600">
            No audit events found for this filter.
          </div>
        )}
      </section>
    </AdminPage>
  );
}
