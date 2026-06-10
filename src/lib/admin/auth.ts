import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant, type TenantRecord } from "@/lib/tenant/server";

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
  business: TenantRecord;
  membership: AdminMembership;
};

export class AdminAccessDeniedError extends Error {
  constructor(message = "Admin owner access is required.") {
    super(message);
    this.name = "AdminAccessDeniedError";
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
  | { status: "unauthorized"; user: User; business: TenantRecord }
  | { status: "authorized"; session: AdminSessionContext };

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

  const business = await getCurrentTenant();
  const membershipLookup = await supabaseAdmin
    .from("business_admin_memberships")
    .select("id, business_id, auth_user_id, role, status, created_at, updated_at")
    .eq("business_id", business.id)
    .eq("auth_user_id", data.user.id)
    .eq("role", "owner")
    .eq("status", "active")
    .maybeSingle();

  if (membershipLookup.error || !membershipLookup.data) {
    return { status: "unauthorized", user: data.user, business };
  }

  return {
    status: "authorized",
    session: {
      user: data.user,
      business,
      membership: mapAdminMembership(membershipLookup.data as AdminMembershipRow),
    },
  };
}

export async function requireAdminOwner(): Promise<AdminSessionContext> {
  const result = await resolveAdminSession();

  if (result.status === "unauthenticated") {
    redirect("/admin/login");
  }

  if (result.status === "unauthorized") {
    throw new AdminAccessDeniedError();
  }

  return result.session;
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
      response: NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, session: result.session };
}
