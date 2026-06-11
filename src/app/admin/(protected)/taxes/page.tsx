import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { TaxesClient } from "./taxes-client";

export default function AdminTaxesPage() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Taxes" description="Track high-level tax administration, filing reminders, and employee tax record status." />
      <TaxesClient />
    </AdminPage>
  );
}
