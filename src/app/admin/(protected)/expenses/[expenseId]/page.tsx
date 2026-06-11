export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { getExpenseForCurrentBusiness } from "@/lib/admin/expenses.server";
import { ExpenseDetailClient } from "../expense-detail-client";

type PageProps = {
  params: Promise<{ expenseId: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "created":
      return "Expense created.";
    case "updated":
      return "Expense updated.";
    default:
      return null;
  }
}

export default async function ExpenseDetailPage({ params, searchParams }: PageProps) {
  const { expenseId } = await params;
  const { saved } = (await searchParams) ?? {};
  const expense = await getExpenseForCurrentBusiness(expenseId);

  if (!expense) {
    notFound();
  }

  return (
    <AdminPage width="wide" className="space-y-6">
      <AdminToastTrigger success={getSavedMessage(saved)} trigger={saved} clearParam="saved" />

      <div>
        <Link href="/admin/expenses" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to expenses
        </Link>
      </div>

      <ExpenseDetailClient mode="edit" initialExpense={expense} />
    </AdminPage>
  );
}
