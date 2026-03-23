export const dynamic = "force-dynamic";
export const revalidate = 0;

import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { updatePricingSettingsAction } from "./actions";
import { formatDateTimeET } from "@/lib/time";
import { AdminPage, AdminPageHeader } from "@/app/admin/_components/admin/admin-page";

type SearchParams = Record<string, string | string[] | undefined>;

type PricingSettingsRow = {
  id: string;
  standard_rental_price: number;
  scheduled_pickup_price: number;
  included_rental_days: number;
  included_tons: number;
  daily_overage_price: number;
  ton_overage_price: number;
  updated_at: string | null;
};

function sp(obj: SearchParams, key: string) {
  const v = obj[key];
  return Array.isArray(v) ? v[0] : v;
}

function formatMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

async function getPricingSettings(): Promise<PricingSettingsRow> {
  const { data, error } = await supabaseAdmin
    .from("pricing_settings")
    .select(`
      id,
      standard_rental_price,
      scheduled_pickup_price,
      included_rental_days,
      included_tons,
      daily_overage_price,
      ton_overage_price,
      updated_at
    `)
    .maybeSingle();

  if (error) throw new Error(error.message);

  if (data) return data;

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from("pricing_settings")
    .insert({
      standard_rental_price: 475,
      scheduled_pickup_price: 450,
      included_rental_days: 7,
      included_tons: 1,
      daily_overage_price: 30,
      ton_overage_price: 100,
    })
    .select(`
      id,
      standard_rental_price,
      scheduled_pickup_price,
      included_rental_days,
      included_tons,
      daily_overage_price,
      ton_overage_price,
      updated_at
    `)
    .single();

  if (insertError) throw new Error(insertError.message);

  return inserted;
}

function Section({
  title,
  description,
  icon,
  children,
}: {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="mb-6 flex items-start gap-4">
        {icon ? (
          <span
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-orange-50 text-[#F97316]"
            aria-hidden="true"
          >
            {icon}
          </span>
        ) : null}

        <div>
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {description ? (
            <p className="mt-1 text-sm text-slate-600">{description}</p>
          ) : null}
        </div>
      </div>

      {children}
    </section>
  );
}

function Field({
  label,
  name,
  type = "number",
  step = "0.01",
  min = "0",
  defaultValue,
  prefix,
  suffix,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  min?: string;
  defaultValue: string | number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium text-slate-800">{label}</div>
      <div className="relative">
        {prefix ? (
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-sm text-slate-500">
            {prefix}
          </span>
        ) : null}

        <input
          name={name}
          type={type}
          step={step}
          min={min}
          defaultValue={defaultValue}
          required
          className={[
            "h-12 w-full rounded-2xl border border-slate-300 bg-white text-sm text-slate-900 outline-none transition",
            "focus:border-[#F97316] focus:ring-4 focus:ring-orange-100",
            prefix ? "pl-8 pr-4" : "px-4",
            suffix ? "pr-24" : "",
          ].join(" ")}
        />

        {suffix ? (
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4 text-sm text-slate-500">
            {suffix}
          </span>
        ) : null}
      </div>
    </label>
  );
}

export default async function AdminPricingSettingsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const pricing = await getPricingSettings();
  const params = await searchParams;
  const saved = sp(params, "saved") === "1";

  return (
    <AdminPage>
      <AdminPageHeader
        title="Pricing Settings"
        description="Control the default pricing rules for dumpster rentals."
      />

      {/* Current Pricing */}
        <section className="mb-8 rounded-[32px] border border-slate-200 bg-slate-50/80 p-6 shadow-[0_2px_6px_rgba(15,23,42,0.06)] sm:p-8">
            <div className="mb-5">
                <div className="flex items-center gap-3">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Current Pricing
                </span>

                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-[2px] text-[11px] font-medium text-emerald-700">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                    Active
                </span>
                </div>

                <h2 className="mt-2 text-lg font-semibold text-slate-950">
                Live customer pricing snapshot
                </h2>

                <p className="mt-1 text-sm text-slate-600">
                These are the default prices currently used in booking unless a ZIP-specific override exists.
                </p>

                {pricing.updated_at ? (
                <div className="mt-2 text-xs text-slate-500">
                    Last updated {formatDateTimeET(pricing.updated_at)}
                </div>
                ) : null}
            </div>

            <div className="rounded-3xl border border-slate-200/70 bg-white px-5 py-5 shadow-none sm:px-6">
                <div className="flex items-center justify-between gap-4">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Example Customer Price
                    </div>
                    <h3 className="mt-2 text-lg font-semibold text-slate-950">
                    Default pricing customers see during booking
                    </h3>
                </div>

                <div className="flex items-center gap-2 rounded-full bg-amber-50 border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700">
                    Preview
                </div>
                </div>

                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Main Pricing
                    </div>

                    <div className="mt-3 space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Standard rental</span>
                        <span className="text-base font-bold text-slate-950">
                        {formatMoney(pricing.standard_rental_price)}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Scheduled pickup</span>
                        <span className="text-base font-bold text-slate-950">
                        {formatMoney(pricing.scheduled_pickup_price)}
                        </span>
                    </div>
                    </div>
                </div>

                <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    Included & Overages
                    </div>

                    <div className="mt-3 space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Included rental period</span>
                        <span className="text-base font-bold text-slate-950">
                        {pricing.included_rental_days} days
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Included weight</span>
                        <span className="text-base font-bold text-slate-950">
                        {pricing.included_tons} ton{pricing.included_tons === 1 ? "" : "s"}
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Extra days</span>
                        <span className="text-base font-bold text-slate-950">
                        {formatMoney(pricing.daily_overage_price)}/day
                        </span>
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-2xl bg-slate-200/60 border border-transparent px-4 py-2.5">
                        <span className="text-sm text-slate-600">Extra weight</span>
                        <span className="text-base font-bold text-slate-950">
                        {formatMoney(pricing.ton_overage_price)}/ton
                        </span>
                    </div>
                    </div>
                </div>
                </div>
            </div>
            
          </section>
        <div className="my-10 h-px bg-slate-200" />
        <div className="mb-4">
            <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                Update Pricing Rules
            </div>
        </div>

      {saved ? (
        <div className="mb-6 rounded-3xl border border-emerald-200/70 bg-emerald-50 px-5 py-4 text-sm text-emerald-900 shadow-sm">
          <div className="font-semibold">Pricing settings saved</div>
          <div className="mt-1 text-emerald-800/90">
            Your default pricing rules have been updated.
          </div>
        </div>
      ) : null}

      <form action={updatePricingSettingsAction} className="space-y-6">
        <input type="hidden" name="id" value={pricing.id} />

        <Section
            icon="💰"
            title="Base Pricing"
            description="These are the main pricing options customers see during booking."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Standard Rental Price"
              name="standard_rental_price"
              prefix="$"
              defaultValue={pricing.standard_rental_price}
            />
            <Field
              label="Scheduled Pickup Price"
              name="scheduled_pickup_price"
              prefix="$"
              defaultValue={pricing.scheduled_pickup_price}
            />
          </div>
        </Section>

        <Section
            icon="📅"
            title="Rental Period"
            description="Define the included rental period and the cost of extra days."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Included Rental Days"
              name="included_rental_days"
              type="number"
              step="1"
              min="1"
              defaultValue={pricing.included_rental_days}
              suffix="days"
            />
            <Field
              label="Daily Overage Price"
              name="daily_overage_price"
              prefix="$"
              defaultValue={pricing.daily_overage_price}
              suffix="per day"
            />
          </div>

          <div className="mt-5 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-700">
            Included Rental Period:{" "}
            <span className="font-semibold">{pricing.included_rental_days} days</span>
            {" · "}
            Extra Days:{" "}
            <span className="font-semibold">
              {formatMoney(pricing.daily_overage_price)} per day
            </span>
          </div>
        </Section>

        <Section
            icon="⚖️"
            title="Weight Overages"
            description="Define the included weight and overage pricing."
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label="Included Tons"
              name="included_tons"
              type="number"
              step="0.01"
              min="0"
              defaultValue={pricing.included_tons}
              suffix="tons"
            />
            <Field
              label="Price Per Ton Over"
              name="ton_overage_price"
              prefix="$"
              defaultValue={pricing.ton_overage_price}
              suffix="per ton"
            />
          </div>
        </Section>

        <Section
            icon="💾"
            title="Save Settings"
            description="These default prices will be used unless a ZIP-level override exists."
        >
          <div className="flex items-center justify-end">
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl bg-[#F97316] px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-orange-600 focus:outline-none focus:ring-4 focus:ring-orange-100"
            >
              Save Pricing Settings
            </button>
          </div>
        </Section>
      </form>
    </AdminPage>
  );
}
