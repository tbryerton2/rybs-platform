export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { createEmptyEmployee } from "@/lib/admin/employees";
import { getNextEmployeeCodeForCurrentBusiness } from "@/lib/admin/employees.server";
import { EmployeeDetailClient } from "../employee-detail-client";

export default async function NewEmployeePage() {
  const adminSession = await requireAdminOwner();
  const initialEmployee = createEmptyEmployee();
  initialEmployee.employeeId = await getNextEmployeeCodeForCurrentBusiness(adminSession.business.id);

  return (
    <AdminPage width="wide" className="space-y-6">
      <div>
        <Link href="/admin/employees" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to employees
        </Link>
      </div>

      <section className="space-y-2">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">New Employee</div>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Add employee
        </h1>
        <div className="text-sm text-slate-600">
          Create a business-scoped employee record that can later be linked to portal access if needed.
        </div>
      </section>

      <EmployeeDetailClient mode="create" initialEmployee={initialEmployee} />
    </AdminPage>
  );
}
