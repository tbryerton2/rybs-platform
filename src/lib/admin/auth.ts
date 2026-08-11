import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getBrandSettingsForTenant, type TenantRecord } from "@/lib/tenant/server";

export const ADMIN_ACCESS_TOKEN_COOKIE = "tcm_admin_access_token";
export const ADMIN_REFRESH_TOKEN_COOKIE = "tcm_admin_refresh_token";
export const ADMIN_AUTH_COOKIE_PATH = "/";
const LEGACY_ADMIN_AUTH_COOKIE_PATH = "/admin";

export const adminAuthCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: ADMIN_AUTH_COOKIE_PATH,
};

export type AdminMembershipRole = "owner";
export type AdminMembershipStatus = "active" | "disabled";

export type AdminMembership = {
  id: string;
  businessId: string;
  authUserId: string;
  role: AdminMembershipRole;
  status: AdminMembershipStatus;
  createdAt: string;
  updatedAt: string;
};

type AdminMembershipRow = {
  id: string;
  business_id: string;
  auth_user_id: string;
  role: AdminMembershipRole;
  status: AdminMembershipStatus;
  created_at: string;
  updated_at: string;
};

export type AdminSessionContext = {
  user: User;
  userId: string;
  email?: string;
  businessId: string;
  tenant: {
    id: string;
    slug: string;
    status: TenantRecord["status"];
    name: string;
  };
  business: TenantRecord & { name: string };
  membership: AdminMembership;
};

export type AdminAccessDeniedReason =
  | "no_active_membership"
  | "multiple_active_memberships"
  | "inactive_tenant";

export class AdminAccessDeniedError extends Error {
  reason: AdminAccessDeniedReason;

  constructor(
    message = "Admin owner access is required.",
    reason: AdminAccessDeniedReason = "no_active_membership",
  ) {
    super(message);
    this.name = "AdminAccessDeniedError";
    this.reason = reason;
  }
}

export function createAdminAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  }

  if (!anonKey) {
    throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  }

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function setAdminSessionCookies(
  response: NextResponse,
  input: {
    accessToken: string;
    refreshToken?: string | null;
  },
) {
  response.cookies.set(ADMIN_ACCESS_TOKEN_COOKIE, input.accessToken, {
    ...adminAuthCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (input.refreshToken) {
    response.cookies.set(ADMIN_REFRESH_TOKEN_COOKIE, input.refreshToken, {
      ...adminAuthCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function setAdminSessionCookiesFromServerAction(input: {
  accessToken: string;
  refreshToken?: string | null;
}) {
  const cookieStore = await cookies();

  cookieStore.set(ADMIN_ACCESS_TOKEN_COOKIE, input.accessToken, {
    ...adminAuthCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (input.refreshToken) {
    cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, input.refreshToken, {
      ...adminAuthCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

function serializeExpiredAdminCookie(name: string, path: string, domain?: string) {
  const parts = [
    `${name}=`,
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    `Path=${path}`,
    "HttpOnly",
    "SameSite=Lax",
  ];

  if (process.env.NODE_ENV === "production") {
    parts.push("Secure");
  }

  if (domain) {
    parts.push(`Domain=${domain}`);
  }

  return parts.join("; ");
}

function getAdminCookieClearDomains(hostname?: string | null) {
  if (!hostname) return [] as string[];
  const normalized = hostname.split(":")[0]?.trim().toLowerCase();
  if (normalized === "localhost") return ["localhost"];
  return [];
}

export function clearAdminSessionCookies(response: NextResponse, hostname?: string | null) {
  const domains = getAdminCookieClearDomains(hostname);

  for (const cookieName of [ADMIN_ACCESS_TOKEN_COOKIE, ADMIN_REFRESH_TOKEN_COOKIE]) {
    for (const path of [ADMIN_AUTH_COOKIE_PATH, LEGACY_ADMIN_AUTH_COOKIE_PATH]) {
      response.headers.append("Set-Cookie", serializeExpiredAdminCookie(cookieName, path));

      for (const domain of domains) {
        response.headers.append("Set-Cookie", serializeExpiredAdminCookie(cookieName, path, domain));
      }
    }
  }
}

function mapAdminMembership(row: AdminMembershipRow): AdminMembership {
  return {
    id: row.id,
    businessId: row.business_id,
    authUserId: row.auth_user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOptionalAdminSession(): Promise<AdminSessionContext | null> {
  const result = await resolveAdminSession();
  return result.status === "authorized" ? result.session : null;
}

type AdminSessionResolution =
  | { status: "unauthenticated" }
  | { status: "unauthorized"; user: User; reason: AdminAccessDeniedReason }
  | { status: "authorized"; session: AdminSessionContext };

type TenantLookupRow = TenantRecord;

async function loadAdminBusinessTenant(membership: AdminMembership) {
  const { data, error } = await supabaseAdmin
    .from("tenants")
    .select("id, slug, status, created_at, updated_at")
    .eq("id", membership.businessId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data || (data as TenantLookupRow).status !== "active") {
    return null;
  }

  const tenant = data as TenantLookupRow;
  const brand = await getBrandSettingsForTenant(tenant);

  return {
    ...tenant,
    name: brand.name,
  };
}

export function buildAdminBusinessContext(input: {
  user: User;
  membership: AdminMembership;
  business: TenantRecord & { name: string };
}): AdminSessionContext {
  return {
    user: input.user,
    userId: input.user.id,
    email: input.user.email ?? undefined,
    businessId: input.business.id,
    tenant: {
      id: input.business.id,
      slug: input.business.slug,
      status: input.business.status,
      name: input.business.name,
    },
    business: input.business,
    membership: input.membership,
  };
}

async function resolveAdminSession(): Promise<AdminSessionResolution> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const matchingAccessCookies = cookieStore.getAll(ADMIN_ACCESS_TOKEN_COOKIE);

  if (process.env.NODE_ENV === "development") {
    console.info("[admin-auth]", {
      event: "resolve_admin_session_cookie_check",
      hasAccessCookie: Boolean(accessToken),
      accessCookieCount: matchingAccessCookies.length,
    });
  }

  if (!accessToken) return { status: "unauthenticated" };

  const authClient = createAdminAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) return { status: "unauthenticated" };

  const membershipLookup = await supabaseAdmin
    .from("business_admin_memberships")
    .select("id, business_id, auth_user_id, role, status, created_at, updated_at")
    .eq("auth_user_id", data.user.id)
    .eq("role", "owner")
    .eq("status", "active");

  if (membershipLookup.error) {
    throw new Error(membershipLookup.error.message);
  }

  const memberships = ((membershipLookup.data ?? []) as AdminMembershipRow[]).map(mapAdminMembership);

  if (memberships.length === 0) {
    return { status: "unauthorized", user: data.user, reason: "no_active_membership" };
  }

  if (memberships.length > 1) {
    return { status: "unauthorized", user: data.user, reason: "multiple_active_memberships" };
  }

  const membership = memberships[0];
  if (!membership) {
    return { status: "unauthorized", user: data.user, reason: "no_active_membership" };
  }

  const business = await loadAdminBusinessTenant(membership);

  if (!business) {
    return { status: "unauthorized", user: data.user, reason: "inactive_tenant" };
  }

  return {
    status: "authorized",
    session: buildAdminBusinessContext({
      user: data.user,
      business,
      membership,
    }),
  };
}

export async function getAdminBusinessContext() {
  return getOptionalAdminSession();
}

export async function requireAdminOwner(): Promise<AdminSessionContext> {
  const result = await resolveAdminSession();

  if (result.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (result.status === "unauthorized") {
    throw new AdminAccessDeniedError(getAdminAccessDeniedMessage(result.reason), result.reason);
  }

  return result.session;
}

export const requireAdminBusinessContext = requireAdminOwner;

function getAdminAccessDeniedMessage(reason: AdminAccessDeniedReason) {
  switch (reason) {
    case "multiple_active_memberships":
      return "Multiple business memberships were found. Business switching is not available yet.";
    case "inactive_tenant":
      return "Your business is inactive. Contact support before using the admin.";
    case "no_active_membership":
      return "This account does not have active business admin access.";
  }
}

export async function requireAdminOwnerForApi(): Promise<
  | { ok: true; session: AdminSessionContext }
  | { ok: false; response: NextResponse<{ ok: false; error: string }> }
> {
  const result = await resolveAdminSession();

  if (result.status === "unauthenticated") {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 }),
    };
  }

  if (result.status === "unauthorized") {
    return {
      ok: false,
      response: NextResponse.json({ ok: false, error: getAdminAccessDeniedMessage(result.reason) }, { status: 403 }),
    };
  }

  return { ok: true, session: result.session };
}

export const requireAdminBusinessContextForApi = requireAdminOwnerForApi;
