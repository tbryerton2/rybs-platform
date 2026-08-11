import "server-only";

import { createClient, type User } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE = "tcm_platform_admin_access_token";
export const PLATFORM_ADMIN_REFRESH_TOKEN_COOKIE = "tcm_platform_admin_refresh_token";
export const PLATFORM_ADMIN_AUTH_COOKIE_PATH = "/";
const LEGACY_PLATFORM_ADMIN_AUTH_COOKIE_PATH = "/platform-admin";

export const platformAdminAuthCookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: PLATFORM_ADMIN_AUTH_COOKIE_PATH,
};

export type PlatformAdminRole = "owner" | "admin";
export type PlatformAdminMembershipStatus = "active" | "disabled";

export type PlatformAdminMembership = {
  id: string;
  authUserId: string;
  role: PlatformAdminRole;
  status: PlatformAdminMembershipStatus;
  createdAt: string;
  updatedAt: string;
};

type PlatformAdminMembershipRow = {
  id: string;
  auth_user_id: string;
  role: PlatformAdminRole;
  status: PlatformAdminMembershipStatus;
  created_at: string;
  updated_at: string;
};

export type PlatformAdminSessionContext = {
  user: User;
  membership: PlatformAdminMembership;
};

export class PlatformAdminAccessDeniedError extends Error {
  constructor(message = "Platform admin access is required.") {
    super(message);
    this.name = "PlatformAdminAccessDeniedError";
  }
}

export function createPlatformAdminAuthClient() {
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

export function setPlatformAdminSessionCookies(
  response: NextResponse,
  input: {
    accessToken: string;
    refreshToken?: string | null;
  },
) {
  response.cookies.set(PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE, input.accessToken, {
    ...platformAdminAuthCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (input.refreshToken) {
    response.cookies.set(PLATFORM_ADMIN_REFRESH_TOKEN_COOKIE, input.refreshToken, {
      ...platformAdminAuthCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

export async function setPlatformAdminSessionCookiesFromServerAction(input: {
  accessToken: string;
  refreshToken?: string | null;
}) {
  const cookieStore = await cookies();

  cookieStore.set(PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE, input.accessToken, {
    ...platformAdminAuthCookieOptions,
    maxAge: 60 * 60 * 24 * 7,
  });

  if (input.refreshToken) {
    cookieStore.set(PLATFORM_ADMIN_REFRESH_TOKEN_COOKIE, input.refreshToken, {
      ...platformAdminAuthCookieOptions,
      maxAge: 60 * 60 * 24 * 30,
    });
  }
}

function serializeExpiredPlatformAdminCookie(name: string, path: string, domain?: string) {
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

function getPlatformAdminCookieClearDomains(hostname?: string | null) {
  if (!hostname) return [] as string[];
  const normalized = hostname.split(":")[0]?.trim().toLowerCase();
  if (normalized === "localhost") return ["localhost"];
  return [];
}

export function clearPlatformAdminSessionCookies(response: NextResponse, hostname?: string | null) {
  const domains = getPlatformAdminCookieClearDomains(hostname);

  for (const cookieName of [PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE, PLATFORM_ADMIN_REFRESH_TOKEN_COOKIE]) {
    for (const path of [PLATFORM_ADMIN_AUTH_COOKIE_PATH, LEGACY_PLATFORM_ADMIN_AUTH_COOKIE_PATH]) {
      response.headers.append("Set-Cookie", serializeExpiredPlatformAdminCookie(cookieName, path));

      for (const domain of domains) {
        response.headers.append("Set-Cookie", serializeExpiredPlatformAdminCookie(cookieName, path, domain));
      }
    }
  }
}

function mapPlatformAdminMembership(row: PlatformAdminMembershipRow): PlatformAdminMembership {
  return {
    id: row.id,
    authUserId: row.auth_user_id,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getOptionalPlatformAdminSession(): Promise<PlatformAdminSessionContext | null> {
  const result = await resolvePlatformAdminSession();
  return result.status === "authorized" ? result.session : null;
}

type PlatformAdminSessionResolution =
  | { status: "unauthenticated" }
  | { status: "unauthorized"; user: User }
  | { status: "authorized"; session: PlatformAdminSessionContext };

async function resolvePlatformAdminSession(): Promise<PlatformAdminSessionResolution> {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE)?.value;
  const matchingAccessCookies = cookieStore.getAll(PLATFORM_ADMIN_ACCESS_TOKEN_COOKIE);

  if (process.env.NODE_ENV === "development") {
    console.info("[platform-admin-auth]", {
      event: "resolve_platform_admin_session_cookie_check",
      hasAccessCookie: Boolean(accessToken),
      accessCookieCount: matchingAccessCookies.length,
    });
  }

  if (!accessToken) return { status: "unauthenticated" };

  const authClient = createPlatformAdminAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) return { status: "unauthenticated" };

  const membershipLookup = await supabaseAdmin
    .from("platform_admin_memberships")
    .select("id, auth_user_id, role, status, created_at, updated_at")
    .eq("auth_user_id", data.user.id)
    .eq("status", "active")
    .maybeSingle();

  if (membershipLookup.error || !membershipLookup.data) {
    return { status: "unauthorized", user: data.user };
  }

  return {
    status: "authorized",
    session: {
      user: data.user,
      membership: mapPlatformAdminMembership(membershipLookup.data as PlatformAdminMembershipRow),
    },
  };
}

export async function requirePlatformAdmin(): Promise<PlatformAdminSessionContext> {
  const result = await resolvePlatformAdminSession();

  if (result.status === "unauthenticated") {
    redirect("/platform-admin/login");
  }

  if (result.status === "unauthorized") {
    throw new PlatformAdminAccessDeniedError();
  }

  return result.session;
}

export async function requirePlatformAdminForApi(): Promise<
  | { ok: true; session: PlatformAdminSessionContext }
  | { ok: false; response: NextResponse<{ ok: false; error: string }> }
> {
  const result = await resolvePlatformAdminSession();

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
