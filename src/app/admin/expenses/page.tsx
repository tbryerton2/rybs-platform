export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import type { ExpenseRecord } from "@/lib/admin/expenses";
import { listExpensesForCurrentBusiness } from "@/lib/admin/expenses.server";
import { ExpensesClient } from "./expenses-client";

export default async function AdminExpensesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  let expenses: ExpenseRecord[] = [];
  let loadError: string | null = null;
  const resolvedSearchParams = (await searchParams) ?? {};
  const initialStatusFilter =
    resolvedSearchParams.status === "Paid" ||
    resolvedSearchParams.status === "Scheduled" ||
    resolvedSearchParams.status === "Outstanding"
      ? resolvedSearchParams.status
      : "All";

  try {
    expenses = await listExpensesForCurrentBusiness();
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load expenses.";
  }

  return (
    <AdminPage width="wide">
      <ExpensesClient
        initialExpenses={expenses}
        initialStatusFilter={initialStatusFilter}
        loadError={loadError}
      />
    </AdminPage>
  );
}
