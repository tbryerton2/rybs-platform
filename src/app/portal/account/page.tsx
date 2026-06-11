import type { ComponentType, ReactNode, SVGProps } from "react";
import {
  BuildingOffice2Icon,
  EnvelopeIcon,
  MapPinIcon,
  PhoneIcon,
  UserIcon,
} from "@heroicons/react/24/outline";
import { requirePortalCustomer } from "@/lib/portal/auth";
import { isPortalSchemaError } from "@/lib/portal/schema";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant } from "@/lib/tenant/server";
import { updatePortalAccountAction } from "./actions";
import { PortalShell } from "../_components/portal-shell";
import { PortalSubpageHeader } from "../_components/portal-subpage-header";

type SearchParams = Record<string, string | string[] | undefined>;

type PortalAccountProfile = {
  company: string | null;
  preferredContactMethod: "email" | "phone" | "either" | null;
};

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function getPortalAccountProfile(customerId: string): Promise<PortalAccountProfile> {
  const tenant = await getCurrentTenant();
  const lookup = await supabaseAdmin
    .from("customers")
    .select("company, preferred_contact_method")
    .eq("id", customerId)
    .eq("business_id", tenant.id)
    .maybeSingle();

  if (lookup.error && !isPortalSchemaError(lookup.error)) {
    throw new Error(lookup.error.message);
  }

  if (lookup.error || !lookup.data) {
    return {
      company: null,
      preferredContactMethod: null,
    };
  }

  const row = lookup.data as { company?: string | null; preferred_contact_method?: string | null };
  const preferred =
    row.preferred_contact_method === "email" ||
    row.preferred_contact_method === "phone" ||
    row.preferred_contact_method === "either"
      ? row.preferred_contact_method
      : null;

  return {
    company: row.company ?? null,
    preferredContactMethod: preferred,
  };
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  placeholder,
  autoComplete,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string | null;
  placeholder?: string;
  autoComplete?: string;
  children?: ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-semibold text-slate-900">{label}</div>
      {children ?? (
        <input
          type={type}
          name={name}
          defaultValue={defaultValue ?? ""}
          placeholder={placeholder}
          autoComplete={autoComplete}
          className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[#f97316]/20"
        />
      )}
    </label>
  );
}

function SectionCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 ring-1 ring-slate-200">
          <Icon className="h-5 w-5" />
        </span>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function ContactMethodSelect({ defaultValue }: { defaultValue: PortalAccountProfile["preferredContactMethod"] }) {
  return (
    <Field label="Preferred method of contact" name="preferred_contact_method">
      <select
        name="preferred_contact_method"
        defaultValue={defaultValue ?? "either"}
        className="mt-2 h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm text-slate-900 outline-none transition focus:border-slate-300 focus:ring-2 focus:ring-[#f97316]/20"
      >
        <option value="either">Email or phone</option>
        <option value="email">Email</option>
        <option value="phone">Phone</option>
      </select>
    </Field>
  );
}

export default async function PortalAccountPage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const customer = await requirePortalCustomer();
  const profile = await getPortalAccountProfile(customer.id);
  const resolvedSearchParams = (await searchParams) ?? {};
  const saved = readValue(resolvedSearchParams, "saved") === "1";

  return (
    <PortalShell pathname="/portal/account">
      <form action={updatePortalAccountAction} className="space-y-6">
        <PortalSubpageHeader
          title="Account"
          description="Keep your profile, contact information, and primary service address up to date."
          backHref={null}
          meta={
            <button
              type="submit"
              className="inline-flex h-11 items-center justify-center rounded-2xl border border-[#ea580c] bg-[#f97316] px-5 text-sm font-semibold text-white transition hover:border-[#c2410c] hover:bg-[#ea580c]"
            >
              Save changes
            </button>
          }
        />

        {saved ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Your account details were updated.
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-2">
          <SectionCard title="Personal Details" icon={UserIcon}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Full name"
                name="full_name"
                defaultValue={customer.name}
                placeholder="Full name"
                autoComplete="name"
              />
              <Field
                label="Company"
                name="company"
                defaultValue={profile.company}
                placeholder="Company name"
                autoComplete="organization"
              >
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-4 inline-flex items-center text-slate-400">
                    <BuildingOffice2Icon className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="text"
                    name="company"
                    defaultValue={profile.company ?? ""}
                    placeholder="Company name"
                    autoComplete="organization"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[#f97316]/20"
                  />
                </div>
              </Field>
            </div>
          </SectionCard>

          <SectionCard title="Contact Information" icon={EnvelopeIcon}>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={customer.email}
                placeholder="name@example.com"
                autoComplete="email"
              >
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-4 inline-flex items-center text-slate-400">
                    <EnvelopeIcon className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="email"
                    name="email"
                    defaultValue={customer.email ?? ""}
                    placeholder="name@example.com"
                    autoComplete="email"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[#f97316]/20"
                  />
                </div>
              </Field>
              <Field
                label="Phone"
                name="phone"
                type="tel"
                defaultValue={customer.phone}
                placeholder="Phone number"
                autoComplete="tel"
              >
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-4 inline-flex items-center text-slate-400">
                    <PhoneIcon className="h-4.5 w-4.5" />
                  </span>
                  <input
                    type="tel"
                    name="phone"
                    defaultValue={customer.phone ?? ""}
                    placeholder="Phone number"
                    autoComplete="tel"
                    className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-300 focus:ring-2 focus:ring-[#f97316]/20"
                  />
                </div>
              </Field>
              <div className="sm:col-span-2">
                <ContactMethodSelect defaultValue={profile.preferredContactMethod} />
              </div>
            </div>
          </SectionCard>

          <section className="xl:col-span-2">
            <SectionCard title="Address" icon={MapPinIcon}>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="sm:col-span-2 lg:col-span-4">
                  <Field
                    label="Street address"
                    name="street_address"
                    defaultValue={customer.primary_street}
                    placeholder="Street address"
                    autoComplete="street-address"
                  />
                </div>
                <Field
                  label="City"
                  name="city"
                  defaultValue={customer.primary_city}
                  placeholder="City"
                  autoComplete="address-level2"
                />
                <Field
                  label="State"
                  name="state"
                  defaultValue={customer.primary_state}
                  placeholder="State"
                  autoComplete="address-level1"
                />
                <Field
                  label="ZIP code"
                  name="zip_code"
                  defaultValue={customer.primary_zip}
                  placeholder="ZIP code"
                  autoComplete="postal-code"
                />
              </div>
            </SectionCard>
          </section>
        </div>
      </form>
    </PortalShell>
  );
}
