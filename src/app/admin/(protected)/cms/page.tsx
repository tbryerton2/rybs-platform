import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { InteractiveInfoPopover } from "@/app/admin/(protected)/customers/[id]/interactive-info-popover";
import { getRetailSiteCmsInitialStateForTenant } from "@/lib/admin/cms";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getTenantPublicBaseUrl } from "@/lib/tenant/communications";
import RetailSiteCmsEditor from "./retail-site/retail-site-cms-editor";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  const adminSession = await requireAdminOwner();
  const [cms, publicBaseUrl] = await Promise.all([
    getRetailSiteCmsInitialStateForTenant(adminSession.business.id),
    getTenantPublicBaseUrl(adminSession.business),
  ]);

  return (
    <AdminPage>
      <AdminPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>Pages</span>
            <InteractiveInfoPopover
              label="About Pages"
              body="Edit the text on each page of your booking website."
            />
          </span>
        }
      />

      <RetailSiteCmsEditor cms={cms} publicBaseUrl={publicBaseUrl} />
    </AdminPage>
  );
}
