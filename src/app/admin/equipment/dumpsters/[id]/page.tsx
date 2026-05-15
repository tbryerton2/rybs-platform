export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { getServiceWarningState } from "@/lib/admin/dumpster-service-warning";
import { formatInputDateET } from "@/lib/time";
import { DumpsterDetailClient } from "../dumpster-detail-client";
import { getDumpsterById, getDumpsterServiceDates } from "../data";
import {
  OperationalStatusPill,
  ServiceWarningPill,
} from "../operational-status-pill";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ mode?: string }>;
};

export default async function AdminDumpsterDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const todayYmd = formatInputDateET(new Date());
  const [dumpster, serviceDates] = await Promise.all([
    getDumpsterById(id),
    getDumpsterServiceDates(id),
  ]);
  const serviceWarningPill = getServiceWarningState(serviceDates, todayYmd);

  if (!dumpster) notFound();

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

      <AdminPageHeader
        title={dumpster.displayName}
        description={`${dumpster.size} • ${dumpster.equipmentId}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={[
                "inline-flex rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ring-inset",
                dumpster.active
                  ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                  : "bg-slate-100 text-slate-600 ring-slate-200",
              ].join(" ")}
            >
              {dumpster.active ? "Active" : "Inactive"}
            </span>
            <OperationalStatusPill status={dumpster.derivedOperationalStatus} size="header" />
            {serviceWarningPill ? <ServiceWarningPill warning={serviceWarningPill} size="header" /> : null}
          </div>
        }
      />

      <DumpsterDetailClient
        initialDumpster={dumpster}
        initialMode={resolvedSearchParams.mode === "edit" ? "edit" : "review"}
        initialServiceDates={serviceDates}
      />
    </AdminPage>
  );
}
