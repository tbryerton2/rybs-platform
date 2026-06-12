export const dynamic = "force-dynamic";
export const revalidate = 0;

import Link from "next/link";
import { notFound } from "next/navigation";
import { InteractiveInfoPopover } from "@/app/admin/(protected)/customers/[id]/interactive-info-popover";
import { requireAdminOwner } from "@/lib/admin/auth";
import { formatDumpsterSizeFromCapacity } from "@/lib/booking-product";
import { getEditableDumpsterProductSettings } from "@/lib/dumpster-product-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { LocationDetailsForm } from "./location-details-form";
import { PricingOverrideForm } from "./pricing-override-form";
import { ZipStatusToggleForm } from "./zip-status-toggle-form";
import { DeleteZipButton } from "../delete-zip-button";
import {
  deleteServiceZipAction,
} from "../actions";
import { AdminPage } from "@/app/admin/_components/admin/admin-page";

type PageProps = {
  params: Promise<{ id: string }>;
};

function formatDumpsterOverrideLabel(size: string) {
  return `${size.trim().replace(/\s+yard$/i, "-yard")} price override`;
}

function parseDumpsterSize(value: string) {
  const match = value.trim().match(/^(\d+(?:\.\d+)?)/);
  if (!match) return Number.POSITIVE_INFINITY;

  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : Number.POSITIVE_INFINITY;
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

type ZipRecord = {
  id: number;
  zip: string;
  county: string | null;
  active: boolean;
  town: string | null;
  state: string | null;
  price_14_yard_override: number | null;
};

export default async function AdminZipDetailPage({
  params,
}: PageProps) {
  const resolvedParams = await params;

  const id = Number(resolvedParams.id);
  const adminSession = await requireAdminOwner();

  if (!Number.isFinite(id)) notFound();

  const [{ data: zipRecord, error }, productSettings, pricingOverridesResult] =
    await Promise.all([
      supabaseAdmin
        .from("service_area_zips")
        .select("id, zip, county, active, town, state, price_14_yard_override" as string)
        .eq("id", id)
        .eq("business_id", adminSession.business.id)
        .single(),
      getEditableDumpsterProductSettings(adminSession.business.id),
      supabaseAdmin
        .from("service_area_zip_pricing_overrides")
        .select("dumpster_size, price_override")
        .eq("business_id", adminSession.business.id)
        .eq("service_area_zip_id", id),
    ]);

  if (error || !zipRecord) notFound();
  const zip = zipRecord as unknown as ZipRecord;
  if (pricingOverridesResult.error) {
    throw new Error(pricingOverridesResult.error.message);
  }

  const pricingOverridesBySize = new Map(
    ((pricingOverridesResult.data ?? []) as Array<{
      dumpster_size: string | number;
      price_override: number | null;
    }>)
      .map((row) => {
        const dumpsterSize = formatDumpsterSizeFromCapacity(row.dumpster_size);
        if (!dumpsterSize) return null;

        return [
          dumpsterSize,
          row.price_override == null ? null : Number(row.price_override),
        ] as const;
      })
      .filter((entry) => entry !== null),
  );

  const pricingOverrides = productSettings
    .filter((setting) => setting.isActiveSize)
    .sort((left, right) => {
      const sizeDelta = parseDumpsterSize(left.dumpsterSize) - parseDumpsterSize(right.dumpsterSize);
      if (sizeDelta !== 0) return sizeDelta;
      return left.dumpsterSize.localeCompare(right.dumpsterSize);
    })
    .map((setting) => ({
      dumpsterSize: setting.dumpsterSize,
      label: formatDumpsterOverrideLabel(setting.dumpsterSize),
      priceOverride:
        pricingOverridesBySize.get(setting.dumpsterSize.trim().toLowerCase()) ?? null,
    }));

  return (
    <AdminPage className="space-y-6 py-8" width="wide">
      <div>
        <Link
          href="/admin/settings/zips"
          className="text-sm font-medium text-slate-600 hover:text-slate-900"
        >
          ← Back to ZIP settings
        </Link>
      </div>

      <section className="space-y-3">
        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
          ZIP CODE DETAILS
        </div>
      </section>

      <div className="space-y-6">
        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <h2 className="text-lg font-semibold text-slate-900">ZIP Overview</h2>

              <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                <form action={deleteServiceZipAction}>
                  <input type="hidden" name="id" value={zip.id} />
                  <DeleteZipButton zip={zip.zip} />
                </form>

                <ZipStatusToggleForm
                  id={zip.id}
                  initialActive={zip.active}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 px-6 py-6 sm:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                ZIP Code
              </div>
              <div className="mt-2 text-lg font-semibold text-slate-900">
                {zip.zip}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Status
              </div>
              <div className="mt-2">{statusBadge(zip.active)}</div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                Town
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {fieldValue(zip.town)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                County
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {fieldValue(zip.county)}
              </div>
            </div>

            <div className="rounded-2xl bg-slate-50 px-4 py-4 ring-1 ring-slate-200">
              <div className="text-xs font-medium uppercase tracking-[0.12em] text-slate-500">
                State
              </div>
              <div className="mt-2 text-sm font-medium text-slate-900">
                {fieldValue(zip.state)}
              </div>
            </div>
          </div>
        </section>

        <section
          id="location-details"
          className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm"
        >
          <div className="border-b border-slate-200 px-6 py-5">
            <h2 className="text-lg font-semibold text-slate-900">Location Details</h2>
          </div>

          <LocationDetailsForm
            id={zip.id}
            town={zip.town}
            county={zip.county}
            stateCode={zip.state}
          />
        </section>

        <section className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">Pricing Override</h2>
              <InteractiveInfoPopover
                label="About Pricing Override"
                body="Control whether this ZIP uses the global default price or a custom ZIP-specific override."
              />
            </div>
          </div>

          <PricingOverrideForm
            id={zip.id}
            pricingOverrides={pricingOverrides}
          />
        </section>

      </div>
    </AdminPage>
  );
}
