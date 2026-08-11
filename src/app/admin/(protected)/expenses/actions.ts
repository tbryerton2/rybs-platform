"use server";

import { revalidatePath } from "next/cache";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  archiveExpenseForCurrentBusiness,
  createExpenseForCurrentBusiness,
  updateExpenseForCurrentBusiness,
  type ExpenseMutationResult,
} from "@/lib/admin/expenses.server";
import type { ExpenseMutationInput } from "@/lib/admin/expenses";

export async function createExpenseAction(input: ExpenseMutationInput): Promise<ExpenseMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await createExpenseForCurrentBusiness(adminSession.business.id, input);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseMutationInput,
): Promise<ExpenseMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await updateExpenseForCurrentBusiness(adminSession.business.id, id, input);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}

export async function archiveExpenseAction(id: string): Promise<ExpenseMutationResult> {
  const adminSession = await requireAdminOwner();

  const result = await archiveExpenseForCurrentBusiness(adminSession.business.id, id);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}
