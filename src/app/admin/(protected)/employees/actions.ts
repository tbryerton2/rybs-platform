"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  createEmployeeForCurrentBusiness,
  deactivateEmployeeForCurrentBusiness,
  reactivateEmployeeForCurrentBusiness,
  updateEmployeeForCurrentBusiness,
  type EmployeeMutationResult,
} from "@/lib/admin/employees.server";
import type { EmployeeMutationInput } from "@/lib/admin/employees";

export async function createEmployeeAction(input: EmployeeMutationInput): Promise<EmployeeMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await createEmployeeForCurrentBusiness(adminSession.business.id, input);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath("/admin/employees/new");
    revalidatePath(`/admin/employees/${result.employee.id}`);
  }

  return result;
}

export async function updateEmployeeAction(
  id: string,
  input: EmployeeMutationInput,
): Promise<EmployeeMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await updateEmployeeForCurrentBusiness(adminSession.business.id, id, input);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}

export async function deactivateEmployeeAction(id: string): Promise<EmployeeMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await deactivateEmployeeForCurrentBusiness(adminSession.business.id, id);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}

export async function reactivateEmployeeAction(id: string): Promise<EmployeeMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await reactivateEmployeeForCurrentBusiness(adminSession.business.id, id);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}
