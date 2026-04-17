import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { ExpensesClient } from "./expenses-client";

export default function AdminExpensesPage() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Expenses" description="Review operating costs, payment status, and recent expense activity." />
      <ExpensesClient />
    </AdminPage>
  );
}
