import { BuildingOffice2Icon, ShieldCheckIcon } from "@heroicons/react/24/outline";
import { Card } from "@/app/admin/_components/Card";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";

export default function PlatformAdminDashboardPage() {
  return (
    <AdminPage width="standard" className="pt-2">
      <AdminPageHeader
        eyebrow="Platform"
        title="Platform Admin"
        description="Manage businesses and platform access."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Business management"
          subtitle="Internal"
          actionHref="/platform-admin/businesses"
          actionLabel="Manage"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-sky-50 text-sky-600 ring-1 ring-sky-100">
              <BuildingOffice2Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-slate-600">
                Create businesses, review setup status, and manage active or inactive lifecycle state.
              </p>
            </div>
          </div>
        </Card>

        <Card
          title="Platform authorization"
          subtitle="Active owner or admin"
        >
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[8px] bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <ShieldCheckIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm leading-6 text-slate-600">
                Access is granted only by an active global platform membership.
              </p>
            </div>
          </div>
        </Card>
      </div>
    </AdminPage>
  );
}
