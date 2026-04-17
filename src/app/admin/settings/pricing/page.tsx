export const dynamic = "force-dynamic";
export const revalidate = 0;

import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";
import { isMissingPricingSettingsRentalPeriodColumnsError } from "@/lib/pricing-settings";
import { formatDateTimeET } from "@/lib/time";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { PricingSettingsForm } from "./pricing-settings-form";

type PricingSettingsRow = {
  id: string;
  standard_rental_price: number;
  included_rental_days: number;
  daily_overage_price: number;
  max_rental_days: number | null;
  allow_extended_rental_at_booking: boolean;
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

async function getPricingSettings(): Promise<PricingSettingsRow> {
  const selectClause = `
    id,
    standard_rental_price,
    included_rental_days,
    daily_overage_price,
    max_rental_days,
    allow_extended_rental_at_booking,
    included_tons,
    ton_overage_price,
    updated_at
  `;

  const { data, error } = await supabaseAdmin
    .from("pricing_settings")
    .select(selectClause)
    .maybeSingle();

  if (error && !isMissingPricingSettingsRentalPeriodColumnsError(error)) {
    throw new Error(error.message);
  }

  if (error && isMissingPricingSettingsRentalPeriodColumnsError(error)) {
    const legacySelectClause = `
      id,
      standard_rental_price,
      included_rental_days,
      daily_overage_price,
      included_tons,
      ton_overage_price,
      updated_at
    `;
    const legacyResult = await supabaseAdmin
      .from("pricing_settings")
      .select(legacySelectClause)
      .maybeSingle<{
        id: string;
        standard_rental_price: number;
        included_rental_days: number;
        daily_overage_price: number;
        included_tons: number;
        ton_overage_price: number;
        updated_at: string | null;
      }>();

    if (legacyResult.error) throw new Error(legacyResult.error.message);

    if (legacyResult.data) {
      return {
        ...legacyResult.data,
        max_rental_days: null,
        allow_extended_rental_at_booking: false,
      };
    }
  }

  if (data) return data;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("pricing_settings")
    .insert({
      standard_rental_price: 475,
      scheduled_pickup_price: 475,
      included_rental_days: 7,
      daily_overage_price: 30,
      max_rental_days: null,
      allow_extended_rental_at_booking: false,
      included_tons: 1,
      ton_overage_price: 100,
    })
    .select(selectClause)
    .single();

  if (insertError && !isMissingPricingSettingsRentalPeriodColumnsError(insertError)) {
    throw new Error(insertError.message);
  }

  if (insertError && isMissingPricingSettingsRentalPeriodColumnsError(insertError)) {
    const legacyInsertResult = await supabaseAdmin
      .from("pricing_settings")
      .insert({
        standard_rental_price: 475,
        scheduled_pickup_price: 475,
        included_rental_days: 7,
        daily_overage_price: 30,
        included_tons: 1,
        ton_overage_price: 100,
      })
      .select(`
        id,
        standard_rental_price,
        included_rental_days,
        daily_overage_price,
        included_tons,
        ton_overage_price,
        updated_at
      `)
      .single<{
        id: string;
        standard_rental_price: number;
        included_rental_days: number;
        daily_overage_price: number;
        included_tons: number;
        ton_overage_price: number;
        updated_at: string | null;
      }>();

    if (legacyInsertResult.error) throw new Error(legacyInsertResult.error.message);

    return {
      ...legacyInsertResult.data,
      max_rental_days: null,
      allow_extended_rental_at_booking: false,
    };
  }

  return inserted;
}

export default async function AdminPricingSettingsPage() {
  const pricing = await getPricingSettings();
  const maxRentalSummary =
    pricing.max_rental_days == null ? "No hard cap" : `${pricing.max_rental_days} days`;

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pricing"
        description="Control the default rental period and overage pricing customers see during booking."
      />

      <section className="mb-8 rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-[0_2px_6px_rgba(15,23,42,0.06)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Current default setup
            </div>
            <h2 className="mt-2 text-lg font-semibold text-slate-950">
              Rental pricing customers are booking against
            </h2>
            <p className="mt-1 max-w-2xl text-sm text-slate-600">
              ZIP-specific overrides can still change the base price, but these rental-period rules
              are the default source of truth across the booking flow.
            </p>
            {pricing.updated_at ? (
              <div className="mt-2 text-xs text-slate-500">
                Last updated {formatDateTimeET(pricing.updated_at)}
              </div>
            ) : null}
          </div>

          <div className="inline-flex items-center gap-2 self-start rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            Active defaults
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Standard rental period
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {pricing.included_rental_days} days
            </div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Base price
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {formatMoney(pricing.standard_rental_price)}
            </div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Daily overage rate
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {formatMoney(pricing.daily_overage_price)}
            </div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Maximum rental length
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">{maxRentalSummary}</div>
          </div>
          <div className="rounded-2xl bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
              Booking-time extra days
            </div>
            <div className="mt-2 text-lg font-semibold text-slate-950">
              {pricing.allow_extended_rental_at_booking ? "Allowed" : "Off"}
            </div>
          </div>
        </div>
      </section>

      <PricingSettingsForm
        pricing={{
          id: pricing.id,
          basePrice: pricing.standard_rental_price,
          standardRentalDays: pricing.included_rental_days,
          dailyOveragePrice: pricing.daily_overage_price,
          maxRentalDays: pricing.max_rental_days,
          allowExtendedRentalAtBooking: pricing.allow_extended_rental_at_booking,
          includedTons: pricing.included_tons,
          tonOveragePrice: pricing.ton_overage_price,
        }}
      />
    </AdminPage>
  );
}
