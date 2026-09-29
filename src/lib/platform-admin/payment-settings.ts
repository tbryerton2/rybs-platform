import "server-only";

import { supabaseAdmin } from "@/lib/supabaseAdmin";

export const PLATFORM_PAYMENT_PROVIDERS = ["square"] as const;
export const PLATFORM_TENANT_PAYMENT_MODES = ["disabled", "sandbox", "production"] as const;

export type PlatformPaymentProvider = (typeof PLATFORM_PAYMENT_PROVIDERS)[number];
export type PlatformTenantPaymentMode = (typeof PLATFORM_TENANT_PAYMENT_MODES)[number];

export type PlatformTenantPaymentSetting = {
  id: string | null;
  businessId: string;
  provider: PlatformPaymentProvider;
  mode: PlatformTenantPaymentMode;
  updatedBy: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type PlatformTenantPaymentSettingUpdateResult = PlatformTenantPaymentSetting & {
  changed: boolean;
};

export type PlatformTenantPaymentSettingEvent = {
  id: string;
  businessId: string;
  provider: PlatformPaymentProvider;
  previousMode: PlatformTenantPaymentMode;
  newMode: PlatformTenantPaymentMode;
  actorPlatformAdminUserId: string | null;
  createdAt: string;
};

export type PlatformTenantPaymentConnectionSummary = {
  id: string;
  businessId: string;
  provider: PlatformPaymentProvider;
  environment: Exclude<PlatformTenantPaymentMode, "disabled">;
  status: string;
  merchantId: string | null;
  locationId: string | null;
  locationName: string | null;
  connectedAt: string | null;
  updatedAt: string;
};

export type PlatformTenantPaymentPolicy = {
  businessId: string;
  provider: PlatformPaymentProvider;
  mode: PlatformTenantPaymentMode;
};

export type UpdatePlatformTenantPaymentModeInput = {
  businessId: unknown;
  provider: unknown;
  mode: unknown;
  liveConfirmation?: unknown;
};

export type PlatformTenantPaymentSettingErrorCode =
  | "invalid_input"
  | "not_found"
  | "live_confirmation_required"
  | "live_connection_required"
  | "settings_rpc_missing"
  | "database_error";

export class PlatformTenantPaymentSettingError extends Error {
  code: PlatformTenantPaymentSettingErrorCode;

  constructor(code: PlatformTenantPaymentSettingErrorCode, message: string) {
    super(message);
    this.name = "PlatformTenantPaymentSettingError";
    this.code = code;
  }
}

type SupabaseDbError = {
  code?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
};

type SettingRow = {
  id: string | null;
  business_id: string;
  provider: string;
  mode: string;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type SettingRpcRow = SettingRow & {
  changed: boolean | null;
};

type SettingEventRow = {
  id: string;
  business_id: string;
  provider: string;
  previous_mode: string;
  new_mode: string;
  actor_platform_admin_user_id: string | null;
  created_at: string;
};

type ConnectionSummaryRow = {
  id: string;
  business_id: string;
  provider: string;
  provider_environment: string;
  status: string;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
  provider_location_name: string | null;
  connected_at: string | null;
  updated_at: string;
};

type QueryResult<T> = Promise<{ data: T | null; error: SupabaseDbError | null }>;

type PlatformPaymentSettingsSupabaseClient = {
  from(table: string): unknown;
  rpc(functionName: string, args: Record<string, unknown>): unknown;
};

type PlatformPaymentSettingsSessionContext = {
  user: {
    id: string;
  };
};

type PlatformPaymentSettingsOptions = {
  supabase?: PlatformPaymentSettingsSupabaseClient;
  requirePlatformAdminSession?: () => Promise<PlatformPaymentSettingsSessionContext>;
};

const SETTING_SELECT = "id, business_id, provider, mode, updated_by, created_at, updated_at";
const EVENT_SELECT =
  "id, business_id, provider, previous_mode, new_mode, actor_platform_admin_user_id, created_at";
const CONNECTION_SUMMARY_SELECT =
  "id, business_id, provider, provider_environment, status, provider_merchant_id, provider_location_id, provider_location_name, connected_at, updated_at";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function getClient(options?: PlatformPaymentSettingsOptions) {
  return options?.supabase ?? (supabaseAdmin as unknown as PlatformPaymentSettingsSupabaseClient);
}

async function requireSession(options?: PlatformPaymentSettingsOptions) {
  if (options?.requirePlatformAdminSession) {
    return options.requirePlatformAdminSession();
  }

  const { requirePlatformAdmin } = await import("@/lib/platform-admin/auth");
  return requirePlatformAdmin();
}

function normalizeUuid(value: unknown, message = "Choose a valid business.") {
  const uuid = typeof value === "string" ? value.trim() : "";

  if (!UUID_PATTERN.test(uuid)) {
    throw new PlatformTenantPaymentSettingError("invalid_input", message);
  }

  return uuid;
}

export function normalizePlatformPaymentProvider(value: unknown): PlatformPaymentProvider {
  const provider = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (provider === "square") {
    return provider;
  }

  throw new PlatformTenantPaymentSettingError("invalid_input", "Choose a valid payment provider.");
}

export function normalizePlatformTenantPaymentMode(value: unknown): PlatformTenantPaymentMode {
  const mode = typeof value === "string" ? value.trim().toLowerCase() : "";

  if (mode === "disabled" || mode === "sandbox" || mode === "production") {
    return mode;
  }

  throw new PlatformTenantPaymentSettingError("invalid_input", "Choose Disabled, Sandbox, or Live.");
}

function assertPlatformPaymentProvider(value: string): PlatformPaymentProvider {
  return normalizePlatformPaymentProvider(value);
}

function assertPlatformTenantPaymentMode(value: string): PlatformTenantPaymentMode {
  return normalizePlatformTenantPaymentMode(value);
}

function mapSettingRow(row: SettingRow): PlatformTenantPaymentSetting {
  return {
    id: row.id,
    businessId: row.business_id,
    provider: assertPlatformPaymentProvider(row.provider),
    mode: assertPlatformTenantPaymentMode(row.mode),
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapRpcSettingRow(row: SettingRpcRow): PlatformTenantPaymentSettingUpdateResult {
  return {
    ...mapSettingRow(row),
    changed: row.changed === true,
  };
}

function mapEventRow(row: SettingEventRow): PlatformTenantPaymentSettingEvent {
  return {
    id: row.id,
    businessId: row.business_id,
    provider: assertPlatformPaymentProvider(row.provider),
    previousMode: assertPlatformTenantPaymentMode(row.previous_mode),
    newMode: assertPlatformTenantPaymentMode(row.new_mode),
    actorPlatformAdminUserId: row.actor_platform_admin_user_id,
    createdAt: row.created_at,
  };
}

function mapConnectionSummaryRow(row: ConnectionSummaryRow): PlatformTenantPaymentConnectionSummary {
  const environment = assertPlatformTenantPaymentMode(row.provider_environment);
  if (environment === "disabled") {
    throw new PlatformTenantPaymentSettingError(
      "database_error",
      "We could not load the Square connection status.",
    );
  }

  return {
    id: row.id,
    businessId: row.business_id,
    provider: assertPlatformPaymentProvider(row.provider),
    environment,
    status: row.status,
    merchantId: row.provider_merchant_id,
    locationId: row.provider_location_id,
    locationName: row.provider_location_name,
    connectedAt: row.connected_at,
    updatedAt: row.updated_at,
  };
}

function defaultDisabledSetting(
  businessId: string,
  provider: PlatformPaymentProvider,
): PlatformTenantPaymentSetting {
  return {
    id: null,
    businessId,
    provider,
    mode: "disabled",
    updatedBy: null,
    createdAt: null,
    updatedAt: null,
  };
}

function mapDatabaseError(error: SupabaseDbError, event: string): never {
  const message = error.message ?? "";

  if (
    error.code === "PGRST202" &&
    message.includes("platform_admin_set_tenant_payment_mode") &&
    message.includes("schema cache")
  ) {
    throw new PlatformTenantPaymentSettingError(
      "settings_rpc_missing",
      "Platform payment settings database functions are not installed. Apply the pending Supabase migration and try again.",
    );
  }

  if (message.includes("TENANT_PAYMENT_SETTING_BUSINESS_NOT_FOUND")) {
    throw new PlatformTenantPaymentSettingError("not_found", "Business not found.");
  }

  if (message.includes("TENANT_PAYMENT_SETTING_INVALID_PROVIDER")) {
    throw new PlatformTenantPaymentSettingError("invalid_input", "Choose a valid payment provider.");
  }

  if (message.includes("TENANT_PAYMENT_SETTING_INVALID_MODE")) {
    throw new PlatformTenantPaymentSettingError("invalid_input", "Choose Disabled, Sandbox, or Live.");
  }

  console.error("[platform-admin-payment-settings]", {
    event,
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  throw new PlatformTenantPaymentSettingError(
    "database_error",
    "We could not update payment settings. Try again in a moment.",
  );
}

function asMaybeSingleQuery<T>(query: unknown): QueryResult<T> {
  return (query as { maybeSingle(): QueryResult<T> }).maybeSingle();
}

function asRpcSingleQuery<T>(query: unknown): QueryResult<T> {
  return (query as { single(): QueryResult<T> }).single();
}

async function getSettingRow(
  businessId: string,
  provider: PlatformPaymentProvider,
  options?: PlatformPaymentSettingsOptions,
) {
  const client = getClient(options);
  const query = (client.from("tenant_payment_settings") as {
    select(columns: string): {
      eq(column: string, value: string): unknown;
    };
  })
    .select(SETTING_SELECT)
    .eq("business_id", businessId);

  const providerQuery = (query as { eq(column: string, value: string): unknown }).eq("provider", provider);
  return asMaybeSingleQuery<SettingRow>(providerQuery);
}

async function getConnectionRows(
  businessId: string,
  provider: PlatformPaymentProvider,
  options?: PlatformPaymentSettingsOptions,
) {
  const client = getClient(options);
  const query = (client.from("tenant_payment_provider_connections") as {
    select(columns: string): {
      eq(column: string, value: string): unknown;
    };
  })
    .select(CONNECTION_SUMMARY_SELECT)
    .eq("business_id", businessId);
  const providerQuery = (query as {
    eq(column: string, value: string): {
      order(column: string, options?: { ascending?: boolean }): QueryResult<ConnectionSummaryRow[]>;
    };
  }).eq("provider", provider);

  return providerQuery.order("provider_environment", { ascending: true });
}

export async function listPlatformTenantPaymentConnections(
  businessIdInput: unknown,
  providerInput: unknown,
  options?: PlatformPaymentSettingsOptions,
): Promise<PlatformTenantPaymentConnectionSummary[]> {
  await requireSession(options);
  const businessId = normalizeUuid(businessIdInput);
  const provider = normalizePlatformPaymentProvider(providerInput);
  const { data, error } = await getConnectionRows(businessId, provider, options);

  if (error) {
    mapDatabaseError(error, "connection_summary_lookup_database_error");
  }

  return (data ?? []).map(mapConnectionSummaryRow);
}

export async function getPlatformTenantPaymentSetting(
  businessIdInput: unknown,
  providerInput: unknown,
  options?: PlatformPaymentSettingsOptions,
): Promise<PlatformTenantPaymentSetting> {
  await requireSession(options);
  const businessId = normalizeUuid(businessIdInput);
  const provider = normalizePlatformPaymentProvider(providerInput);
  const { data, error } = await getSettingRow(businessId, provider, options);

  if (error) {
    mapDatabaseError(error, "setting_lookup_database_error");
  }

  if (!data) {
    return defaultDisabledSetting(businessId, provider);
  }

  return mapSettingRow(data);
}

export async function updatePlatformTenantPaymentMode(
  input: UpdatePlatformTenantPaymentModeInput,
  options?: PlatformPaymentSettingsOptions,
): Promise<PlatformTenantPaymentSettingUpdateResult> {
  const session = await requireSession(options);
  const businessId = normalizeUuid(input.businessId);
  const provider = normalizePlatformPaymentProvider(input.provider);
  const mode = normalizePlatformTenantPaymentMode(input.mode);
  const client = getClient(options);

  if (mode === "production") {
    const confirmation = typeof input.liveConfirmation === "string"
      ? input.liveConfirmation.trim()
      : "";
    if (confirmation !== "LIVE") {
      throw new PlatformTenantPaymentSettingError(
        "live_confirmation_required",
        "Type LIVE to activate live payments.",
      );
    }

    const { data: connections, error: connectionError } = await getConnectionRows(
      businessId,
      provider,
      options,
    );
    if (connectionError) {
      mapDatabaseError(connectionError, "live_connection_lookup_database_error");
    }

    const activeProductionConnection = (connections ?? []).some(
      (connection) =>
        connection.provider_environment === "production" &&
        connection.status === "active" &&
        Boolean(connection.provider_location_id),
    );
    if (!activeProductionConnection) {
      throw new PlatformTenantPaymentSettingError(
        "live_connection_required",
        "Connect an active production Square account and select its location before activating Live payments.",
      );
    }
  }

  const query = client.rpc("platform_admin_set_tenant_payment_mode", {
    p_business_id: businessId,
    p_provider: provider,
    p_mode: mode,
    p_actor_auth_user_id: session.user.id,
  });
  const { data, error } = await asRpcSingleQuery<SettingRpcRow>(query);

  if (error) {
    mapDatabaseError(error, "setting_mutation_database_error");
  }

  if (!data) {
    throw new PlatformTenantPaymentSettingError(
      "database_error",
      "We could not update payment settings. Try again in a moment.",
    );
  }

  return mapRpcSettingRow(data);
}

export async function listPlatformTenantPaymentSettingEvents(
  businessIdInput: unknown,
  providerInput: unknown,
  options?: PlatformPaymentSettingsOptions,
): Promise<PlatformTenantPaymentSettingEvent[]> {
  await requireSession(options);
  const businessId = normalizeUuid(businessIdInput);
  const provider = normalizePlatformPaymentProvider(providerInput);
  const client = getClient(options);
  const query = (client.from("tenant_payment_setting_events") as {
    select(columns: string): {
      eq(column: string, value: string): unknown;
    };
  })
    .select(EVENT_SELECT)
    .eq("business_id", businessId);
  const providerQuery = (query as {
    eq(column: string, value: string): {
      order(column: string, options?: { ascending?: boolean }): QueryResult<SettingEventRow[]>;
    };
  }).eq("provider", provider);
  const { data, error } = await providerQuery.order("created_at", { ascending: false });

  if (error) {
    mapDatabaseError(error, "setting_events_lookup_database_error");
  }

  return (data ?? []).map(mapEventRow);
}

export async function getTenantPaymentPolicyForBusiness(
  businessIdInput: unknown,
  providerInput: unknown = "square",
  options?: Pick<PlatformPaymentSettingsOptions, "supabase">,
): Promise<PlatformTenantPaymentPolicy> {
  const businessId = normalizeUuid(businessIdInput);
  const provider = normalizePlatformPaymentProvider(providerInput);
  const { data, error } = await getSettingRow(businessId, provider, options);

  if (error) {
    mapDatabaseError(error, "policy_lookup_database_error");
  }

  return {
    businessId,
    provider,
    mode: data ? assertPlatformTenantPaymentMode(data.mode) : "disabled",
  };
}
