export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
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
        actions={
          <Link
            href="/admin/employees/new"
            className="admin-btn admin-btn-primary h-11 gap-2 px-5"
          >
            <PlusIcon className="h-4 w-4" />
            Add employee
          </Link>
        }
      />

      <EmployeesClient initialEmployees={employees} loadError={loadError} />
    </AdminPage>
  );
}
