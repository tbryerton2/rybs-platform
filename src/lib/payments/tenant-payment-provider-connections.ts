import "server-only";

import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
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
const TOKEN_KEY_ENV_NAMES = [
  "PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY",
  "SQUARE_OAUTH_TOKEN_ENCRYPTION_KEY",
] as const;

const TENANT_PAYMENT_PROVIDER_CONNECTION_SELECT =
  "id, business_id, provider, provider_environment, status, provider_merchant_id, provider_location_id, encrypted_access_token, token_cipher_version, token_cipher_key_id";

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

type TenantConnectionSupabaseClient = Pick<typeof supabaseAdmin, "from">;

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

function clean(value: string | null | undefined) {
  const cleaned = value?.trim();
  return cleaned ? cleaned : null;
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
