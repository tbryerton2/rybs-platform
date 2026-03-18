import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { normalizeEmail } from "@/lib/customers";
import { isPortalSchemaError } from "./schema";

export const PORTAL_ACCESS_TOKEN_COOKIE = "tcm_portal_access_token";
export const PORTAL_REFRESH_TOKEN_COOKIE = "tcm_portal_refresh_token";
export const PORTAL_LOGIN_COOLDOWN_SECONDS = 60;

type PortalCustomer = {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  primary_street: string | null;
  primary_city: string | null;
  primary_zip: string | null;
  portal_status: "invited" | "active" | "disabled";
  last_login_at: string | null;
};

type PortalCustomerRow = PortalCustomer & {
  auth_user_id?: string | null;
  normalized_email?: string | null;
};

const PORTAL_CUSTOMER_SELECT =
  "id, name, email, phone, primary_street, primary_city, primary_zip, portal_status, last_login_at, auth_user_id, normalized_email";
const PORTAL_CUSTOMER_FALLBACK_SELECT = "id, name, email, phone, primary_street, primary_city, primary_zip";

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

export async function clearPortalSessionCookies() {
  const cookieStore = await cookies();
  cookieStore.set(PORTAL_ACCESS_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
  cookieStore.set(PORTAL_REFRESH_TOKEN_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });
}

export async function setPortalSessionCookies(accessToken: string, refreshToken?: string | null) {
  const cookieStore = await cookies();

  cookieStore.set(PORTAL_ACCESS_TOKEN_COOKIE, accessToken, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });

  if (refreshToken) {
    cookieStore.set(PORTAL_REFRESH_TOKEN_COOKIE, refreshToken, {
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
  const accessToken = cookieStore.get(PORTAL_ACCESS_TOKEN_COOKIE)?.value;

  if (!accessToken) return null;

  const authClient = createPortalAuthClient();
  const { data, error } = await authClient.auth.getUser(accessToken);

  if (error || !data.user) return null;

  const user = data.user;
  const normalizedUserEmail = normalizeEmail(user.email);

  let customer: PortalCustomerRow | null = null;

  const authLookup = await supabaseAdmin
    .from("customers")
    .select(PORTAL_CUSTOMER_SELECT)
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (authLookup.error && !isPortalSchemaError(authLookup.error)) {
    throw new Error(authLookup.error.message);
  }

  customer = (authLookup.data as PortalCustomerRow | null) ?? null;

  if (!customer && normalizedUserEmail) {
    let lookup = await supabaseAdmin
      .from("customers")
      .select(PORTAL_CUSTOMER_SELECT)
      .eq("normalized_email", normalizedUserEmail)
      .maybeSingle();

    if (lookup.error && isPortalSchemaError(lookup.error)) {
      lookup = await supabaseAdmin
        .from("customers")
        .select(PORTAL_CUSTOMER_FALLBACK_SELECT)
        .ilike("email", normalizedUserEmail)
        .maybeSingle();
    }

    if (lookup.error) throw new Error(lookup.error.message);
    customer = (lookup.data as PortalCustomerRow | null) ?? null;

    if (customer?.id && !customer.auth_user_id) {
      const { error: attachError } = await supabaseAdmin
        .from("customers")
        .update({ auth_user_id: user.id, portal_status: "active", last_login_at: new Date().toISOString() })
        .eq("id", customer.id);

      if (attachError && !isPortalSchemaError(attachError)) {
        throw new Error(attachError.message);
      }

      if (!attachError) {
        customer.auth_user_id = user.id;
        customer.portal_status = "active";
        customer.last_login_at = new Date().toISOString();
      }
    }
  }

  if (!customer) return null;
  if ((customer.portal_status ?? "active") === "disabled") return null;

  return {
    id: customer.id,
    name: customer.name,
    email: customer.email,
    phone: customer.phone,
    primary_street: customer.primary_street,
    primary_city: customer.primary_city,
    primary_zip: customer.primary_zip,
    portal_status: customer.portal_status ?? "active",
    last_login_at: customer.last_login_at ?? null,
  };
}

export async function requirePortalCustomer() {
  const customer = await getOptionalPortalCustomer();
  if (!customer) redirect("/portal/login");
  return customer;
}
