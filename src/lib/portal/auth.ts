import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { recordEntityHistory } from "@/lib/entity-history";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getCurrentTenant, getServerTenantStorageKey } from "@/lib/tenant/server";
import { TENANT_STORAGE_KEYS } from "@/lib/tenant/runtime";
import { getBusinessTimeZone } from "@/lib/time";
import { normalizeEmail } from "@/lib/customers";
import { isPortalSchemaError } from "./schema";

export const PORTAL_LOGIN_COOLDOWN_SECONDS = 60;

type PortalCustomer = {
  id: string;
  customerId: string;
  businessId: string;
  authUserId: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  primary_street: string | null;
  primary_city: string | null;
  primary_state: string | null;
  primary_zip: string | null;
  portal_status: "invited" | "active" | "deactivated";
  last_login_at: string | null;
  portal_activated_at?: string | null;
  deactivated_at?: string | null;
  deactivation_reason?: string | null;
};

type PortalCustomerRow = PortalCustomer & {
  auth_user_id?: string | null;
  normalized_email?: string | null;
};

const PORTAL_CUSTOMER_SELECT =
  "id, name, email, phone, primary_street, primary_city, primary_state, primary_zip, portal_status, last_login_at, portal_activated_at, auth_user_id, normalized_email, deactivated_at, deactivation_reason";
const PORTAL_CUSTOMER_FALLBACK_SELECT =
  "id, name, email, phone, primary_street, primary_city, primary_zip";
const PORTAL_CUSTOMER_ID_ONLY_SELECT = "id";

export const PORTAL_CUSTOMER_NOT_LINKED_ERROR = "PORTAL_CUSTOMER_NOT_LINKED";

export async function getPortalAccessTokenCookieName() {
  return getServerTenantStorageKey(TENANT_STORAGE_KEYS.portalAccessToken);
}

export async function getPortalRefreshTokenCookieName() {
  return getServerTenantStorageKey(TENANT_STORAGE_KEYS.portalRefreshToken);
}

async function lookupPortalCustomerByAuthUserId(userId: string, businessId: string) {
  let lookup = await supabaseAdmin
    .from("customers")
    .select(PORTAL_CUSTOMER_SELECT)
    .eq("business_id", businessId)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (lookup.error && isPortalSchemaError(lookup.error)) {
    lookup = await supabaseAdmin
      .from("customers")
      .select(PORTAL_CUSTOMER_FALLBACK_SELECT)
      .eq("business_id", businessId)
      .eq("auth_user_id", userId)
      .maybeSingle();
  }

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  return (lookup.data as PortalCustomerRow | null) ?? null;
}

async function lookupPortalCustomerByEmail(normalizedEmail: string, businessId: string) {
  let lookup = await supabaseAdmin
    .from("customers")
    .select(PORTAL_CUSTOMER_SELECT)
    .eq("business_id", businessId)
    .eq("normalized_email", normalizedEmail)
    .maybeSingle();

  if (lookup.error && isPortalSchemaError(lookup.error)) {
    lookup = await supabaseAdmin
      .from("customers")
      .select(PORTAL_CUSTOMER_FALLBACK_SELECT)
      .eq("business_id", businessId)
      .ilike("email", normalizedEmail)
      .maybeSingle();
  }

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  return (lookup.data as PortalCustomerRow | null) ?? null;
}

async function verifyPortalCustomerRecord(customerId: string, businessId: string) {
  let lookup = await supabaseAdmin
    .from("customers")
    .select(PORTAL_CUSTOMER_ID_ONLY_SELECT)
    .eq("id", customerId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (lookup.error && isPortalSchemaError(lookup.error)) {
    lookup = await supabaseAdmin
      .from("customers")
      .select("id")
      .eq("id", customerId)
      .eq("business_id", businessId)
      .maybeSingle();
  }

  if (lookup.error) {
    throw new Error(lookup.error.message);
  }

  if (!lookup.data?.id) {
    throw new Error(PORTAL_CUSTOMER_NOT_LINKED_ERROR);
  }

  return lookup.data.id as string;
}

export function createPortalAuthClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  return createClient(url, anonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

export function devPortalLog(event: string, details: Record<string, unknown>) {
  if (process.env.NODE_ENV !== "development") return;
  console.info("[portal-auth]", {
    event,
    ...details,
  });
}

export async function attachPortalAuthUserToCustomer(customerId: string, userId: string) {
  const now = new Date().toISOString();
  const tenant = await getCurrentTenant();

  let targetLookup = await supabaseAdmin
    .from("customers")
    .select("id, auth_user_id, portal_activated_at")
    .eq("id", customerId)
    .eq("business_id", tenant.id)
    .maybeSingle();

  if (targetLookup.error && isPortalSchemaError(targetLookup.error)) {
    targetLookup = await supabaseAdmin
      .from("customers")
      .select("id, auth_user_id")
      .eq("id", customerId)
      .eq("business_id", tenant.id)
      .maybeSingle();
  }

  if (targetLookup.error && !isPortalSchemaError(targetLookup.error)) {
    throw new Error(targetLookup.error.message);
  }

  const targetCustomer = targetLookup.data as {
    id: string;
    auth_user_id: string | null;
    portal_activated_at?: string | null;
  } | null;
  if (!targetCustomer?.id) {
    throw new Error("Portal customer could not be found for auth attachment.");
  }

  const existingLinkLookup = await supabaseAdmin
    .from("customers")
    .select("id, auth_user_id")
    .eq("business_id", tenant.id)
    .eq("auth_user_id", userId)
    .maybeSingle();

  if (existingLinkLookup.error && !isPortalSchemaError(existingLinkLookup.error)) {
    throw new Error(existingLinkLookup.error.message);
  }

  const existingLinkedCustomer = existingLinkLookup.data as { id: string; auth_user_id: string | null } | null;

  if (existingLinkedCustomer?.id && existingLinkedCustomer.id !== customerId) {
    const { error: clearError } = await supabaseAdmin
      .from("customers")
      .update({ auth_user_id: null })
      .eq("id", existingLinkedCustomer.id)
      .eq("business_id", tenant.id);

    if (clearError && !isPortalSchemaError(clearError)) {
      throw new Error(clearError.message);
    }
  }

  if (targetCustomer.auth_user_id === userId) {
    const { error: refreshError } = await supabaseAdmin
      .from("customers")
      .update({
        portal_status: "active",
        last_login_at: now,
      })
      .eq("id", customerId)
      .eq("business_id", tenant.id);

    if (refreshError && !isPortalSchemaError(refreshError)) {
      throw new Error(refreshError.message);
    }

    return;
  }

  const attachFields = {
    auth_user_id: userId,
    portal_status: "active",
    last_login_at: now,
  };

  const { error: attachError } = await supabaseAdmin
    .from("customers")
    .update(attachFields)
    .eq("id", customerId)
    .eq("business_id", tenant.id);

  if (attachError && isPortalSchemaError(attachError)) {
    return;
  }

  if (attachError && !isPortalSchemaError(attachError)) {
    throw new Error(attachError.message);
  }

  if (!targetCustomer.portal_activated_at) {
    const { error: activationError } = await supabaseAdmin
      .from("customers")
      .update({ portal_activated_at: now })
      .eq("id", customerId)
      .eq("business_id", tenant.id)
      .is("portal_activated_at", null);

    if (activationError && !isPortalSchemaError(activationError)) {
      throw new Error(activationError.message);
    }
  }
}

export async function clearPortalSessionCookies() {
  const cookieStore = await cookies();
  const [accessTokenCookie, refreshTokenCookie] = await Promise.all([
    getPortalAccessTokenCookieName(),
    getPortalRefreshTokenCookieName(),
  ]);

  cookieStore.set(accessTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
  cookieStore.set(refreshTokenCookie, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function setPortalSessionCookies(accessToken: string, refreshToken?: string | null) {
  const cookieStore = await cookies();
  const [accessTokenCookie, refreshTokenCookie] = await Promise.all([
    getPortalAccessTokenCookieName(),
    getPortalRefreshTokenCookieName(),
  ]);

  cookieStore.set(accessTokenCookie, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  if (refreshToken) {
    cookieStore.set(refreshTokenCookie, refreshToken, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
  }
}

export async function getOptionalPortalCustomer(): Promise<PortalCustomer | null> {
  const cookieStore = await cookies();
  const accessTokenCookie = await getPortalAccessTokenCookieName();
  const accessToken = cookieStore.get(accessTokenCookie)?.value;

  if (!accessToken) return null;

  const authClient = createPortalAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) return null;

  const user = data.user;
  const normalizedUserEmail = normalizeEmail(user.email);
  const tenant = await getCurrentTenant();

  let customer: PortalCustomerRow | null = null;

  customer = await lookupPortalCustomerByAuthUserId(user.id, tenant.id);

  if (!customer && normalizedUserEmail) {
    customer = await lookupPortalCustomerByEmail(normalizedUserEmail, tenant.id);

    if (customer?.id && !customer.auth_user_id) {
      await attachPortalAuthUserToCustomer(customer.id, user.id);
      customer.auth_user_id = user.id;
      customer.portal_status = "active";
      customer.last_login_at = new Date().toISOString();
    }
  }

  if (!customer) return null;
  if ((customer.portal_status ?? "active") === "deactivated") return null;

  const verifiedCustomerId = await verifyPortalCustomerRecord(customer.id, tenant.id);
  devPortalLog("portal_customer_resolved", {
    authUserId: user.id,
    customerId: verifiedCustomerId,
    matchedCustomerRowId: customer.id,
    email: user.email ?? null,
  });

  return {
    id: verifiedCustomerId,
    customerId: verifiedCustomerId,
    businessId: tenant.id,
    authUserId: user.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    primary_street: customer.primary_street,
    primary_city: customer.primary_city,
    primary_state: customer.primary_state,
    primary_zip: customer.primary_zip,
    portal_status: customer.portal_status ?? "active",
    last_login_at: customer.last_login_at ?? null,
    portal_activated_at: customer.portal_activated_at ?? null,
  };
}

async function recordPortalAccess(customer: Pick<PortalCustomer, "businessId" | "customerId">) {
  const now = new Date();
  const occurredAt = now.toISOString();
  const occurredOn = formatDateInTimeZone(now, getBusinessTimeZone());

  const { error } = await supabaseAdmin
    .from("portal_activity_events")
    .upsert(
      {
        business_id: customer.businessId,
        customer_id: customer.customerId,
        event_type: "portal_accessed",
        occurred_at: occurredAt,
        occurred_on: occurredOn,
      },
      {
        onConflict: "business_id,customer_id,event_type,occurred_on",
        ignoreDuplicates: true,
      },
    );

  if (error) {
    console.warn("[portal-auth] failed to record portal access", {
      businessId: customer.businessId,
      customerId: customer.customerId,
      error: error.message,
    });
  }
}

function formatDateInTimeZone(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const lookup = new Map(parts.map((part) => [part.type, part.value]));

  return `${lookup.get("year")}-${lookup.get("month")}-${lookup.get("day")}`;
}

export async function deactivatePortalAccess(
  customerId: string,
  reason = "Customer requested portal deactivation",
) {
  const now = new Date().toISOString();
  const tenant = await getCurrentTenant();
  const { error } = await supabaseAdmin
    .from("customers")
    .update({
      portal_status: "deactivated",
      deactivated_at: now,
      deactivation_reason: reason,
    })
    .eq("id", customerId)
    .eq("business_id", tenant.id);

  if (error) throw new Error(error.message);

  await recordEntityHistory(supabaseAdmin, [
    {
      entityType: "customer",
      entityId: customerId,
      fieldName: "portal_status",
      oldValue: "active",
      newValue: "deactivated",
      changedByType: "customer",
      changeReason: reason,
    },
  ], tenant.id);
}

export async function requirePortalCustomer() {
  const customer = await getOptionalPortalCustomer();
  if (!customer) redirect("/portal/login");
  try {
    await recordPortalAccess(customer);
  } catch (error) {
    console.warn("[portal-auth] failed to record portal access", {
      businessId: customer.businessId,
      customerId: customer.customerId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
  return customer;
}
