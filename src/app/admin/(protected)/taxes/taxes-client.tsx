"use client";

import {
  createMockEmployeeTaxRecords,
  createMockTaxCheckpoints,
  createMockTaxProfile,
} from "@/lib/admin/taxes";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/New_York",
  }).format(new Date(`${value}T12:00:00`));
}

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/New_York",
  }).format(new Date(value));
}

export function TaxesClient() {
  const profile = createMockTaxProfile();
  const checkpoints = createMockTaxCheckpoints();
  const employeeRecords = createMockEmployeeTaxRecords();

  const dueSoonCount = checkpoints.filter((checkpoint) => checkpoint.status === "Due soon").length;
  const needsReviewCount = checkpoints.filter((checkpoint) => checkpoint.status === "Needs review").length;
  const missingEmployeeItems = employeeRecords.filter(
    (record) =>
      record.withholdingFormStatus !== "Complete" ||
      record.stateSetupStatus !== "Complete" ||
      record.yearEndDeliveryStatus !== "Complete",
  ).length;

  return (
    <div className="space-y-8">
      <section className="grid gap-4 sm:grid-cols-3">
        {[
          { label: "Upcoming deadlines", value: String(dueSoonCount), hint: "Quarterly or provider follow-up due soon" },
          { label: "Needs review", value: String(needsReviewCount), hint: "Items blocked on owner or CPA review" },
          { label: "Employee tax follow-up", value: String(missingEmployeeItems), hint: "Records needing updated forms or setup" },
        ].map((stat) => (
          <div key={stat.label} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
            <div className="text-sm font-medium text-slate-500">{stat.label}</div>
            <div className="mt-2 text-3xl font-semibold tracking-tight text-slate-900">{stat.value}</div>
            <div className="mt-2 text-xs text-slate-500">{stat.hint}</div>
          </div>
        ))}
      </section>

      <section className="grid gap-8 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
        <div className="space-y-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">Business taxes</h2>
              <p className="mt-1 text-sm text-slate-500">
                Keep core filing context and tax administration notes visible without storing full tax returns or calculation logic here.
              </p>
            </div>

            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Business tax ID", profile.businessTaxId],
                ["Filing entity", profile.filingEntity],
                ["Sales tax status", profile.salesTaxStatus],
                ["Payroll tax tracking", profile.payrollTaxStatus],
              ].map(([label, value]) => (
                <div key={label} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</dt>
                  <dd className="mt-2 text-sm font-medium text-slate-900">{value}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-white p-5">
              <div className="text-sm font-semibold text-slate-900">Compliance notes</div>
              <p className="mt-2 text-sm leading-6 text-slate-600">{profile.complianceNotes}</p>
              <div className="mt-3 text-xs text-slate-500">Last updated {formatTimestamp(profile.updatedAt)}</div>
            </div>
          </div>

          <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5 sm:px-8">
              <div className="text-lg font-semibold text-slate-900">Employee tax status</div>
              <div className="mt-1 text-sm text-slate-500">
                Summary-level visibility into withholding and year-end document readiness.
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50/80">
                  <tr className="text-left">
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Employee</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Withholding</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">State setup</th>
                    <th className="px-4 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500">Year-end</th>
                    <th className="px-6 py-3.5 font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-8">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {employeeRecords.map((record) => (
                    <tr key={record.id}>
                      <td className="px-6 py-4 sm:px-8">
                        <div className="font-semibold text-slate-900">{record.employeeName}</div>
                        <div className="mt-1 text-xs text-slate-500">{record.role}</div>
                      </td>
                      {[record.withholdingFormStatus, record.stateSetupStatus, record.yearEndDeliveryStatus].map((status, index) => (
                        <td key={`${record.id}-${index}`} className="px-4 py-4">
                          <span
                            className={[
                              "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                              status === "Complete"
                                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                                : status === "Pending update"
                                  ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                                  : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                            ].join(" ")}
                          >
                            {status}
                          </span>
                        </td>
                      ))}
                      <td className="px-6 py-4 text-slate-600 sm:px-8">{record.notes}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="text-lg font-semibold text-slate-900">Filing checkpoints</div>
            <p className="mt-1 text-sm text-slate-500">
              Use this as an administrative reminder surface for the owner, bookkeeper, or CPA.
            </p>

            <div className="mt-6 space-y-4">
              {checkpoints.map((checkpoint) => (
                <div key={checkpoint.id} className="rounded-[24px] border border-slate-200 bg-slate-50/70 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-slate-900">{checkpoint.label}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-500">
                        Due {formatDate(checkpoint.dueDate)} • Owner {checkpoint.owner}
                      </div>
                    </div>
                    <span
                      className={[
                        "inline-flex rounded-full px-2.5 py-1 text-xs font-semibold",
                        checkpoint.status === "On track"
                          ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                          : checkpoint.status === "Due soon"
                            ? "bg-amber-50 text-amber-700 ring-1 ring-amber-200"
                            : "bg-rose-50 text-rose-700 ring-1 ring-rose-200",
                      ].join(" ")}
                    >
                      {checkpoint.status}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{checkpoint.notes}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-sm">
            <div className="text-sm font-semibold text-slate-900">Data status</div>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Taxes currently uses typed mock data and status placeholders. It is intentionally administrative only: no filing workflows, tax calculations, or payroll processing are implemented here.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
