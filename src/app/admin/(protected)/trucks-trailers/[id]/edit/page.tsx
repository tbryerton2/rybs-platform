export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { requireAdminOwner } from "@/lib/admin/auth";
import {
  getFleetEquipmentDetailById,
  getFleetEquipmentServiceDates,
} from "../../data";
import { FleetEquipmentDetailClient } from "../../fleet-equipment-detail-client";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditFleetEquipmentPage({ params }: PageProps) {
  const { id } = await params;
  const adminSession = await requireAdminOwner();
  const [record, serviceDates] = await Promise.all([
    getFleetEquipmentDetailById(id, adminSession.business.id),
    getFleetEquipmentServiceDates(id, adminSession.business.id),
  ]);

  if (!record) notFound();

  return (
    <AdminPage width="wide" className="space-y-6">
      <div>
        <Link href={`/admin/trucks-trailers/${id}`} className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to truck or trailer
        </Link>
      </div>

      <AdminPageHeader title={`Edit ${record.name || "truck or trailer"}`} />

      <FleetEquipmentDetailClient
        mode="edit"
        initialRecord={record}
        initialServiceDates={serviceDates}
        cancelHref={`/admin/trucks-trailers/${id}`}
      />
    </AdminPage>
  );
}
