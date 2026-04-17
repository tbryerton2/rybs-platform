import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { DumpstersClient } from "./dumpsters-client";

export default function AdminDumpstersPage() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Dumpsters" description="Manage active container inventory, service readiness, and tracker coverage." />
      <DumpstersClient />
    </AdminPage>
  );
}
