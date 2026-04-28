"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployeeForCurrentBusiness,
  deactivateEmployeeForCurrentBusiness,
  reactivateEmployeeForCurrentBusiness,
  updateEmployeeForCurrentBusiness,
  type EmployeeMutationResult,
} from "@/lib/admin/employees.server";
import type { EmployeeMutationInput } from "@/lib/admin/employees";

export async function createEmployeeAction(input: EmployeeMutationInput): Promise<EmployeeMutationResult> {
  const result = await createEmployeeForCurrentBusiness(input);

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
  const result = await updateEmployeeForCurrentBusiness(id, input);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}

export async function deactivateEmployeeAction(id: string): Promise<EmployeeMutationResult> {
  const result = await deactivateEmployeeForCurrentBusiness(id);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}

export async function reactivateEmployeeAction(id: string): Promise<EmployeeMutationResult> {
  const result = await reactivateEmployeeForCurrentBusiness(id);

  if (result.ok) {
    revalidatePath("/admin/employees");
    revalidatePath(`/admin/employees/${id}`);
  }

  return result;
}
