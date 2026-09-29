import test from "node:test";
import assert from "node:assert/strict";

import {
  PlatformTenantPaymentSettingError,
  getPlatformTenantPaymentSetting,
  getTenantPaymentPolicyForBusiness,
  listPlatformTenantPaymentConnections,
  listPlatformTenantPaymentSettingEvents,
  normalizePlatformPaymentProvider,
  normalizePlatformTenantPaymentMode,
  updatePlatformTenantPaymentMode,
  type PlatformTenantPaymentMode,
  type PlatformPaymentProvider,
} from "../src/lib/platform-admin/payment-settings.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
const ACTOR_USER_ID = "33333333-3333-4333-8333-333333333333";

type PaymentSettingRow = {
  id: string | null;
  business_id: string;
  provider: PlatformPaymentProvider;
  mode: PlatformTenantPaymentMode;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type PaymentSettingEventRow = {
  id: string;
  business_id: string;
  provider: PlatformPaymentProvider;
  previous_mode: PlatformTenantPaymentMode;
  new_mode: PlatformTenantPaymentMode;
  actor_platform_admin_user_id: string | null;
  created_at: string;
};

type PaymentConnectionRow = {
  id: string;
  business_id: string;
  provider: PlatformPaymentProvider;
  provider_environment: "sandbox" | "production";
  status: string;
  provider_merchant_id: string | null;
  provider_location_id: string | null;
  provider_location_name: string | null;
  connected_at: string | null;
  updated_at: string;
};

type Filter = { column: string; value: unknown };

function platformSession(userId = ACTOR_USER_ID) {
  return {
    user: { id: userId },
    membership: {
      id: "44444444-4444-4444-8444-444444444444",
      authUserId: userId,
      role: "admin",
      status: "active",
      createdAt: "2026-09-29T00:00:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
    },
  };
}

function setting(overrides: Partial<PaymentSettingRow> = {}): PaymentSettingRow {
  return {
    id: "55555555-5555-4555-8555-555555555555",
    business_id: BUSINESS_ID,
    provider: "square",
    mode: "sandbox",
    updated_by: ACTOR_USER_ID,
    created_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T00:00:00.000Z",
    ...overrides,
  };
}

function connection(overrides: Partial<PaymentConnectionRow> = {}): PaymentConnectionRow {
  return {
    id: "77777777-7777-4777-8777-777777777777",
    business_id: BUSINESS_ID,
    provider: "square",
    provider_environment: "production",
    status: "active",
    provider_merchant_id: "merchant-1",
    provider_location_id: "location-1",
    provider_location_name: "Main location",
    connected_at: "2026-09-29T00:00:00.000Z",
    updated_at: "2026-09-29T00:00:00.000Z",
    ...overrides,
  };
}

function matches(row: Record<string, unknown>, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(input: {
  businesses?: string[];
  settings?: PaymentSettingRow[];
  events?: PaymentSettingEventRow[];
  connections?: PaymentConnectionRow[];
} = {}) {
  const businesses = new Set(input.businesses ?? [BUSINESS_ID, OTHER_BUSINESS_ID]);
  const settings = [...(input.settings ?? [])];
  const events = [...(input.events ?? [])];
  const connections = [...(input.connections ?? [])];
  const rpcCalls: Array<{ functionName: string; args: Record<string, unknown> }> = [];

  function runPaymentModeRpc(args: Record<string, unknown>) {
    if (!businesses.has(String(args.p_business_id))) {
      return { data: null, error: { message: "TENANT_PAYMENT_SETTING_BUSINESS_NOT_FOUND" } };
    }

    const businessId = String(args.p_business_id);
    const provider = args.p_provider as PlatformPaymentProvider;
    const mode = args.p_mode as PlatformTenantPaymentMode;
    const actorUserId = String(args.p_actor_auth_user_id);
    const existing = settings.find((row) => row.business_id === businessId && row.provider === provider);

    if (!existing && mode === "disabled") {
      return {
        data: {
          id: null,
          business_id: businessId,
          provider,
          mode: "disabled",
          updated_by: null,
          created_at: null,
          updated_at: null,
          changed: false,
        },
        error: null,
      };
    }

    if (existing?.mode === mode) {
      return { data: { ...existing, changed: false }, error: null };
    }

    const previousMode = existing?.mode ?? "disabled";
    const saved = existing ?? setting({ id: "66666666-6666-4666-8666-666666666666", business_id: businessId });
    Object.assign(saved, {
      provider,
      mode,
      updated_by: actorUserId,
      updated_at: "2026-09-29T01:00:00.000Z",
    });

    if (!existing) {
      settings.push(saved);
    }

    events.push({
      id: `event-${events.length + 1}`,
      business_id: businessId,
      provider,
      previous_mode: previousMode,
      new_mode: mode,
      actor_platform_admin_user_id: actorUserId,
      created_at: "2026-09-29T01:00:00.000Z",
    });

    return { data: { ...saved, changed: true }, error: null };
  }

  const client = {
    from(table: string) {
      const filters: Filter[] = [];

      const query = {
        select(columns: string) {
          void columns;
          return query;
        },
        eq(column: string, value: unknown) {
          filters.push({ column, value });
          return query;
        },
        order(column: string, options?: { ascending?: boolean }) {
          if (table === "tenant_payment_provider_connections") {
            const direction = options?.ascending === false ? -1 : 1;
            return Promise.resolve({
              data: connections
                .filter((row) => matches(row, filters))
                .toSorted((left, right) =>
                  String(left[column as keyof PaymentConnectionRow]).localeCompare(
                    String(right[column as keyof PaymentConnectionRow]),
                  ) * direction),
              error: null,
            });
          }

          if (table !== "tenant_payment_setting_events") {
            return Promise.resolve({ data: null, error: { message: `Unexpected order on ${table}` } });
          }

          return Promise.resolve({
            data: events.filter((row) => matches(row, filters)).toReversed(),
            error: null,
          });
        },
        maybeSingle() {
          if (table !== "tenant_payment_settings") {
            return Promise.resolve({ data: null, error: { message: `Unexpected maybeSingle on ${table}` } });
          }

          return Promise.resolve({
            data: settings.find((row) => matches(row, filters)) ?? null,
            error: null,
          });
        },
      };

      return query;
    },
    rpc(functionName: string, args: Record<string, unknown>) {
      rpcCalls.push({ functionName, args });

      return {
        single: async () => {
          if (functionName !== "platform_admin_set_tenant_payment_mode") {
            return { data: null, error: { message: `Unknown RPC ${functionName}` } };
          }

          return runPaymentModeRpc(args);
        },
      };
    },
  };

  return {
    client,
    settings,
    events,
    rpcCalls,
  };
}

test("missing payment settings resolve to disabled without reading global Square environment", async () => {
  const originalSquareEnvironment = process.env.SQUARE_ENVIRONMENT;
  process.env.SQUARE_ENVIRONMENT = "production";
  const mock = createMockSupabase();

  try {
    const settingResult = await getPlatformTenantPaymentSetting(BUSINESS_ID, "square", {
      supabase: mock.client,
      requirePlatformAdminSession: async () => platformSession(),
    });
    const policy = await getTenantPaymentPolicyForBusiness(BUSINESS_ID, "square", {
      supabase: mock.client,
    });

    assert.equal(settingResult.mode, "disabled");
    assert.equal(settingResult.id, null);
    assert.deepEqual(policy, {
      businessId: BUSINESS_ID,
      provider: "square",
      mode: "disabled",
    });
  } finally {
    if (originalSquareEnvironment === undefined) {
      delete process.env.SQUARE_ENVIRONMENT;
    } else {
      process.env.SQUARE_ENVIRONMENT = originalSquareEnvironment;
    }
  }
});

test("payment setting validation accepts only the protected provider and modes", () => {
  assert.equal(normalizePlatformPaymentProvider(" square "), "square");
  assert.equal(normalizePlatformTenantPaymentMode("disabled"), "disabled");
  assert.equal(normalizePlatformTenantPaymentMode("sandbox"), "sandbox");
  assert.equal(normalizePlatformTenantPaymentMode("production"), "production");
  assert.throws(() => normalizePlatformPaymentProvider("stripe"), PlatformTenantPaymentSettingError);
  assert.throws(() => normalizePlatformTenantPaymentMode("live"), PlatformTenantPaymentSettingError);
});

test("platform-admin authorization is required before payment setting mutation", async () => {
  const mock = createMockSupabase();

  await assert.rejects(
    updatePlatformTenantPaymentMode(
      { businessId: BUSINESS_ID, provider: "square", mode: "sandbox" },
      {
        supabase: mock.client,
        requirePlatformAdminSession: async () => {
          throw new Error("Platform admin access is required.");
        },
      },
    ),
    /Platform admin access is required/,
  );

  assert.equal(mock.rpcCalls.length, 0);
  assert.equal(mock.events.length, 0);
});

test("payment setting mutation sends business, provider, mode, and acting user to the RPC", async () => {
  const mock = createMockSupabase();

  const result = await updatePlatformTenantPaymentMode(
    { businessId: BUSINESS_ID, provider: "square", mode: "sandbox" },
    {
      supabase: mock.client,
      requirePlatformAdminSession: async () => platformSession(),
    },
  );

  assert.equal(result.mode, "sandbox");
  assert.equal(result.changed, true);
  assert.deepEqual(mock.rpcCalls, [
    {
      functionName: "platform_admin_set_tenant_payment_mode",
      args: {
        p_business_id: BUSINESS_ID,
        p_provider: "square",
        p_mode: "sandbox",
        p_actor_auth_user_id: ACTOR_USER_ID,
      },
    },
  ]);
});

test("audit event is written when the mode changes and skipped for no-op updates", async () => {
  const mock = createMockSupabase({
    settings: [setting({ mode: "sandbox" })],
    connections: [connection()],
  });

  const noOp = await updatePlatformTenantPaymentMode(
    { businessId: BUSINESS_ID, provider: "square", mode: "sandbox" },
    {
      supabase: mock.client,
      requirePlatformAdminSession: async () => platformSession(),
    },
  );
  assert.equal(noOp.changed, false);
  assert.equal(mock.events.length, 0);

  const changed = await updatePlatformTenantPaymentMode(
    {
      businessId: BUSINESS_ID,
      provider: "square",
      mode: "production",
      liveConfirmation: "LIVE",
    },
    {
      supabase: mock.client,
      requirePlatformAdminSession: async () => platformSession(),
    },
  );

  assert.equal(changed.changed, true);
  assert.equal(mock.events.length, 1);
  assert.deepEqual(mock.events[0], {
    id: "event-1",
    business_id: BUSINESS_ID,
    provider: "square",
    previous_mode: "sandbox",
    new_mode: "production",
    actor_platform_admin_user_id: ACTOR_USER_ID,
    created_at: "2026-09-29T01:00:00.000Z",
  });

  const listedEvents = await listPlatformTenantPaymentSettingEvents(BUSINESS_ID, "square", {
    supabase: mock.client,
    requirePlatformAdminSession: async () => platformSession(),
  });
  assert.equal(listedEvents.length, 1);
  assert.equal(listedEvents[0].previousMode, "sandbox");
  assert.equal(listedEvents[0].newMode, "production");
});

test("platform payment connection summaries exclude token material", async () => {
  const mock = createMockSupabase({ connections: [connection()] });

  const summaries = await listPlatformTenantPaymentConnections(BUSINESS_ID, "square", {
    supabase: mock.client,
    requirePlatformAdminSession: async () => platformSession(),
  });

  assert.deepEqual(summaries, [
    {
      id: "77777777-7777-4777-8777-777777777777",
      businessId: BUSINESS_ID,
      provider: "square",
      environment: "production",
      status: "active",
      merchantId: "merchant-1",
      locationId: "location-1",
      locationName: "Main location",
      connectedAt: "2026-09-29T00:00:00.000Z",
      updatedAt: "2026-09-29T00:00:00.000Z",
    },
  ]);
  assert.equal("encrypted_access_token" in summaries[0], false);
});

test("Live mode requires confirmation and a ready production Square connection", async () => {
  const noConnection = createMockSupabase();
  const options = {
    supabase: noConnection.client,
    requirePlatformAdminSession: async () => platformSession(),
  };

  await assert.rejects(
    updatePlatformTenantPaymentMode(
      { businessId: BUSINESS_ID, provider: "square", mode: "production" },
      options,
    ),
    (error: unknown) =>
      error instanceof PlatformTenantPaymentSettingError &&
      error.code === "live_confirmation_required",
  );

  await assert.rejects(
    updatePlatformTenantPaymentMode(
      {
        businessId: BUSINESS_ID,
        provider: "square",
        mode: "production",
        liveConfirmation: "LIVE",
      },
      options,
    ),
    (error: unknown) =>
      error instanceof PlatformTenantPaymentSettingError &&
      error.code === "live_connection_required",
  );
  assert.equal(noConnection.rpcCalls.length, 0);

  const readyConnection = createMockSupabase({ connections: [connection()] });
  const result = await updatePlatformTenantPaymentMode(
    {
      businessId: BUSINESS_ID,
      provider: "square",
      mode: "production",
      liveConfirmation: "LIVE",
    },
    {
      supabase: readyConnection.client,
      requirePlatformAdminSession: async () => platformSession(),
    },
  );

  assert.equal(result.mode, "production");
  assert.equal(readyConnection.rpcCalls.length, 1);
});

test("invalid business ids, providers, and modes are rejected before RPC invocation", async () => {
  const mock = createMockSupabase();
  const options = {
    supabase: mock.client,
    requirePlatformAdminSession: async () => platformSession(),
  };

  await assert.rejects(
    updatePlatformTenantPaymentMode({ businessId: "not-a-uuid", provider: "square", mode: "sandbox" }, options),
    PlatformTenantPaymentSettingError,
  );
  await assert.rejects(
    updatePlatformTenantPaymentMode({ businessId: BUSINESS_ID, provider: "stripe", mode: "sandbox" }, options),
    PlatformTenantPaymentSettingError,
  );
  await assert.rejects(
    updatePlatformTenantPaymentMode({ businessId: BUSINESS_ID, provider: "square", mode: "live" }, options),
    PlatformTenantPaymentSettingError,
  );

  assert.equal(mock.rpcCalls.length, 0);
});
