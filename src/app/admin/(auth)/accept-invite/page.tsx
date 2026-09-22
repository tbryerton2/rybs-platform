import { Suspense } from "react";
import { ADMIN_INVITE_BUSINESS_PARAM } from "@/lib/admin/invite-acceptance";
import { findTenantByIdStrict, getBrandSettingsForTenant } from "@/lib/tenant/server";
import { AdminAcceptInviteClient } from "./admin-accept-invite-client";

type SearchParams = Record<string, string | string[] | undefined>;

function readValue(params: SearchParams, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

async function getInvitedBusinessName(searchParams: SearchParams) {
  const businessId = readValue(searchParams, ADMIN_INVITE_BUSINESS_PARAM)?.trim();
  if (!businessId) return null;

  const tenant = await findTenantByIdStrict(businessId, { requireActive: true }).catch(() => null);
  if (!tenant) return null;

  const brand = await getBrandSettingsForTenant(tenant);
  return brand.name;
}

export default async function AdminAcceptInvitePage({
  searchParams,
}: {
  searchParams?: Promise<SearchParams>;
}) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const businessName = await getInvitedBusinessName(resolvedSearchParams);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-10rem)] max-w-3xl items-center px-4 py-12 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="w-full rounded-[20px] border border-slate-200 bg-white px-6 py-10 text-center shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
            <div className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-400">
              Admin invitation
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
              Verifying invite
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-500">
              Please wait while we check your secure invitation.
            </p>
          </div>
        }
      >
        <AdminAcceptInviteClient businessName={businessName} />
      </Suspense>
    </main>
  );
}
