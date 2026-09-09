import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  decryptPaymentProviderToken,
  encryptPaymentProviderToken,
  getSquareCheckoutConfigurationForBusiness,
  resolveTenantPaymentProviderConnection,
  TenantPaymentProviderConnectionError,
} from "../src/lib/payments/tenant-payment-provider-connections.ts";

const BUSINESS_ID = "11111111-1111-4111-8111-111111111111";
const CONNECTION_ID = "22222222-2222-4222-8222-222222222222";
const TEST_KEY = Buffer.from("12345678901234567890123456789012", "utf8").toString("base64");

type Row = Record<string, unknown>;
type Filter = { column: string; value: unknown };

const originalEnv = {
  squareEnvironment: process.env.SQUARE_ENVIRONMENT,
  squareAccessToken: process.env.SQUARE_ACCESS_TOKEN,
  squareApplicationId: process.env.SQUARE_APPLICATION_ID,
  squareLocationId: process.env.SQUARE_LOCATION_ID,
  tokenEncryptionKey: process.env.PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY,
};

function restoreEnv(name: string, value: string | undefined) {
  if (value === undefined) {
    delete process.env[name];
    return;
  }

  process.env[name] = value;
}

beforeEach(() => {
  process.env.SQUARE_ENVIRONMENT = "sandbox";
  process.env.SQUARE_ACCESS_TOKEN = "legacy-square-token";
  process.env.SQUARE_APPLICATION_ID = "sandbox-square-application-id";
  process.env.SQUARE_LOCATION_ID = "legacy-location";
  process.env.PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY = `base64:${TEST_KEY}`;
});

afterEach(() => {
  restoreEnv("SQUARE_ENVIRONMENT", originalEnv.squareEnvironment);
  restoreEnv("SQUARE_ACCESS_TOKEN", originalEnv.squareAccessToken);
  restoreEnv("SQUARE_APPLICATION_ID", originalEnv.squareApplicationId);
  restoreEnv("SQUARE_LOCATION_ID", originalEnv.squareLocationId);
  restoreEnv("PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY", originalEnv.tokenEncryptionKey);
});

function matches(row: Row, filters: Filter[]) {
  return filters.every((filter) => row[filter.column] === filter.value);
}

function createMockSupabase(rows: Row[], lookupError: unknown = null) {
  const filters: Filter[] = [];

  const client = {
    from(table: "tenant_payment_provider_connections") {
      assert.equal(table, "tenant_payment_provider_connections");
      return {
        select(columns: string) {
          assert.match(columns, /encrypted_access_token/);
          return this;
        },
        eq(column: string, value: string) {
          filters.push({ column, value });
          return this;
        },
        order() {
          return this;
        },
        limit() {
          return this;
        },
        async maybeSingle() {
          if (lookupError) {
            return { data: null, error: lookupError };
          }

          return {
            data: rows.find((row) => matches(row, filters)) ?? null,
            error: null,
          };
        },
      };
    },
  };

  return {
    client,
    filters,
  };
}

test("payment provider token encryption round trips without exposing the plaintext", () => {
  const encrypted = encryptPaymentProviderToken("tenant-square-token");

  assert.equal(encrypted.cipherVersion, 1);
  assert.equal(encrypted.keyId, "PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY");
  assert.notEqual(encrypted.encryptedToken, "tenant-square-token");
  assert.equal(decryptPaymentProviderToken(encrypted.encryptedToken), "tenant-square-token");
});

test("resolveTenantPaymentProviderConnection returns the active tenant Square connection", async () => {
  const encrypted = encryptPaymentProviderToken("tenant-square-token");
  const mock = createMockSupabase([
    {
      id: CONNECTION_ID,
      business_id: BUSINESS_ID,
      provider: "square",
      provider_environment: "sandbox",
      status: "active",
      provider_merchant_id: "merchant-1",
      provider_location_id: "location-1",
      encrypted_access_token: encrypted.encryptedToken,
      token_cipher_version: encrypted.cipherVersion,
      token_cipher_key_id: encrypted.keyId,
    },
  ]);

  const connection = await resolveTenantPaymentProviderConnection(
    { businessId: BUSINESS_ID, provider: "square" },
    { supabase: mock.client, getTenantById: async () => null },
  );

  assert.equal(connection.id, CONNECTION_ID);
  assert.equal(connection.mode, "tenant_connection");
  assert.equal(connection.businessId, BUSINESS_ID);
  assert.equal(connection.providerMerchantId, "merchant-1");
  assert.equal(connection.providerLocationId, "location-1");
  assert.equal(connection.accessToken, "tenant-square-token");
  assert.deepEqual(
    mock.filters.map((filter) => [filter.column, filter.value]),
    [
      ["business_id", BUSINESS_ID],
      ["provider", "square"],
      ["provider_environment", "sandbox"],
      ["status", "active"],
    ],
  );
});

test("resolveTenantPaymentProviderConnection keeps the legacy Square fallback Tan Can Man-only", async () => {
  const missingTable = { code: "42P01", message: "relation does not exist" };
  const tanCanManConnection = await resolveTenantPaymentProviderConnection(
    { businessId: BUSINESS_ID, provider: "square" },
    {
      supabase: createMockSupabase([], missingTable).client,
      getTenantById: async () => ({
        id: BUSINESS_ID,
        slug: "tan-can-man",
        status: "active",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-01-01T00:00:00.000Z",
      }),
    },
  );

  assert.equal(tanCanManConnection.mode, "legacy_tan_can_man_fallback");
  assert.equal(tanCanManConnection.id, null);
  assert.equal(tanCanManConnection.accessToken, "legacy-square-token");
  assert.equal(tanCanManConnection.providerLocationId, "legacy-location");

  await assert.rejects(
    () =>
      resolveTenantPaymentProviderConnection(
        { businessId: BUSINESS_ID, provider: "square" },
        {
          supabase: createMockSupabase([], missingTable).client,
          getTenantById: async () => ({
            id: BUSINESS_ID,
            slug: "demo-dumpster-company",
            status: "active",
            created_at: "2026-01-01T00:00:00.000Z",
            updated_at: "2026-01-01T00:00:00.000Z",
          }),
        },
      ),
    (error) =>
      error instanceof TenantPaymentProviderConnectionError &&
      error.code === "TENANT_PAYMENT_PROVIDER_CONNECTION_MISSING",
  );
});

test("getSquareCheckoutConfigurationForBusiness returns only browser-safe Square config", async () => {
  const encrypted = encryptPaymentProviderToken("tenant-square-token");
  const mock = createMockSupabase([
    {
      id: CONNECTION_ID,
      business_id: BUSINESS_ID,
      provider: "square",
      provider_environment: "sandbox",
      status: "active",
      provider_merchant_id: "merchant-1",
      provider_location_id: "location-1",
      encrypted_access_token: encrypted.encryptedToken,
      token_cipher_version: encrypted.cipherVersion,
      token_cipher_key_id: encrypted.keyId,
    },
  ]);

  const config = await getSquareCheckoutConfigurationForBusiness(
    { businessId: BUSINESS_ID },
    { supabase: mock.client, getTenantById: async () => null },
  );

  assert.deepEqual(config, {
    configured: true,
    provider: "square",
    environment: "sandbox",
    applicationId: "sandbox-square-application-id",
    locationId: "location-1",
  });
  assert.equal("accessToken" in config, false);
});
