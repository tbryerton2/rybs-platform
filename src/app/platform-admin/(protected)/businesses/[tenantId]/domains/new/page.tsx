import { ArrowLeftIcon, PlusIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormSubmitButton } from "@/app/admin/_components/admin/form-submit-button";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { createDomainAction } from "@/app/platform-admin/(protected)/businesses/actions";
import { PLATFORM_DOMAIN_TYPES } from "@/lib/platform-admin/domains";
import { getPlatformTenantDetail } from "@/lib/platform-admin/tenants";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

const DOMAIN_TYPE_HELP: Record<(typeof PLATFORM_DOMAIN_TYPES)[number], string> = {
  platform_subdomain: "Hostname we provide",
  custom_domain: "Customer-owned domain",
  booking_domain: "Dedicated booking hostname for customers with an existing website",
};

const DOMAIN_TYPE_LABEL: Record<(typeof PLATFORM_DOMAIN_TYPES)[number], string> = {
  platform_subdomain: "Platform subdomain",
  custom_domain: "Custom domain",
  booking_domain: "Booking domain",
};

export default async function NewPlatformBusinessDomainPage({ params }: PageProps) {
  const { tenantId } = await params;
  const detail = await getPlatformTenantDetail(tenantId);

  if (!detail) {
    notFound();
  }

  const { tenant } = detail;

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
        title="Add domain"
        description="Add a pending hostname mapping and start Vercel provisioning."
      />

      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <form action={createDomainAction} className="space-y-5">
          <input type="hidden" name="tenantId" value={tenant.id} />
          <input type="hidden" name="status" value="pending" />

          <div>
            <label htmlFor="hostname" className="text-sm font-semibold text-slate-700">
              Hostname
            </label>
            <input
              id="hostname"
              name="hostname"
              type="text"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              placeholder="demo.yoursaas.com"
              className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 px-3 font-mono text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              required
            />
            <p className="mt-2 text-xs leading-5 text-slate-500">
              Enter only the hostname. Protocols, paths, ports, and localhost development names are rejected.
            </p>
          </div>

          <div>
            <div>
              <label htmlFor="domainType" className="text-sm font-semibold text-slate-700">
                Domain type
              </label>
              <select
                id="domainType"
                name="domainType"
                defaultValue="platform_subdomain"
                className="mt-2 block h-11 w-full rounded-[8px] border border-slate-300 bg-white px-3 text-sm text-slate-900 shadow-sm outline-none transition focus:border-orange-500 focus:ring-2 focus:ring-orange-100"
              >
                {PLATFORM_DOMAIN_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {DOMAIN_TYPE_LABEL[type]}
                  </option>
                ))}
              </select>
              <div className="mt-2 space-y-1 text-xs leading-5 text-slate-500">
                {PLATFORM_DOMAIN_TYPES.map((type) => (
                  <div key={type}>
                    <span className="font-semibold text-slate-600">{DOMAIN_TYPE_LABEL[type]}</span>: {DOMAIN_TYPE_HELP[type]}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <FormSubmitButton loadingLabel="Adding...">
              <PlusIcon className="h-4 w-4" />
              Add domain
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
