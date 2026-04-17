import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { TrucksTrailersClient } from "./trucks-trailers-client";

export default function AdminTrucksTrailersPage() {
  return (
    <AdminPage width="wide">
      <AdminPageHeader title="Trucks & Trailers" description="Manage fleet units, compliance dates, maintenance readiness, and tracker status." />
      <TrucksTrailersClient />
    </AdminPage>
  );
}
