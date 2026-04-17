import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";

function PlaceholderCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="text-lg font-semibold text-slate-900">{title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
      <div className="mt-6 rounded-[24px] border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-sm text-slate-500">
        Report modules for this area will be added here.
      </div>
    </section>
  );
}

export default function AdminAnalyticsReportsPage() {
  return (
    <AdminPage width="wide" className="space-y-8">
      <AdminPageHeader
        title="Reports"
        description="A starter home for future operational, financial, and marketing reports."
      />

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="max-w-3xl">
          <h2 className="text-lg font-semibold text-slate-900">Report library</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            This page is ready to grow into a report hub without committing to final report content yet. Use it as the entry point for saved views, exports, and recurring reporting areas.
          </p>
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-3">
        <PlaceholderCard
          title="Operational reports"
          description="Space for service volume, routing, fleet usage, and booking lifecycle reporting."
        />
        <PlaceholderCard
          title="Financial reports"
          description="Space for revenue, expense, margin, and period-over-period financial reporting."
        />
        <PlaceholderCard
          title="Marketing reports"
          description="Space for acquisition, funnel, retention, and website performance reports."
        />
      </div>
    </AdminPage>
  );
}
