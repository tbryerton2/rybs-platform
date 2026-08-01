export const dynamic = "force-dynamic";
export const revalidate = 0;

import type { ComponentType, SVGProps } from "react";
import {
  CalendarIcon,
  ClockIcon,
  InformationCircleIcon,
  PlusCircleIcon,
} from "@heroicons/react/24/outline";
import { adminSummaryCardShell } from "@/app/admin/_components/AdminSummaryCard";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { DumpsterProductSettingsForm } from "@/app/admin/(protected)/settings/pricing/dumpster-product-settings-form";
import { requireAdminOwner } from "@/lib/admin/auth";
import { getHighestActiveIncludedRentalDays } from "@/lib/admin/pricing-settings-validation";
import { getEditableDumpsterProductSettings } from "@/lib/dumpster-product-settings";
import {
  isMissingPricingSettingsIncludedServicesBlurbColumnError,
  isMissingPricingSettingsRentalPeriodColumnsError,
} from "@/lib/pricing-settings";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PricingSettingsForm } from "./pricing-settings-form";

type PricingSettingsRow = {
  id: string;
  standard_rental_price: number;
  included_rental_days: number;
  daily_overage_price: number;
  max_rental_days: number | null;
  allow_extended_rental_at_booking: boolean;
  included_services_blurb: string | null;
  included_tons: number;
  ton_overage_price: number;
  updated_at: string | null;
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

type SummaryCardTone = "blue" | "green" | "amber" | "violet" | "teal";

function joinClasses(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function statTileClasses(tone: SummaryCardTone) {
  return tone === "blue"
    ? "bg-sky-100/95 text-sky-700 ring-sky-200/90"
    : tone === "green"
      ? "bg-emerald-100/95 text-emerald-700 ring-emerald-200/90"
      : tone === "amber"
        ? "bg-amber-100/95 text-amber-700 ring-amber-200/90"
        : tone === "violet"
          ? "bg-violet-100/95 text-violet-700 ring-violet-200/90"
          : "bg-teal-100/95 text-teal-700 ring-teal-200/90";
}

function SummaryMetricCard({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  tone: SummaryCardTone;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
}) {
  return (
    <div className={adminSummaryCardShell(tone, "h-full p-5")}>
      <div className="flex gap-4">
        <span
          className={joinClasses(
            "inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[14px] bg-white/65 ring-1 ring-inset",
            statTileClasses(tone),
          )}
        >
          <Icon className="h-6 w-6" />
        </span>
        <div className="min-w-0">
          <div className="flex h-12 items-center text-sm font-medium leading-5 text-slate-600">
            {label}
          </div>
          <div className="mt-2 text-lg font-semibold tracking-tight text-slate-950">{value}</div>
        </div>
      </div>
    </div>
  );
}

async function getPricingSettings(businessId: string): Promise<PricingSettingsRow> {
  const selectClause = `
    id,
    standard_rental_price,
    included_rental_days,
    daily_overage_price,
    max_rental_days,
    allow_extended_rental_at_booking,
    included_services_blurb,
    included_tons,
    ton_overage_price,
    updated_at
  `;

  const { data, error } = await supabaseAdmin
    .from("pricing_settings")
    .select(selectClause)
    .eq("business_id", businessId)
    .maybeSingle();

  if (
    error &&
    !isMissingPricingSettingsRentalPeriodColumnsError(error) &&
    !isMissingPricingSettingsIncludedServicesBlurbColumnError(error)
  ) {
    throw new Error(error.message);
  }

  if (error) {
    const hasRentalPeriodColumns = !isMissingPricingSettingsRentalPeriodColumnsError(error);
    const legacySelectClause = `
      id,
      standard_rental_price,
      included_rental_days,
      daily_overage_price,
      ${hasRentalPeriodColumns ? "max_rental_days," : ""}
      ${hasRentalPeriodColumns ? "allow_extended_rental_at_booking," : ""}
      included_tons,
      ton_overage_price,
      updated_at
    `;
    const legacyResult = await supabaseAdmin
      .from("pricing_settings")
      .select(legacySelectClause)
      .eq("business_id", businessId)
      .maybeSingle<{
        id: string;
        standard_rental_price: number;
        included_rental_days: number;
        daily_overage_price: number;
        max_rental_days?: number | null;
        allow_extended_rental_at_booking?: boolean;
        included_tons: number;
        ton_overage_price: number;
        updated_at: string | null;
      }>();

    if (legacyResult.error) throw new Error(legacyResult.error.message);

    if (legacyResult.data) {
      return {
        ...legacyResult.data,
        max_rental_days: legacyResult.data.max_rental_days ?? null,
        allow_extended_rental_at_booking:
          legacyResult.data.allow_extended_rental_at_booking ?? false,
        included_services_blurb: null,
      };
    }
  }

  if (data) return data;

  const defaultPricingSettings = {
    standard_rental_price: 475,
    scheduled_pickup_price: 475,
    included_rental_days: 7,
    daily_overage_price: 30,
    max_rental_days: null,
    allow_extended_rental_at_booking: false,
    included_services_blurb: null,
    included_tons: 1,
    ton_overage_price: 100,
    business_id: businessId,
  };

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("pricing_settings")
    .upsert(defaultPricingSettings, { onConflict: "business_id" })
    .select(selectClause)
    .single();

  if (
    insertError &&
    !isMissingPricingSettingsRentalPeriodColumnsError(insertError) &&
    !isMissingPricingSettingsIncludedServicesBlurbColumnError(insertError)
  ) {
    throw new Error(insertError.message);
  }

  if (insertError) {
    const hasRentalPeriodColumns = !isMissingPricingSettingsRentalPeriodColumnsError(insertError);
    const legacyInsertResult = await supabaseAdmin
      .from("pricing_settings")
      .upsert({
        standard_rental_price: 475,
        scheduled_pickup_price: 475,
        included_rental_days: 7,
        daily_overage_price: 30,
        included_tons: 1,
        ton_overage_price: 100,
        business_id: businessId,
        ...(hasRentalPeriodColumns
          ? {
              max_rental_days: null,
              allow_extended_rental_at_booking: false,
            }
          : {}),
      }, { onConflict: "business_id" })
      .select(`
        id,
        standard_rental_price,
        included_rental_days,
        daily_overage_price,
        ${hasRentalPeriodColumns ? "max_rental_days," : ""}
        ${hasRentalPeriodColumns ? "allow_extended_rental_at_booking," : ""}
        included_tons,
        ton_overage_price,
        updated_at
      `)
      .single<{
        id: string;
        standard_rental_price: number;
        included_rental_days: number;
        daily_overage_price: number;
        max_rental_days?: number | null;
        allow_extended_rental_at_booking?: boolean;
        included_tons: number;
        ton_overage_price: number;
        updated_at: string | null;
      }>();

    if (legacyInsertResult.error) throw new Error(legacyInsertResult.error.message);

    return {
      ...legacyInsertResult.data,
      max_rental_days: legacyInsertResult.data.max_rental_days ?? null,
      allow_extended_rental_at_booking:
        legacyInsertResult.data.allow_extended_rental_at_booking ?? false,
      included_services_blurb: null,
    };
  }

  if (!inserted) {
    throw new Error("Unable to create pricing settings.");
  }

  return inserted;
}

export default async function AdminPricingSettingsPage() {
  const adminSession = await requireAdminOwner();
  const [pricing, productSettings] = await Promise.all([
    getPricingSettings(adminSession.business.id),
    getEditableDumpsterProductSettings(adminSession.business.id),
  ]);
  const maxRentalSummary =
    pricing.max_rental_days == null ? "No hard cap" : `${pricing.max_rental_days} days`;
  const highestActiveIncludedRentalDays = getHighestActiveIncludedRentalDays(productSettings);

  return (
    <AdminPage>
      <AdminPageHeader
        title={
          <span className="flex items-center gap-2">
            <span>Pricing</span>
            <button
              type="button"
              aria-label="Pricing page details"
              className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
            >
              <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-7 z-50 w-72 translate-y-1 rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              >
                Control global booking rules here. Size-specific price, included days, and included weight now live in the dumpster product settings below.
              </span>
            </button>
          </span>
        }
      />

      <section className="mb-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <SummaryMetricCard
            label="Ton Overage Rate"
            value={formatMoney(pricing.ton_overage_price)}
            tone="amber"
            icon={ClockIcon}
          />
          <SummaryMetricCard
            label="Max Rental Length"
            value={maxRentalSummary}
            tone="violet"
            icon={CalendarIcon}
          />
          <SummaryMetricCard
            label="Booking-Time Extra Days"
            value={pricing.allow_extended_rental_at_booking ? "Allowed" : "Off"}
            tone="teal"
            icon={PlusCircleIcon}
          />
        </div>
      </section>

      <PricingSettingsForm
        pricing={{
          id: pricing.id,
          maxRentalDays: pricing.max_rental_days,
          allowExtendedRentalAtBooking: pricing.allow_extended_rental_at_booking,
          includedServicesBlurb: pricing.included_services_blurb,
          tonOveragePrice: pricing.ton_overage_price,
        }}
        highestActiveIncludedRentalDays={highestActiveIncludedRentalDays}
      />

      <section className="mt-8">
        <div className="mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-semibold tracking-tight text-slate-950">
              Dumpster product settings
            </h2>
            <button
              type="button"
              aria-label="Dumpster product settings details"
              className="group relative rounded-full p-0.5 text-slate-400 transition hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
            >
              <InformationCircleIcon className="h-4.5 w-4.5" aria-hidden="true" />
              <span
                role="tooltip"
                className="pointer-events-none absolute left-0 top-7 z-50 w-80 translate-y-1 rounded-[14px] border border-slate-200/90 bg-white px-3.5 py-2.5 text-left text-xs font-medium leading-5 text-slate-600 opacity-0 shadow-[0_16px_36px_rgba(15,23,42,0.14)] transition duration-150 group-hover:pointer-events-auto group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:pointer-events-auto group-focus-visible:translate-y-0 group-focus-visible:opacity-100"
              >
                Edit the customer-facing display, pricing, and rental details for each offered
                dumpster size. Active sizes from the dumpsters table appear here automatically,
                even before a settings row exists.
              </span>
            </button>
          </div>
        </div>
        <DumpsterProductSettingsForm settings={productSettings} />
      </section>
    </AdminPage>
  );
}
