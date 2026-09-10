import test, { afterEach, beforeEach } from "node:test";
import assert from "node:assert/strict";

import {
  buildSquareOAuthAuthorizationUrl,
  decryptPaymentProviderToken,
  exchangeSquareOAuthCode,
  encryptPaymentProviderToken,
  getSquareCheckoutConfigurationForBusiness,
  getSquareOAuthConfigurationStatus,
  listSquareLocationsForAccessToken,
  resolveTenantPaymentProviderConnection,
  SQUARE_OAUTH_CALLBACK_PATH,
  SQUARE_OAUTH_SCOPES,
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
  squareOauthApplicationId: process.env.SQUARE_OAUTH_APPLICATION_ID,
  squareOauthApplicationSecret: process.env.SQUARE_OAUTH_APPLICATION_SECRET,
  squareOauthRedirectUrl: process.env.SQUARE_OAUTH_REDIRECT_URL,
  nextPublicSiteUrl: process.env.NEXT_PUBLIC_SITE_URL,
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
  process.env.SQUARE_OAUTH_APPLICATION_ID = "sandbox-square-oauth-application-id";
  process.env.SQUARE_OAUTH_APPLICATION_SECRET = "square-oauth-application-secret";
  process.env.NEXT_PUBLIC_SITE_URL = "https://app.rybs.example";
  delete process.env.SQUARE_OAUTH_REDIRECT_URL;
  process.env.SQUARE_LOCATION_ID = "legacy-location";
  process.env.PAYMENT_PROVIDER_TOKEN_ENCRYPTION_KEY = `base64:${TEST_KEY}`;
});

afterEach(() => {
  restoreEnv("SQUARE_ENVIRONMENT", originalEnv.squareEnvironment);
  restoreEnv("SQUARE_ACCESS_TOKEN", originalEnv.squareAccessToken);
  restoreEnv("SQUARE_APPLICATION_ID", originalEnv.squareApplicationId);
  restoreEnv("SQUARE_OAUTH_APPLICATION_ID", originalEnv.squareOauthApplicationId);
  restoreEnv("SQUARE_OAUTH_APPLICATION_SECRET", originalEnv.squareOauthApplicationSecret);
  restoreEnv("SQUARE_OAUTH_REDIRECT_URL", originalEnv.squareOauthRedirectUrl);
  restoreEnv("NEXT_PUBLIC_SITE_URL", originalEnv.nextPublicSiteUrl);
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

test("Square OAuth configuration reports required server-side setup without exposing secrets", () => {
  const status = getSquareOAuthConfigurationStatus();

  assert.equal(status.configured, true);
  assert.equal(status.applicationIdConfigured, true);
  assert.equal(status.applicationSecretConfigured, true);
  assert.equal(status.redirectUrl, `https://app.rybs.example${SQUARE_OAUTH_CALLBACK_PATH}`);
  assert.equal("applicationSecret" in status, false);
});

test("Square OAuth authorization URL uses configured app id, scopes, redirect URL, and state", () => {
  const url = new URL(buildSquareOAuthAuthorizationUrl({ state: "state-123" }));

  assert.equal(url.origin, "https://connect.squareupsandbox.com");
  assert.equal(url.pathname, "/oauth2/authorize");
  assert.equal(url.searchParams.get("client_id"), "sandbox-square-oauth-application-id");
  assert.equal(url.searchParams.get("state"), "state-123");
  assert.equal(url.searchParams.get("redirect_uri"), `https://app.rybs.example${SQUARE_OAUTH_CALLBACK_PATH}`);

  const scopes = new Set((url.searchParams.get("scope") ?? "").split(" "));
  for (const scope of SQUARE_OAUTH_SCOPES) {
    assert.equal(scopes.has(scope), true, `${scope} should be requested`);
  }
});

test("Square OAuth token exchange keeps token material in the server result only", async () => {
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const fakeFetch = async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")) as Record<string, unknown>,
    });
    return Response.json({
      access_token: "oauth-access-token",
      refresh_token: "oauth-refresh-token",
      expires_at: "2026-10-01T00:00:00Z",
      merchant_id: "merchant-123",
      scope: "MERCHANT_PROFILE_READ PAYMENTS_WRITE",
    });
  };

  const result = await exchangeSquareOAuthCode({ code: "auth-code" }, { fetch: fakeFetch });

  assert.equal(result.accessToken, "oauth-access-token");
  assert.equal(result.refreshToken, "oauth-refresh-token");
  assert.equal(result.merchantId, "merchant-123");
  assert.deepEqual(result.grantedScopes, ["MERCHANT_PROFILE_READ", "PAYMENTS_WRITE"]);
  assert.equal(requests[0].url, "https://connect.squareupsandbox.com/oauth2/token");
  assert.equal(requests[0].body.client_id, "sandbox-square-oauth-application-id");
  assert.equal(requests[0].body.client_secret, "square-oauth-application-secret");
  assert.equal(requests[0].body.grant_type, "authorization_code");
});

test("Square location listing returns safe location options", async () => {
  const fakeFetch = async (_url: string | URL | Request, init?: RequestInit) => {
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer oauth-access-token");
    return Response.json({
      locations: [
        {
          id: "loc-1",
          name: "Main yard",
          status: "ACTIVE",
          address: {
            address_line_1: "1 Main St",
            locality: "Cincinnati",
            administrative_district_level_1: "OH",
            postal_code: "45202",
          },
        },
      ],
    });
  };

  const locations = await listSquareLocationsForAccessToken(
    { accessToken: "oauth-access-token", environment: "sandbox" },
    { fetch: fakeFetch },
  );

  assert.deepEqual(locations, [
    {
      id: "loc-1",
      name: "Main yard",
      status: "ACTIVE",
      addressSummary: "1 Main St, Cincinnati, OH, 45202",
      isActive: true,
    },
  ]);
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
    applicationId: "sandbox-square-oauth-application-id",
    locationId: "location-1",
  });
  assert.equal("accessToken" in config, false);
});
