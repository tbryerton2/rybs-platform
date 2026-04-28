export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { ExpenseDetailClient } from "../expense-detail-client";

export default function NewExpensePage() {
  return (
    <AdminPage width="wide" className="space-y-6">
      <div>
        <Link href="/admin/expenses" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to expenses
        </Link>
      </div>

      <ExpenseDetailClient mode="create" />
    </AdminPage>
  );
}
