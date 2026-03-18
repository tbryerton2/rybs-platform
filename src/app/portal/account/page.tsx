import { requirePortalCustomer } from "@/lib/portal/auth";
import { getPortalDashboardData } from "@/lib/portal/data";
import { PortalShell } from "../_components/portal-shell";

export default async function PortalAccountPage() {
  const customer = await requirePortalCustomer();
  const { locations, recentBookings } = await getPortalDashboardData(customer.id);

  return (
    <PortalShell pathname="/portal/account">
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
            Account
          </div>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Contact details
          </h2>

          <dl className="mt-6 space-y-5 text-sm">
            <div>
              <dt className="font-medium text-slate-500">Full name</dt>
              <dd className="mt-1 text-slate-900">{customer.name || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Email</dt>
              <dd className="mt-1 text-slate-900">{customer.email || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Phone</dt>
              <dd className="mt-1 text-slate-900">{customer.phone || "—"}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-500">Default address</dt>
              <dd className="mt-1 text-slate-900">
                {[customer.primary_street, customer.primary_city, customer.primary_zip]
                  .filter(Boolean)
                  .join(", ") || "—"}
              </dd>
            </div>
          </dl>

          <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
            V1 portal account settings are read-only. Contact Tan Can Man if you need to update
            your default contact details.
          </div>
        </section>

        <section className="space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Saved service locations</h2>
            <div className="mt-5 space-y-3">
              {locations.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-500">
                  No saved service locations yet.
                </div>
              ) : (
                locations.map((location) => (
                  <div key={location.id} className="rounded-2xl border border-slate-200 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-slate-900">{location.label}</div>
                      {location.is_default ? (
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                          Default
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-slate-500">
                      {[location.street, location.city, location.zip].filter(Boolean).join(", ")}
                    </div>
                    {location.delivery_notes ? (
                      <div className="mt-2 text-sm text-slate-500">{location.delivery_notes}</div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xl font-semibold text-slate-900">Rental history snapshot</h2>
            <div className="mt-5 text-sm text-slate-500">
              {recentBookings.length} linked booking{recentBookings.length === 1 ? "" : "s"} in your
              portal account.
            </div>
          </div>
        </section>
      </div>
    </PortalShell>
  );
}
