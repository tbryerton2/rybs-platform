export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getRetailSiteSettings } from "@/lib/tenant/retail-site-settings";
import { RetailSiteSettingsEditor } from "./retail-site-settings-editor";

export default async function AdminRetailSiteSettingsPage() {
  const settings = await getRetailSiteSettings();

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
