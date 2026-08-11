import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { InteractiveInfoPopover } from "@/app/admin/(protected)/customers/[id]/interactive-info-popover";
import { getRetailSiteCmsInitialStateForTenant } from "@/lib/admin/cms";
import { requireAdminOwner } from "@/lib/admin/auth";
import RetailSiteCmsEditor from "./retail-site/retail-site-cms-editor";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  const adminSession = await requireAdminOwner();
  const cms = await getRetailSiteCmsInitialStateForTenant(adminSession.business.id);

  return (
    <AdminPage>
      <AdminPageHeader
        title={
          <span className="inline-flex items-center gap-2">
            <span>Content Management</span>
            <InteractiveInfoPopover
              label="About Content Management"
              body="Manage retail-site content by page, save drafts safely, preview changes, and publish when ready."
            />
          </span>
        }
      />

      <RetailSiteCmsEditor cms={cms} />
    </AdminPage>
  );
}
