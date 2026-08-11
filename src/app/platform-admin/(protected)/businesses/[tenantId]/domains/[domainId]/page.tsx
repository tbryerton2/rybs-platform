import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { updateDomainAction } from "@/app/platform-admin/(protected)/businesses/actions";
import {
  PLATFORM_DOMAIN_STATUSES,
  PLATFORM_DOMAIN_TYPES,
} from "@/lib/platform-admin/domains";
import { getPlatformTenantDetail } from "@/lib/platform-admin/tenants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ tenantId: string; domainId: string }>;
};

const DOMAIN_TYPE_LABEL: Record<(typeof PLATFORM_DOMAIN_TYPES)[number], string> = {
  platform_subdomain: "Platform subdomain",
  custom_domain: "Custom domain",
  booking_domain: "Booking domain",
};

export default async function EditPlatformBusinessDomainPage({ params }: PageProps) {
  const { tenantId, domainId } = await params;
  const detail = await getPlatformTenantDetail(tenantId);

  if (!detail) {
    notFound();
  }

  const { tenant, domains } = detail;
  const domain = domains.find((item) => item.id === domainId);

  if (!domain) {
    notFound();
  }

  return (
    <AdminPage width="wide" className="space-y-6 pt-2">
      <div>
        <Link
          href={`/platform-admin/businesses/${tenant.id}`}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to {tenant.displayName}
        </Link>
      </div>

      <AdminPageHeader
        eyebrow="Public domain"
        title={domain.hostname}
        description="Edit type, status, and primary designation. Hostnames are immutable; add a new mapping to change one."
      />

      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <form action={updateDomainAction} className="space-y-5">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="domainId" value={domain.id} />

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Hostname</div>
            <div className="mt-1 break-all font-mono text-sm font-semibold text-slate-900">
              {domain.hostname}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="domainType" className="text-sm font-semibold text-slate-700">
                Domain type
              </label>
              <select
                id="domainType"
                name="domainType"
                defaultValue={domain.domainType}
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                {PLATFORM_DOMAIN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOMAIN_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="status" className="text-sm font-semibold text-slate-700">
                Status
              </label>
              <select
                id="status"
                name="status"
                defaultValue={domain.status}
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                {PLATFORM_DOMAIN_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs leading-5 text-slate-500">
                Pending and disabled mappings do not resolve publicly.
              </p>
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
            <input
              name="isPrimary"
              type="checkbox"
              defaultChecked={domain.isPrimary}
              className="h-4 w-4 rounded border-slate-300"
            />
            Primary domain
          </label>
          <p className="text-xs leading-5 text-slate-500">
            Only active domains can be primary. Marking this primary atomically clears the previous primary for this business.
          </p>

          <div className="flex flex-wrap gap-3">
            <FormSubmitButton loadingLabel="Saving...">
              Save domain
            </FormSubmitButton>
            <Link href={`/platform-admin/businesses/${tenant.id}`} className="admin-btn admin-btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </section>
    </AdminPage>
  );
}
