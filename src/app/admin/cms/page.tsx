import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getRetailSiteCmsInitialState } from "@/lib/admin/cms";
import RetailSiteCmsEditor from "./retail-site/retail-site-cms-editor";

export default async function AdminCmsPage() {
  const cms = await getRetailSiteCmsInitialState();

  return (
    <AdminPage>
      <AdminPageHeader
        title="Retail Site Content"
        description="Manage retail-site content by page, save drafts safely, preview changes, and publish when ready."
      />

      <RetailSiteCmsEditor cms={cms} />
    </AdminPage>
  );
}
