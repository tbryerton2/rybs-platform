export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import { formatEnumLabel } from "@/lib/admin/enum-label";
import { getFleetEquipmentDueSoonIndicator } from "@/lib/admin/fleet-equipment-service-dates";
import {
  getFleetEquipmentDetailById,
  getFleetEquipmentServiceDates,
} from "../data";
import { FleetEquipmentView } from "../fleet-equipment-view";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

function getSavedMessage(saved: string | undefined) {
  switch (saved) {
    case "updated":
      return "Truck or trailer updated.";
    default:
      return null;
  }
}

export default async function FleetEquipmentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const adminSession = await requireAdminOwner();
  const { saved } = (await searchParams) ?? {};
  const [record, serviceDates] = await Promise.all([
    getFleetEquipmentDetailById(id, adminSession.business.id),
    getFleetEquipmentServiceDates(id, adminSession.business.id),
  ]);
  const dueSoonIndicator = getFleetEquipmentDueSoonIndicator(serviceDates);

  if (!record) notFound();

  return (
    <AdminPage width="wide" className="space-y-6">
      <AdminToastTrigger success={getSavedMessage(saved)} trigger={saved} clearParam="saved" />

      <div>
        <Link href="/admin/trucks-trailers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to trucks & trailers
        </Link>
      </div>

      <AdminPageHeader
        title={record.name || "Truck or trailer details"}
        description={`${record.equipmentType === "truck" ? "Truck" : "Trailer"}${record.licensePlate ? ` • ${record.licensePlate}` : ""}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset",
                record.status === "active"
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : record.status === "maintenance"
                    ? "bg-amber-50 text-amber-700 ring-amber-200"
                    : "bg-slate-100 text-slate-600 ring-slate-200",
              ].join(" ")}
            >
              {formatEnumLabel(record.status)}
            </span>
            {dueSoonIndicator ? (
              <span className="inline-flex rounded-full bg-amber-50 px-4 py-1.5 text-sm font-semibold text-amber-700 ring-1 ring-inset ring-amber-200">
                {dueSoonIndicator}
              </span>
            ) : null}
          </div>
        }
      />
      <FleetEquipmentView record={record} serviceDates={serviceDates} />
    </AdminPage>
  );
}
