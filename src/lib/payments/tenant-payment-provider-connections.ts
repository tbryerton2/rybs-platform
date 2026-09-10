import "server-only";

import { createCipheriv, createDecipheriv, randomBytes, randomUUID } from "node:crypto";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { findTenantByIdStrict, type TenantRecord } from "@/lib/tenant/server";
import type {
  PaymentProvider,
  PaymentProviderConnectionContext,
  PaymentProviderEnvironment,
} from "./types";

const LEGACY_TAN_CAN_MAN_SLUG = "tan-can-man";
const DEFAULT_PAYMENT_PROVIDER = "square" satisfies PaymentProvider;
const TOKEN_CIPHER_VERSION = 1;
const SQUARE_API_VERSION = "2026-08-19";
export const SQUARE_OAUTH_CALLBACK_PATH = "/admin/settings/payments/square/callback";
export const SQUARE_OAUTH_SCOPES = [
  "MERCHANT_PROFILE_READ",
  "PAYMENTS_READ",
  "PAYMENTS_WRITE",
  "CUSTOMERS_READ",
  "CUSTOMERS_WRITE",
  "CARDS_READ",
  "CARDS_WRITE",
] as const;
const TOKEN_KEY_ENV_NAMES = [
  "PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY",
  "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY",
] as const;
const SQUARE_OAUTH_APPLICATION_ID_ENV_NAMES = [
  "SQUARE_OAUTH_APPLICATION_ID",
  "SQUARE_APPLICATION_ID",
  "NEXT_PUBLIC_SQUARE_APPLICATION_ID",
] as const;
const SQUARE_OAUTH_APPLICATION_SECRET_ENV_NAMES = [
  "SQUARE_OAUTH_APPLICATION_SECRET",
  "SQUARE_APPLICATION_SECRET",
] as const;

const TENANT_PAYMENT_PROVIDER_CONNECTION_SELECT =
  "id, business_id, provider, provider_environment, status, provider_merchant_id, provider_location_id, encrypted_access_token, token_cipher_version, token_cipher_key_id";

const TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT =
  "id, business_id, provider, provider_environment, status, provider_merchant_id, provider_location_id, provider_location_name, granted_scopes, encrypted_access_token, encrypted_refresh_token, token_cipher_version, token_cipher_key_id, access_token_expires_at, token_refreshed_at, connected_by, connected_at, revoked_at, last_error, created_at, updated_at";

const TENANT_PAYMENT_PROVIDER_CONNECTION_REFERENCE_SELECT =
  "id, business_id, provider, provider_environment, status, provider_merchant_id, provider_location_id";

type TenantPaymentProviderConnectionRow = {
  id: string;
  business_id: string;
  provider: string;
  provider_environment: string;
  status: string;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
  encrypted_access_token: string | null;
  token_cipher_version: number | null;
  token_cipher_key_id: string | null;
};

type TenantPaymentProviderConnectionAdminRow = TenantPaymentProviderConnectionRow & {
  provider_location_name: string | null;
  granted_scopes: string[] | null;
  encrypted_refresh_token: string | null;
  access_token_expires_at: string | null;
  token_refreshed_at: string | null;
  connected_by: string | null;
  connected_at: string | null;
  revoked_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
};

type TenantPaymentProviderConnectionReferenceRow = {
  id: string;
  business_id: string;
  provider: string;
  provider_environment: string;
  status: string;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
};

export type TenantPaymentProviderConnectionReference = {
  id: string;
  businessId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  providerMerchantId: string | null;
  providerLocationId: string | null;
};

export type TenantPaymentProviderConnectionAdminSummary = {
  id: string;
  businessId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  status: string;
  providerMerchantId: string | null;
  providerLocationId: string | null;
  providerLocationName: string | null;
  grantedScopes: string[];
  expiresAt: string | null;
  connectedBy: string | null;
  connectedAt: string | null;
  revokedAt: string | null;
  lastError: string | null;
  createdAt: string;
  updatedAt: string;
  canLoadLocations: boolean;
  canRevokeAccess: boolean;
};

export type SquareOAuthConfigurationStatus = {
  environment: PaymentProviderEnvironment;
  configured: boolean;
  missing: string[];
  applicationIdConfigured: boolean;
  applicationSecretConfigured: boolean;
  redirectUrlConfigured: boolean;
  tokenEncryptionKeyConfigured: boolean;
  redirectUrl: string | null;
  webhookSignatureConfigured: boolean;
  webhookNotificationUrl: string | null;
};

type SquareOAuthRuntimeConfiguration = {
  environment: PaymentProviderEnvironment;
  applicationId: string;
  applicationSecret: string;
  redirectUrl: string;
  oauthBaseUrl: string;
  apiBaseUrl: string;
};

export type SquareLocationOption = {
  id: string;
  name: string;
  status: string | null;
  addressSummary: string | null;
  isActive: boolean;
};

type SquareOAuthTokenResult = {
  environment: PaymentProviderEnvironment;
  accessToken: string;
  refreshToken: string;
  merchantId: string;
  accessTokenExpiresAt: string | null;
  grantedScopes: string[];
};

type SquareOAuthTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: string;
  merchant_id?: string;
  scope?: string;
  scopes?: string[];
  errors?: Array<{ code?: string; detail?: string }>;
};

type SquareLocationResponse = {
  locations?: Array<{
    id?: string;
    name?: string;
    status?: string;
    address?: {
      address_line_1?: string;
      locality?: string;
      administrative_district_level_1?: string;
      postal_code?: string;
    };
  }>;
  errors?: Array<{ code?: string; detail?: string }>;
};

type TenantConnectionSupabaseClient = Pick<typeof supabaseAdmin, "from">;
type SquareFetch = typeof fetch;

type ResolveTenantPaymentProviderConnectionOptions = {
  supabase?: TenantConnectionSupabaseClient;
  getTenantById?: (tenantId: string) => Promise<TenantRecord | null>;
};

export class TenantPaymentProviderConnectionError extends Error {
  readonly code: string;
  readonly cause?: unknown;

  constructor(message: string, code = "PAYMENT_PROVIDER_CONNECTION_ERROR", cause?: unknown) {
    super(message);
    this.name = "TenantPaymentProviderConnectionError";
    this.code = code;
    this.cause = cause;
  }
}

export type SquareCheckoutConfiguration =
  | {
      configured: true;
      provider: "square";
      environment: PaymentProviderEnvironment;
      applicationId: string;
      locationId: string;
    }
  | {
      configured: false;
      provider: "square";
      reason: string;
    };

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
}

function firstConfiguredEnv(envNames: readonly string[]) {
  for (const envName of envNames) {
    const value = clean(process.env[envName]);
    if (value) return { envName, value };
  }

  return null;
}

function normalizeProvider(value: PaymentProvider | undefined) {
  return value ?? DEFAULT_PAYMENT_PROVIDER;
}

export function getConfiguredSquareEnvironment(): PaymentProviderEnvironment {
  const raw = (process.env.SQUARE_ENVIRONMENT || "sandbox").trim().toLowerCase();

  if (raw === "production") return "production";
  if (raw === "sandbox") return "sandbox";

  throw new TenantPaymentProviderConnectionError(
    "SQUARE_ENVIRONMENT must be either sandbox or production.",
    "PROVIDER_CONFIGURATION_ERROR",
  );
}

function getLegacySquareAccessToken() {
  const token = clean(process.env.SQUARE_ACCESS_TOKEN);
  if (!token) {
    throw new TenantPaymentProviderConnectionError(
      "SQUARE_ACCESS_TOKEN is required for the Tan Can Man legacy Square fallback.",
      "LEGACY_SQUARE_ACCESS_TOKEN_MISSING",
    );
  }
  return token;
}

function getLegacySquareLocationId() {
  const locationId = clean(process.env.SQUARE_LOCATION_ID);
  if (!locationId) {
    throw new TenantPaymentProviderConnectionError(
      "SQUARE_LOCATION_ID is required for the Tan Can Man legacy Square fallback.",
      "LEGACY_SQUARE_LOCATION_ID_MISSING",
    );
  }
  return locationId;
}

function getSquareApplicationId() {
  return firstConfiguredEnv(SQUARE_OAUTH_APPLICATION_ID_ENV_NAMES)?.value ?? null;
}

function getSquareApplicationSecret() {
  return firstConfiguredEnv(SQUARE_OAUTH_APPLICATION_SECRET_ENV_NAMES)?.value ?? null;
}

function getTokenEncryptionKeyMaterial() {
  for (const envName of TOKEN_KEY_ENV_NAMES) {
    const value = clean(process.env[envName]);
    if (value) return { keyId: envName, value };
  }

  throw new TenantPaymentProviderConnectionError(
    "Tenant Square OAuth tokens require PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY.",
    "TOKEN_ENCRYPTION_KEY_MISSING",
  );
}

function decodeTokenEncryptionKey(value: string) {
  const prefixedBase64 = value.match(/^base64:(.+)$/i)?.[1];
  const prefixedHex = value.match(/^hex:(.+)$/i)?.[1];
  const candidates = [
    prefixedBase64 ? Buffer.from(prefixedBase64, "base64") : null,
    prefixedHex ? Buffer.from(prefixedHex, "hex") : null,
    Buffer.from(value, "base64"),
    Buffer.from(value, "hex"),
    Buffer.from(value, "utf8"),
  ].filter(Boolean) as Buffer[];

  const key = candidates.find((candidate) => candidate.length === 32);
  if (!key) {
    throw new TenantPaymentProviderConnectionError(
      "PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY must decode to 32 bytes.",
      "TOKEN_ENCRYPTION_KEY_INVALID",
    );
  }

  return key;
}

function base64urlEncode(value: Buffer) {
  return value.toString("base64url");
}

function base64urlDecode(value: string) {
  return Buffer.from(value, "base64url");
}

export function encryptPaymentProviderToken(token: string) {
  const cleanToken = clean(token);
  if (!cleanToken) {
    throw new TenantPaymentProviderConnectionError("token is required.", "TOKEN_REQUIRED");
  }

  const keyMaterial = getTokenEncryptionKeyMaterial();
  const key = decodeTokenEncryptionKey(keyMaterial.value);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(cleanToken, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedToken: [
      `v${TOKEN_CIPHER_VERSION}`,
      base64urlEncode(iv),
      base64urlEncode(authTag),
      base64urlEncode(ciphertext),
    ].join(":"),
    cipherVersion: TOKEN_CIPHER_VERSION,
    keyId: keyMaterial.keyId,
  };
}

export function decryptPaymentProviderToken(encryptedToken: string | null | undefined) {
  const encrypted = clean(encryptedToken);
  if (!encrypted) {
    throw new TenantPaymentProviderConnectionError(
      "Tenant Square connection is missing an encrypted access token.",
      "TENANT_SQUARE_ACCESS_TOKEN_MISSING",
    );
  }

  const [version, iv, authTag, ciphertext] = encrypted.split(":");
  if (version !== `v${TOKEN_CIPHER_VERSION}` || !iv || !authTag || !ciphertext) {
    throw new TenantPaymentProviderConnectionError(
      "Tenant Square access token uses an unsupported encrypted format.",
      "TENANT_SQUARE_TOKEN_FORMAT_INVALID",
    );
  }

  const key = decodeTokenEncryptionKey(getTokenEncryptionKeyMaterial().value);
  const decipher = createDecipheriv("aes-256-gcm", key, base64urlDecode(iv));
  decipher.setAuthTag(base64urlDecode(authTag));

  return Buffer.concat([
    decipher.update(base64urlDecode(ciphertext)),
    decipher.final(),
  ]).toString("utf8");
}

function getSquareOauthBaseUrl(environment: PaymentProviderEnvironment) {
  return environment === "production"
    ? "https://connect.squareup.com/oauth2"
    : "https://connect.squareupsandbox.com/oauth2";
}

function getSquareApiBaseUrl(environment: PaymentProviderEnvironment) {
  return environment === "production"
    ? "https://connect.squareup.com/v2"
    : "https://connect.squareupsandbox.com/v2";
}

function getConfiguredRedirectUrl() {
  const explicit = clean(process.env.SQUARE_OAUTH_REDIRECT_URL);
  if (explicit) return explicit;

  const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL);
  if (!siteUrl) return null;

  return `${siteUrl.replace(/\/$/, "")}${SQUARE_OAUTH_CALLBACK_PATH}`;
}

function tokenEncryptionKeyIsConfigured() {
  try {
    getTokenEncryptionKeyMaterial();
    return true;
  } catch {
    return false;
  }
}

export function getSquareOAuthConfigurationStatus(): SquareOAuthConfigurationStatus {
  const environment = getConfiguredSquareEnvironment();
  const applicationId = getSquareApplicationId();
  const applicationSecret = getSquareApplicationSecret();
  const redirectUrl = getConfiguredRedirectUrl();
  const tokenKeyConfigured = tokenEncryptionKeyIsConfigured();
  const siteUrl = clean(process.env.NEXT_PUBLIC_SITE_URL);
  const webhookNotificationUrl =
    clean(process.env.SQUARE_WEBHOOK_NOTIFICATION_URL) ??
    (siteUrl ? `${siteUrl.replace(/\/$/, "")}/api/webhooks/square` : null);
  const missing = [
    !applicationId && "Square OAuth application ID",
    !applicationSecret && "Square OAuth application secret",
    !redirectUrl && "Square OAuth redirect URL or NEXT_PUBLIC_SITE_URL",
    !tokenKeyConfigured && "payment-provider token encryption key",
  ].filter(Boolean) as string[];

  return {
    environment,
    configured: missing.length === 0,
    missing,
    applicationIdConfigured: Boolean(applicationId),
    applicationSecretConfigured: Boolean(applicationSecret),
    redirectUrlConfigured: Boolean(redirectUrl),
    tokenEncryptionKeyConfigured: tokenKeyConfigured,
    redirectUrl,
    webhookSignatureConfigured: Boolean(clean(process.env.SQUARE_WEBHOOK_SIGNATURE_KEY)),
    webhookNotificationUrl,
  };
}

function requireSquareOAuthConfiguration(): SquareOAuthRuntimeConfiguration {
  const status = getSquareOAuthConfigurationStatus();
  const applicationId = getSquareApplicationId();
  const applicationSecret = getSquareApplicationSecret();
  const redirectUrl = getConfiguredRedirectUrl();

  if (!status.configured || !applicationId || !applicationSecret || !redirectUrl) {
    throw new TenantPaymentProviderConnectionError(
      `Square OAuth is not configured: ${status.missing.join(", ") || "unknown configuration error"}.`,
      "SQUARE_OAUTH_CONFIGURATION_MISSING",
    );
  }

  return {
    environment: status.environment,
    applicationId,
    applicationSecret,
    redirectUrl,
    oauthBaseUrl: getSquareOauthBaseUrl(status.environment),
    apiBaseUrl: getSquareApiBaseUrl(status.environment),
  };
}

export function buildSquareOAuthAuthorizationUrl(input: { state: string }) {
  const state = clean(input.state);
  if (!state) {
    throw new TenantPaymentProviderConnectionError("Square OAuth state is required.", "VALIDATION_ERROR");
  }

  const config = requireSquareOAuthConfiguration();
  const url = new URL(`${config.oauthBaseUrl}/authorize`);
  url.searchParams.set("client_id", config.applicationId);
  url.searchParams.set("scope", SQUARE_OAUTH_SCOPES.join(" "));
  url.searchParams.set("state", state);
  url.searchParams.set("redirect_uri", config.redirectUrl);
  if (config.environment === "production") {
    url.searchParams.set("session", "false");
  }

  return url.toString();
}

async function parseSquareJsonResponse<T>(response: Response): Promise<T> {
  const body = (await response.json().catch(() => ({}))) as T & {
    errors?: Array<{ code?: string; detail?: string }>;
  };
  if (response.ok) return body;

  const first = body.errors?.[0];
  throw new TenantPaymentProviderConnectionError(
    first?.detail ?? first?.code ?? "Square API request failed.",
    "SQUARE_API_REQUEST_FAILED",
  );
}

function parseGrantedScopes(response: SquareOAuthTokenResponse) {
  if (Array.isArray(response.scopes)) {
    return response.scopes.map((scope) => scope.trim()).filter(Boolean);
  }

  return (response.scope ?? "")
    .split(/[,\s]+/)
    .map((scope) => scope.trim())
    .filter(Boolean);
}

export async function exchangeSquareOAuthCode(
  input: { code: string },
  options: { fetch?: SquareFetch } = {},
): Promise<SquareOAuthTokenResult> {
  const code = clean(input.code);
  if (!code) {
    throw new TenantPaymentProviderConnectionError("Square OAuth code is required.", "VALIDATION_ERROR");
  }

  const config = requireSquareOAuthConfiguration();
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(`${config.oauthBaseUrl}/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      client_secret: config.applicationSecret,
      code,
      grant_type: "authorization_code",
      redirect_uri: config.redirectUrl,
    }),
  });
  const tokenResponse = await parseSquareJsonResponse<SquareOAuthTokenResponse>(response);
  const accessToken = clean(tokenResponse.access_token);
  const refreshToken = clean(tokenResponse.refresh_token);
  const merchantId = clean(tokenResponse.merchant_id);

  if (!accessToken || !refreshToken || !merchantId) {
    throw new TenantPaymentProviderConnectionError(
      "Square OAuth response did not include the required token and merchant metadata.",
      "SQUARE_OAUTH_RESPONSE_INVALID",
    );
  }

  return {
    environment: config.environment,
    accessToken,
    refreshToken,
    merchantId,
    accessTokenExpiresAt: clean(tokenResponse.expires_at),
    grantedScopes: parseGrantedScopes(tokenResponse),
  };
}

function toSquareLocationOption(
  location: NonNullable<SquareLocationResponse["locations"]>[number],
) {
  const id = clean(location.id);
  if (!id) return null;

  const addressParts = [
    clean(location.address?.address_line_1),
    clean(location.address?.locality),
    clean(location.address?.administrative_district_level_1),
    clean(location.address?.postal_code),
  ].filter(Boolean);

  return {
    id,
    name: clean(location.name) ?? id,
    status: clean(location.status),
    addressSummary: addressParts.length ? addressParts.join(", ") : null,
    isActive: clean(location.status)?.toUpperCase() === "ACTIVE",
  } satisfies SquareLocationOption;
}

export async function listSquareLocationsForAccessToken(
  input: { accessToken: string; environment?: PaymentProviderEnvironment },
  options: { fetch?: SquareFetch } = {},
) {
  const accessToken = clean(input.accessToken);
  if (!accessToken) {
    throw new TenantPaymentProviderConnectionError(
      "Square access token is required to list locations.",
      "SQUARE_ACCESS_TOKEN_REQUIRED",
    );
  }

  const environment = input.environment ?? getConfiguredSquareEnvironment();
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(`${getSquareApiBaseUrl(environment)}/locations`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
  });
  const body = await parseSquareJsonResponse<SquareLocationResponse>(response);

  return (body.locations ?? [])
    .map(toSquareLocationOption)
    .filter((location): location is SquareLocationOption => Boolean(location));
}

function isMissingConnectionTableError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (("code" in error && error.code === "42P01") ||
        ("message" in error &&
          typeof error.message === "string" &&
          error.message.includes("tenant_payment_provider_connections"))),
  );
}

function assertTenantConnectionRow(
  row: TenantPaymentProviderConnectionRow,
): asserts row is TenantPaymentProviderConnectionRow & {
  provider_location_id: string;
  encrypted_access_token: string;
} {
  if (!clean(row.provider_location_id)) {
    throw new TenantPaymentProviderConnectionError(
      "Tenant Square connection is missing a selected location.",
      "TENANT_SQUARE_LOCATION_MISSING",
    );
  }

  if (!clean(row.encrypted_access_token)) {
    throw new TenantPaymentProviderConnectionError(
      "Tenant Square connection is missing an encrypted access token.",
      "TENANT_SQUARE_ACCESS_TOKEN_MISSING",
    );
  }

  if ((row.token_cipher_version ?? TOKEN_CIPHER_VERSION) !== TOKEN_CIPHER_VERSION) {
    throw new TenantPaymentProviderConnectionError(
      "Tenant Square access token uses an unsupported cipher version.",
      "TENANT_SQUARE_TOKEN_VERSION_UNSUPPORTED",
    );
  }
}

function toConnectionContext(
  row: TenantPaymentProviderConnectionRow,
): PaymentProviderConnectionContext {
  assertTenantConnectionRow(row);

  return {
    id: row.id,
    businessId: row.business_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    providerMerchantId: clean(row.provider_merchant_id),
    providerLocationId: clean(row.provider_location_id) ?? row.provider_location_id,
    accessToken: decryptPaymentProviderToken(row.encrypted_access_token),
    mode: "tenant_connection",
  };
}

function toConnectionReference(
  row: TenantPaymentProviderConnectionReferenceRow,
): TenantPaymentProviderConnectionReference {
  return {
    id: row.id,
    businessId: row.business_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    providerMerchantId: clean(row.provider_merchant_id),
    providerLocationId: clean(row.provider_location_id),
  };
}

function toAdminSummary(
  row: TenantPaymentProviderConnectionAdminRow,
): TenantPaymentProviderConnectionAdminSummary {
  return {
    id: row.id,
    businessId: row.business_id,
    provider: row.provider as PaymentProvider,
    providerEnvironment: row.provider_environment as PaymentProviderEnvironment,
    status: row.status,
    providerMerchantId: clean(row.provider_merchant_id),
    providerLocationId: clean(row.provider_location_id),
    providerLocationName: clean(row.provider_location_name),
    grantedScopes: row.granted_scopes ?? [],
    expiresAt: row.access_token_expires_at,
    connectedBy: row.connected_by,
    connectedAt: row.connected_at,
    revokedAt: row.revoked_at,
    lastError: clean(row.last_error),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    canLoadLocations: Boolean(clean(row.encrypted_access_token)),
    canRevokeAccess: Boolean(clean(row.encrypted_access_token)),
  };
}

export async function getTenantSquareConnectionForAdmin(
  input: {
    businessId: string;
    includeInactive?: boolean;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> = {},
) {
  const businessId = clean(input.businessId);
  if (!businessId) {
    throw new TenantPaymentProviderConnectionError("businessId is required.", "VALIDATION_ERROR");
  }

  const supabase = options.supabase ?? supabaseAdmin;
  let query = supabase
    .from("tenant_payment_provider_connections")
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT)
    .eq("business_id", businessId)
    .eq("provider", "square")
    .eq("provider_environment", getConfiguredSquareEnvironment());

  if (!input.includeInactive) {
    query = query.in("status", ["pending", "active", "reauth_required", "error"]);
  }

  const { data, error } = await query
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<TenantPaymentProviderConnectionAdminRow>();

  if (error) {
    if (isMissingConnectionTableError(error)) return null;

    throw new TenantPaymentProviderConnectionError(
      error.message ?? "Unable to load Square connection.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_LOOKUP_FAILED",
      error,
    );
  }

  return data ? toAdminSummary(data) : null;
}

async function getTenantSquareConnectionRowForAdmin(
  input: {
    businessId: string;
    connectionId?: string | null;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> = {},
) {
  const businessId = clean(input.businessId);
  if (!businessId) {
    throw new TenantPaymentProviderConnectionError("businessId is required.", "VALIDATION_ERROR");
  }

  const supabase = options.supabase ?? supabaseAdmin;
  let query = supabase
    .from("tenant_payment_provider_connections")
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT)
    .eq("business_id", businessId)
    .eq("provider", "square")
    .eq("provider_environment", getConfiguredSquareEnvironment());

  const connectionId = clean(input.connectionId);
  if (connectionId) {
    query = query.eq("id", connectionId);
  } else {
    query = query.in("status", ["pending", "active", "reauth_required", "error"]);
  }

  const { data, error } = await query
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<TenantPaymentProviderConnectionAdminRow>();

  if (error || !data) {
    throw new TenantPaymentProviderConnectionError(
      error?.message ?? "Square connection was not found for this business.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_NOT_FOUND",
      error,
    );
  }

  return data;
}

export async function listTenantSquareConnectionLocationsForAdmin(
  input: {
    businessId: string;
    connectionId?: string | null;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> & {
    fetch?: SquareFetch;
  } = {},
) {
  const row = await getTenantSquareConnectionRowForAdmin(input, options);
  const accessToken = decryptPaymentProviderToken(row.encrypted_access_token);

  return listSquareLocationsForAccessToken(
    {
      accessToken,
      environment: row.provider_environment as PaymentProviderEnvironment,
    },
    { fetch: options.fetch },
  );
}

export async function persistSquareOAuthConnectionForBusiness(
  input: {
    businessId: string;
    connectedBy: string;
    token: SquareOAuthTokenResult;
    selectedLocation?: SquareLocationOption | null;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> = {},
) {
  const businessId = clean(input.businessId);
  const connectedBy = clean(input.connectedBy);
  const merchantId = clean(input.token.merchantId);
  if (!businessId || !connectedBy || !merchantId) {
    throw new TenantPaymentProviderConnectionError(
      "businessId, connectedBy, and Square merchant ID are required.",
      "VALIDATION_ERROR",
    );
  }

  const encryptedAccessToken = encryptPaymentProviderToken(input.token.accessToken);
  const encryptedRefreshToken = encryptPaymentProviderToken(input.token.refreshToken);
  const now = new Date().toISOString();
  const selectedLocation = input.selectedLocation ?? null;
  const supabase = options.supabase ?? supabaseAdmin;

  const values = {
    business_id: businessId,
    provider: "square",
    provider_environment: input.token.environment,
    status: selectedLocation ? "active" : "pending",
    provider_merchant_id: merchantId,
    provider_location_id: selectedLocation?.id ?? null,
    provider_location_name: selectedLocation?.name ?? null,
    granted_scopes: input.token.grantedScopes,
    encrypted_access_token: encryptedAccessToken.encryptedToken,
    encrypted_refresh_token: encryptedRefreshToken.encryptedToken,
    token_cipher_version: encryptedAccessToken.cipherVersion,
    token_cipher_key_id: encryptedAccessToken.keyId,
    access_token_expires_at: input.token.accessTokenExpiresAt,
    token_refreshed_at: now,
    connected_by: connectedBy,
    connected_at: now,
    revoked_at: null,
    last_error: null,
  };

  const existing = await supabase
    .from("tenant_payment_provider_connections")
    .select("id")
    .eq("business_id", businessId)
    .eq("provider", "square")
    .eq("provider_environment", input.token.environment)
    .in("status", ["pending", "active", "reauth_required", "error"])
    .order("connected_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<{ id: string }>();

  if (existing.error) {
    throw new TenantPaymentProviderConnectionError(
      existing.error.message ?? "Unable to find existing Square connection.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_LOOKUP_FAILED",
      existing.error,
    );
  }

  const mutation = existing.data
    ? supabase
        .from("tenant_payment_provider_connections")
        .update(values)
        .eq("id", existing.data.id)
    : supabase
        .from("tenant_payment_provider_connections")
        .insert({ ...values, id: randomUUID() });

  const { data, error } = await mutation
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT)
    .single<TenantPaymentProviderConnectionAdminRow>();

  if (error || !data) {
    throw new TenantPaymentProviderConnectionError(
      error?.message ?? "Unable to save Square connection.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_SAVE_FAILED",
      error,
    );
  }

  return toAdminSummary(data);
}

export async function selectTenantSquareLocationForAdmin(
  input: {
    businessId: string;
    connectionId: string;
    locationId: string;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> & {
    fetch?: SquareFetch;
  } = {},
) {
  const locationId = clean(input.locationId);
  if (!locationId) {
    throw new TenantPaymentProviderConnectionError("locationId is required.", "VALIDATION_ERROR");
  }

  const supabase = options.supabase ?? supabaseAdmin;
  const row = await getTenantSquareConnectionRowForAdmin(input, { supabase });
  const locations = await listTenantSquareConnectionLocationsForAdmin(input, {
    supabase,
    fetch: options.fetch,
  });
  const selectedLocation = locations.find((location) => location.id === locationId);

  if (!selectedLocation) {
    throw new TenantPaymentProviderConnectionError(
      "Selected Square location is not available for this connection.",
      "SQUARE_LOCATION_NOT_FOUND",
    );
  }

  const { data, error } = await supabase
    .from("tenant_payment_provider_connections")
    .update({
      status: "active",
      provider_location_id: selectedLocation.id,
      provider_location_name: selectedLocation.name,
      last_error: null,
      connected_at: row.connected_at ?? new Date().toISOString(),
    })
    .eq("id", row.id)
    .eq("business_id", input.businessId)
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT)
    .single<TenantPaymentProviderConnectionAdminRow>();

  if (error || !data) {
    throw new TenantPaymentProviderConnectionError(
      error?.message ?? "Unable to save Square location selection.",
      "SQUARE_LOCATION_SAVE_FAILED",
      error,
    );
  }

  return toAdminSummary(data);
}

export async function revokeTenantSquareConnectionForAdmin(
  input: {
    businessId: string;
    connectionId: string;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> & {
    fetch?: SquareFetch;
  } = {},
) {
  const supabase = options.supabase ?? supabaseAdmin;
  const row = await getTenantSquareConnectionRowForAdmin(input, { supabase });
  const accessToken = decryptPaymentProviderToken(row.encrypted_access_token);
  const config = requireSquareOAuthConfiguration();
  const doFetch = options.fetch ?? fetch;
  const response = await doFetch(`${config.oauthBaseUrl}/revoke`, {
    method: "POST",
    headers: {
      Authorization: `Client ${config.applicationSecret}`,
      "Content-Type": "application/json",
      "Square-Version": SQUARE_API_VERSION,
    },
    body: JSON.stringify({
      client_id: config.applicationId,
      access_token: accessToken,
      revoke_only_access_token: false,
    }),
  });

  await parseSquareJsonResponse<{ success?: boolean }>(response);

  const { data, error } = await supabase
    .from("tenant_payment_provider_connections")
    .update({
      status: "revoked",
      encrypted_access_token: null,
      encrypted_refresh_token: null,
      revoked_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", row.id)
    .eq("business_id", input.businessId)
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_ADMIN_SELECT)
    .single<TenantPaymentProviderConnectionAdminRow>();

  if (error || !data) {
    throw new TenantPaymentProviderConnectionError(
      error?.message ?? "Square was revoked, but the connection record could not be updated.",
      "SQUARE_REVOKE_LOCAL_UPDATE_FAILED",
      error,
    );
  }

  return toAdminSummary(data);
}

async function findActiveTenantConnection(input: {
  businessId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  supabase: TenantConnectionSupabaseClient;
}) {
  const { data, error } = await input.supabase
    .from("tenant_payment_provider_connections")
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_SELECT)
    .eq("business_id", input.businessId)
    .eq("provider", input.provider)
    .eq("provider_environment", input.providerEnvironment)
    .eq("status", "active")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle<TenantPaymentProviderConnectionRow>();

  if (error) {
    if (isMissingConnectionTableError(error)) return null;

    throw new TenantPaymentProviderConnectionError(
      error.message ?? "Unable to load tenant payment provider connection.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_LOOKUP_FAILED",
      error,
    );
  }

  return data ? toConnectionContext(data) : null;
}

async function resolveLegacyTanCanManFallback(input: {
  businessId: string;
  provider: PaymentProvider;
  providerEnvironment: PaymentProviderEnvironment;
  getTenantById: (tenantId: string) => Promise<TenantRecord | null>;
}) {
  if (input.provider !== "square") return null;

  const tenant = await input.getTenantById(input.businessId);
  if (tenant?.slug !== LEGACY_TAN_CAN_MAN_SLUG) return null;

  return {
    id: null,
    businessId: input.businessId,
    provider: "square",
    providerEnvironment: input.providerEnvironment,
    providerMerchantId: null,
    providerLocationId: getLegacySquareLocationId(),
    accessToken: getLegacySquareAccessToken(),
    mode: "legacy_tan_can_man_fallback",
  } satisfies PaymentProviderConnectionContext;
}

export async function resolveTenantPaymentProviderConnection(input: {
  businessId: string;
  provider?: PaymentProvider;
  providerEnvironment?: PaymentProviderEnvironment;
}, options: ResolveTenantPaymentProviderConnectionOptions = {}) {
  const businessId = clean(input.businessId);
  if (!businessId) {
    throw new TenantPaymentProviderConnectionError("businessId is required.", "VALIDATION_ERROR");
  }

  const provider = normalizeProvider(input.provider);
  const providerEnvironment = input.providerEnvironment ?? getConfiguredSquareEnvironment();
  const supabase = options.supabase ?? supabaseAdmin;
  const getTenantById = options.getTenantById ?? ((tenantId: string) => findTenantByIdStrict(tenantId));

  const tenantConnection = await findActiveTenantConnection({
    businessId,
    provider,
    providerEnvironment,
    supabase,
  });

  if (tenantConnection) return tenantConnection;

  const legacyFallback = await resolveLegacyTanCanManFallback({
    businessId,
    provider,
    providerEnvironment,
    getTenantById,
  });

  if (legacyFallback) return legacyFallback;

  throw new TenantPaymentProviderConnectionError(
    "This business does not have an active Square payment connection.",
    "TENANT_PAYMENT_PROVIDER_CONNECTION_MISSING",
  );
}


export async function getSquareCheckoutConfigurationForBusiness(
  input: {
    businessId: string;
  },
  options: ResolveTenantPaymentProviderConnectionOptions = {},
): Promise<SquareCheckoutConfiguration> {
  const applicationId = getSquareApplicationId();
  if (!applicationId) {
    return {
      configured: false,
      provider: "square",
      reason: "Online card payment is unavailable right now.",
    };
  }

  try {
    const connection = await resolveTenantPaymentProviderConnection(
      {
        businessId: input.businessId,
        provider: "square",
      },
      options,
    );

    return {
      configured: true,
      provider: "square",
      environment: connection.providerEnvironment,
      applicationId,
      locationId: connection.providerLocationId,
    };
  } catch (error) {
    if (
      error instanceof TenantPaymentProviderConnectionError &&
      [
        "TENANT_PAYMENT_PROVIDER_CONNECTION_MISSING",
        "LEGACY_SQUARE_ACCESS_TOKEN_MISSING",
        "LEGACY_SQUARE_LOCATION_ID_MISSING",
      ].includes(error.code)
    ) {
      return {
        configured: false,
        provider: "square",
        reason: "Online card payment is unavailable right now.",
      };
    }

    throw error;
  }
}

export async function findTenantPaymentProviderConnectionByMerchant(
  input: {
    provider?: PaymentProvider;
    providerEnvironment?: PaymentProviderEnvironment;
    providerMerchantId: string | null | undefined;
  },
  options: Pick<ResolveTenantPaymentProviderConnectionOptions, "supabase"> = {},
) {
  const providerMerchantId = clean(input.providerMerchantId);
  if (!providerMerchantId) return null;

  const provider = normalizeProvider(input.provider);
  const providerEnvironment = input.providerEnvironment ?? getConfiguredSquareEnvironment();
  const supabase = options.supabase ?? supabaseAdmin;

  const { data, error } = await supabase
    .from("tenant_payment_provider_connections")
    .select(TENANT_PAYMENT_PROVIDER_CONNECTION_REFERENCE_SELECT)
    .eq("provider", provider)
    .eq("provider_environment", providerEnvironment)
    .eq("provider_merchant_id", providerMerchantId)
    .eq("status", "active")
    .order("connected_at", { ascending: false })
    .limit(1)
    .maybeSingle<TenantPaymentProviderConnectionReferenceRow>();

  if (error) {
    if (isMissingConnectionTableError(error)) return null;

    throw new TenantPaymentProviderConnectionError(
      error.message ?? "Unable to load tenant payment provider connection by merchant.",
      "TENANT_PAYMENT_PROVIDER_CONNECTION_LOOKUP_FAILED",
      error,
    );
  }

  return data ? toConnectionReference(data) : null;
}
