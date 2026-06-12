export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getDumpsters } from "./data";
import { DumpstersClient } from "./dumpsters-client";

type PageProps = {
  searchParams?: Promise<{ deleted?: string; filter?: string }>;
};

export default async function AdminDumpstersPage({ searchParams }: PageProps) {
  const adminSession = await requireAdminOwner();
  const dumpsters = await getDumpsters(adminSession.business.id);
  const resolvedSearchParams = (await searchParams) ?? {};
  const deleted = resolvedSearchParams.deleted;
  const initialFilter = resolvedSearchParams.filter === "active" || resolvedSearchParams.filter === "tracker" || resolvedSearchParams.filter === "maintenance"
    ? resolvedSearchParams.filter
    : null;

  return (
    <AdminPage width="wide">
      <AdminToastTrigger
        success={deleted ? "Dumpster deleted." : null}
        trigger={deleted}
        clearParam="deleted"
      />
      <DumpstersClient initialDumpsters={dumpsters} initialSummaryFilter={initialFilter} />
    </AdminPage>
  );
}
