import { ArrowLeftIcon } from "@heroicons/react/24/outline";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getPlatformTenantDetail } from "@/lib/platform-admin/tenants";
import { EditBusinessForm } from "./edit-business-form";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  params: Promise<{ tenantId: string }>;
};

export default async function EditPlatformBusinessPage({ params }: PageProps) {
  const { tenantId } = await params;
  const detail = await getPlatformTenantDetail(tenantId);

  if (!detail) {
    notFound();
  }

  const { tenant } = detail;

  return (
    <AdminPage width="standard" className="space-y-6 pt-2">
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
        eyebrow="Business"
        title="Edit business"
        description="Update only the business display name and slug. Lifecycle status is managed separately."
      />

      <section className="rounded-[14px] border border-slate-200 bg-white p-5 shadow-sm">
        <EditBusinessForm
          tenantId={tenant.id}
          businessName={tenant.name ?? tenant.displayName}
          slug={tenant.slug}
          status={tenant.status}
          updatedAt={tenant.updatedAt}
        />
      </section>
    </AdminPage>
  );
}
