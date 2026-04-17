import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { EmployeesClient } from "./employees-client";

export default function AdminEmployeesPage() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Employees" />

      <EmployeesClient />
    </AdminPage>
  );
}
