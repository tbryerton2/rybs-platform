export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getRetailSiteSettingsForTenant } from "@/lib/tenant/retail-site-settings";
import { RetailSiteSettingsEditor } from "./retail-site-settings-editor";

export default async function AdminRetailSiteSettingsPage() {
  const adminSession = await requireAdminOwner();
  const settings = await getRetailSiteSettingsForTenant(adminSession.business);

  return (
    <AdminPage>
      <AdminPageHeader
        title="Settings"
        description="Control header behavior, section visibility, and blocked delivery dates."
      />

      <RetailSiteSettingsEditor initialSettings={settings} />
    </AdminPage>
  );
}
