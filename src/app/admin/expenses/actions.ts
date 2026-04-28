"use server";

import { revalidatePath } from "next/cache";
import {
  archiveExpenseForCurrentBusiness,
  createExpenseForCurrentBusiness,
  updateExpenseForCurrentBusiness,
  type ExpenseMutationResult,
} from "@/lib/admin/expenses.server";
import type { ExpenseMutationInput } from "@/lib/admin/expenses";

export async function createExpenseAction(input: ExpenseMutationInput): Promise<ExpenseMutationResult> {
  const result = await createExpenseForCurrentBusiness(input);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}

export async function updateExpenseAction(
  id: string,
  input: ExpenseMutationInput,
): Promise<ExpenseMutationResult> {
  const result = await updateExpenseForCurrentBusiness(id, input);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}

export async function archiveExpenseAction(id: string): Promise<ExpenseMutationResult> {
  const result = await archiveExpenseForCurrentBusiness(id);

  if (result.ok) {
    revalidatePath("/admin/expenses");
  }

  return result;
}
