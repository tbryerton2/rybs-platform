export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { FleetEquipmentDetailClient } from "../fleet-equipment-detail-client";

export default function NewFleetEquipmentPage() {
  return (
    <AdminPage width="wide" className="space-y-6">
      <div>
        <Link href="/admin/trucks-trailers" className="text-sm font-medium text-slate-600 hover:text-slate-900">
          ← Back to trucks & trailers
        </Link>
      </div>

      <AdminPageHeader title="Add truck or trailer" />

      <FleetEquipmentDetailClient mode="create" initialServiceDates={[]} />
    </AdminPage>
  );
}
