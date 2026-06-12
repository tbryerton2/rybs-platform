export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { DumpsterDetailClient } from "../dumpster-detail-client";
import { getNextDumpsterEquipmentId } from "../data";

export default async function AdminNewDumpsterPage() {
  const adminSession = await requireAdminOwner();
  const nextEquipmentId = await getNextDumpsterEquipmentId(adminSession.business.id);

  return (
    <AdminPage className="space-y-6 py-8" width="wide">
      <div>
        <Link
          href="/admin/equipment/dumpsters"
          className="text-sm font-medium text-slate-600 transition hover:text-slate-900"
        >
          ← Back to dumpsters
        </Link>
      </div>

      <AdminPageHeader title="Add Dumpster" />

      <DumpsterDetailClient initialDumpster={null} initialMode="create" initialEquipmentId={nextEquipmentId} />
    </AdminPage>
  );
}
