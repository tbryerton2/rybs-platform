export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import type { EmployeeRecord } from "@/lib/admin/employees";
import { listEmployeesForCurrentBusiness } from "@/lib/admin/employees.server";
import { EmployeesClient } from "./employees-client";

export default async function AdminEmployeesPage() {
  let employees: EmployeeRecord[] = [];
  let loadError: string | null = null;

  try {
    employees = await listEmployeesForCurrentBusiness({ includeInactive: true });
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load employees.";
  }

  return (
    <AdminPage width="wide">
      <AdminPageHeader
        title="Employees"
        description="Manage business-owned employee records with soft deactivation and future account-link readiness."
      />

      <EmployeesClient initialEmployees={employees} loadError={loadError} />
    </AdminPage>
  );
}
