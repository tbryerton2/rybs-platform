export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LocationDetailsForm } from "./location-details-form";
import { PricingOverrideForm } from "./pricing-override-form";
import { AdminToastTrigger } from "@/app/admin/_components/admin/admin-toast-trigger";
import {
  toggleZipActiveAction,
  updateZipLocationAction,
  updateZipPricingAction,
} from "./actions";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ status?: string }>;
};

function money(value: number | null) {
  if (value == null) return null;
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function statusBadge(active: boolean) {
  return active ? (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
      Active
    </span>
  ) : (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
      Disabled
    </span>
  );
}

function fieldValue(value: string | null) {
  return value?.trim() ? value : "—";
}

export default async function AdminZipDetailPage({
  params,
  searchParams,
}: PageProps) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : undefined;

  const id = Number(resolvedParams.id);
  const status = resolvedSearchParams?.status;

  if (!Number.isFinite(id)) notFound();

  const { data: zipRecord, error } = await supabaseAdmin
    .from("service_area_zips")
    .select("id, zip, county, active, town, price_14_yard_override")
    .eq("id", id)
    .single();

  if (error || !zipRecord) notFound();

  const isCustomPricing = zipRecord.price_14_yard_override != null;

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-8">
        <Link
          href="/admin/settings/zips"
          className="inline-flex items-center text-sm font-medium text-slate-500 transition hover:text-slate-900"
        >
          ← Back to ZIP settings
        </Link>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              ZIP Settings
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Manage service area details and ZIP-level pricing overrides.
            </p>
          </div>

          <div className="inline-flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
            <div>
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                ZIP Code
              </div>
              <div className="mt-1 text-lg font-semibold text-slate-900">
                {zipRecord.zip}
              </div>
            </div>
            {statusBadge(zipRecord.active)}
          </div>
        </div>
      </div>

      <AdminToastTrigger
        success={
          status
            ? (() => {
                const [action] = status.split("-");
                return `ZIP ${action}.`;
              })()
            : null
        }
        trigger={status}
        clearParam="status"
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">ZIP Overview</h2>
              <p className="mt-1 text-sm text-slate-600">
                Review coverage details and control whether this ZIP can be booked.
              </p>
            </div>

            <div className="grid gap-4 px-6 py-6 sm:grid-cols-2">
              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  ZIP Code
                </div>
                <div className="mt-2 text-lg font-semibold text-slate-900">
                  {zipRecord.zip}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Status
                </div>
                <div className="mt-2">{statusBadge(zipRecord.active)}</div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Town
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {fieldValue(zipRecord.town)}
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  County
                </div>
                <div className="mt-2 text-sm font-medium text-slate-900">
                  {fieldValue(zipRecord.county)}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 px-6 py-5">
              <form action={toggleZipActiveAction}>
                <input type="hidden" name="id" value={zipRecord.id} />
                <input
                  type="hidden"
                  name="nextActive"
                  value={zipRecord.active ? "false" : "true"}
                />
                <button
                  type="submit"
                  className={
                    zipRecord.active
                      ? "inline-flex items-center rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                      : "inline-flex items-center rounded-2xl bg-[#F97316] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-orange-500"
                  }
                >
                  {zipRecord.active ? "Disable ZIP" : "Enable ZIP"}
                </button>
              </form>
            </div>
          </section>

          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Location Details</h2>
              <p className="mt-1 text-sm text-slate-600">
                Update the town and county shown for this service area ZIP.
              </p>
            </div>

            <LocationDetailsForm
              id={zipRecord.id}
              town={zipRecord.town}
              county={zipRecord.county}
            />
          </section>
        </div>

        <div className="space-y-6">
          <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 px-6 py-5">
              <h2 className="text-lg font-semibold text-slate-900">Pricing Override</h2>
              <p className="mt-1 text-sm text-slate-600">
                Control whether this ZIP uses the global default price or a custom ZIP-specific override.
              </p>
            </div>

            <div className="px-6 pt-6">
              <div
                className={
                  isCustomPricing
                    ? "mb-5 rounded-2xl bg-orange-50 px-4 py-4 ring-1 ring-orange-200"
                    : "mb-5 rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200"
                }
              >
                <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                  Pricing Mode
                </div>

                <div className="mt-2 text-sm font-semibold text-slate-900">
                  {isCustomPricing ? "Custom ZIP pricing" : "Using global default pricing"}
                </div>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isCustomPricing
                    ? `This ZIP overrides the default 14-yard price with ${money(
                        zipRecord.price_14_yard_override
                      )}.`
                    : "No ZIP-level override is set. This ZIP will use the default 14-yard price from global pricing settings."}
                </p>
              </div>
            </div>

            <PricingOverrideForm
              id={zipRecord.id}
              price_14_yard_override={zipRecord.price_14_yard_override}
            />
          </section>

          <section className="overflow-hidden rounded-[28px] border border-dashed border-slate-300 bg-slate-50">
            <div className="px-6 py-5">
              <h2 className="text-base font-semibold text-slate-900">Future-ready structure</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This section is intentionally structured so more ZIP-level pricing controls can
                be added later, such as scheduled pickup pricing, included days, daily overage,
                included tonnage, and ton overage.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}