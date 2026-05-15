import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { InteractiveInfoPopover } from "@/app/admin/customers/[id]/interactive-info-popover";
import { getRetailSiteCmsInitialState } from "@/lib/admin/cms";
import RetailSiteCmsEditor from "./retail-site/retail-site-cms-editor";

export default async function AdminCmsPage() {
  const cms = await getRetailSiteCmsInitialState();

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
