import test from "node:test";
import assert from "node:assert/strict";

import {
  buildVercelDomainSnapshot,
  createVercelDomainClient,
  isPlatformSubdomainCoveredByConfiguredWildcard,
  provisionVercelProjectDomain,
} from "../src/lib/platform-admin/vercel-domains.ts";

function jsonResponse(body: unknown, init?: ResponseInit) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
    ...init,
  });
}

test("Vercel client provisions a project domain with server-only bearer auth and team scope", async () => {
  const calls: Array<{ url: string; method?: string; authorization?: string | null; body?: string | null }> = [];
  const fetcher: typeof fetch = async (url, init) => {
    calls.push({
      url: url.toString(),
      method: init?.method,
      authorization: new Headers(init?.headers).get("authorization"),
      body: typeof init?.body === "string" ? init.body : null,
    });

    if (url.toString().includes("/v10/projects/prj_123/domains")) {
      return jsonResponse({ name: "book.example.com", verified: true });
    }

    if (url.toString().includes("/v9/projects/prj_123/domains/book.example.com")) {
      return jsonResponse({ name: "book.example.com", verified: true });
    }

    if (url.toString().includes("/v6/domains/book.example.com/config")) {
      return jsonResponse({
        configured: false,
        misconfigured: true,
        recommendedCNAME: "book-example.vercel-dns-016.com",
      });
    }

    throw new Error(`Unexpected URL ${url.toString()}`);
  };

  const client = createVercelDomainClient({
    token: "vercel_test_token",
    projectId: "prj_123",
    teamId: "team_123",
    fetcher,
  });
  const snapshot = await provisionVercelProjectDomain({ hostname: "book.example.com", client });

  assert.equal(snapshot.providerStatus, "awaiting_dns");
  assert.equal(snapshot.dnsInstructions?.records[0]?.type, "CNAME");
  assert.equal(snapshot.dnsInstructions?.records[0]?.value, "book-example.vercel-dns-016.com");
  assert.ok(calls.every((call) => call.url.includes("teamId=team_123")));
  assert.ok(calls.every((call) => call.authorization === "Bearer vercel_test_token"));
  assert.ok(calls.every((call) => !call.url.includes("vercel_test_token")));
  assert.ok(calls.every((call) => !call.body?.includes("vercel_test_token")));
});

test("Vercel ownership verification TXT records are surfaced separately from DNS configuration", () => {
  const snapshot = buildVercelDomainSnapshot({
    hostname: "example.com",
    projectDomain: {
      name: "example.com",
      verified: false,
      verification: [
        {
          type: "TXT",
          domain: "_vercel.example.com",
          value: "vercel-site-verification=abc123",
          reason: "Domain belongs to another Vercel account.",
        },
      ],
    },
    domainConfig: {
      configured: true,
      misconfigured: false,
    },
  });

  assert.equal(snapshot.providerStatus, "awaiting_verification");
  assert.equal(snapshot.verificationStatus, "verification_required");
  assert.deepEqual(snapshot.dnsInstructions?.records[0], {
    type: "TXT",
    name: "_vercel.example.com",
    value: "vercel-site-verification=abc123",
    reason: "Domain belongs to another Vercel account.",
  });
});

test("existing Vercel project-domain attachments reconcile idempotently", async () => {
  const methods: string[] = [];
  const fetcher: typeof fetch = async (url, init) => {
    methods.push(`${init?.method ?? "GET"} ${new URL(url.toString()).pathname}`);

    if (init?.method === "POST") {
      return jsonResponse(
        { error: { code: "not_modified", message: "The domain already exists" } },
        { status: 400 },
      );
    }

    if (url.toString().includes("/v9/projects/prj_123/domains/app.example.com")) {
      return jsonResponse({ name: "app.example.com", verified: true });
    }

    return jsonResponse({ configured: true, misconfigured: false });
  };

  const client = createVercelDomainClient({
    token: "token",
    projectId: "prj_123",
    fetcher,
  });
  const snapshot = await provisionVercelProjectDomain({ hostname: "app.example.com", client });

  assert.equal(snapshot.providerStatus, "ready");
  assert.ok(methods.some((method) => method.startsWith("POST /v10/projects/prj_123/domains")));
  assert.ok(methods.some((method) => method.startsWith("GET /v9/projects/prj_123/domains/app.example.com")));
});

test("platform subdomain wildcard coverage is environment driven", () => {
  assert.equal(
    isPlatformSubdomainCoveredByConfiguredWildcard("demo.example-platform.com", {
      PLATFORM_PUBLIC_BASE_DOMAIN: "example-platform.com",
    }),
    true,
  );
  assert.equal(
    isPlatformSubdomainCoveredByConfiguredWildcard("example-platform.com", {
      PLATFORM_PUBLIC_BASE_DOMAIN: "example-platform.com",
    }),
    false,
  );
  assert.equal(
    isPlatformSubdomainCoveredByConfiguredWildcard("demo.other-platform.com", {
      PLATFORM_PUBLIC_BASE_DOMAIN: "example-platform.com",
    }),
    false,
  );
});
