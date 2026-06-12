export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  getFleetEquipmentInspectionStatusMap,
  getFleetEquipmentMaintenanceAttentionIds,
  listFleetEquipment,
} from "./data";
import { TrucksTrailersListClient } from "./trucks-trailers-list-client";

type PageProps = {
  searchParams?: Promise<{ saved?: string; filter?: string }>;
};

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "created":
      return "Truck or trailer created.";
    default:
      return null;
  }
}

export default async function AdminTrucksTrailersPage({ searchParams }: PageProps) {
  const adminSession = await requireAdminOwner();
  let records: Awaited<ReturnType<typeof listFleetEquipment>> = [];
  let maintenanceAttentionIds: string[] = [];
  let inspectionStatusById: Record<string, "Current" | "Due soon" | "Expired" | "Not set"> = {};
  let loadError: string | null = null;
  const { saved, filter } = (await searchParams) ?? {};
  const initialFilter = filter === "active" || filter === "tracker" || filter === "maintenance" ? filter : "all";

  try {
    [records, maintenanceAttentionIds, inspectionStatusById] = await Promise.all([
      listFleetEquipment(adminSession.business.id),
      getFleetEquipmentMaintenanceAttentionIds(adminSession.business.id),
      getFleetEquipmentInspectionStatusMap(adminSession.business.id),
    ]);
  } catch (error) {
    loadError = error instanceof Error ? error.message : "Unable to load fleet equipment right now.";
  }

  return (
    <AdminPage width="wide">
      <AdminToastTrigger success={getSavedMessage(saved)} trigger={saved} clearParam="saved" />
      <AdminPageHeader
        title="Trucks & Trailers"
        actions={(
          <Link
            href="/admin/trucks-trailers/new"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            <PlusIcon className="h-4 w-4" />
            Add truck or trailer
          </Link>
        )}
      />
      <TrucksTrailersListClient
        initialRecords={records}
        initialMaintenanceAttentionIds={maintenanceAttentionIds}
        initialInspectionStatusById={inspectionStatusById}
        initialSummaryFilter={initialFilter}
        loadError={loadError}
      />
    </AdminPage>
  );
}
