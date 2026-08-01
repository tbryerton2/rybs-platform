export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminAuditHistoryCard } from "@/app/admin/_components/admin/admin-audit-history-card";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { formatTimestamp } from "@/lib/admin/employees";
import { getEmployeeForCurrentBusiness } from "@/lib/admin/employees.server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { EmployeeDetailClient } from "../employee-detail-client";

type PageProps = {
  params: Promise<{ employeeId: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

type HistoryRow = {
  id: string;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by_type: string | null;
  created_at: string;
};

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "created":
      return "Employee created.";
    case "updated":
      return "Employee updated.";
    case "deactivated":
      return "Employee moved to inactive.";
    case "reactivated":
      return "Employee reactivated.";
    default:
      return null;
  }
}

function getHistoryTitle(fieldName: string) {
  if (fieldName === "__created__") {
    return "Employee record created";
  }

  return fieldName
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export default async function EmployeeDetailPage({ params, searchParams }: PageProps) {
  const adminSession = await requireAdminOwner();
  const { employeeId } = await params;
  const { saved } = (await searchParams) ?? {};
  const [employee, historyResult] = await Promise.all([
    getEmployeeForCurrentBusiness(employeeId),
    supabaseAdmin
      .from("entity_history")
      .select("id, field_name, old_value, new_value, changed_by_type, created_at")
      .eq("business_id", adminSession.business.id)
      .eq("entity_type", "employee")
      .eq("entity_id", employeeId)
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  if (!employee) {
    notFound();
  }

  if (historyResult.error) {
    throw new Error(historyResult.error.message);
  }

  const history = (historyResult.data ?? []) as HistoryRow[];
  const savedMessage = getSavedMessage(saved);

  return (
    <AdminPage width="wide" className="space-y-6">
      <AdminToastTrigger success={savedMessage} trigger={saved} clearParam="saved" />

      <div>
        <Link href="/admin/employees" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to employees
        </Link>
      </div>

      <EmployeeDetailClient mode="edit" initialEmployee={employee} />

      <section className="rounded-[20px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold tracking-tight text-slate-900">Recent activity</h2>
          <div className="text-sm text-slate-500">
            {history.length} {history.length === 1 ? "entry" : "entries"}
          </div>
        </div>

        {history.length === 0 ? (
          <div className="mt-5 rounded-[14px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-600">
            No employee history entries yet.
          </div>
        ) : (
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            {history.map((entry) => (
              <AdminAuditHistoryCard
                key={entry.id}
                title={getHistoryTitle(entry.field_name)}
                beforeValue={entry.old_value || "—"}
                afterValue={entry.new_value || "—"}
                changedAt={entry.created_at}
                changedBy={entry.changed_by_type}
                formatDateTime={formatTimestamp}
              />
            ))}
          </div>
        )}
      </section>
    </AdminPage>
  );
}
