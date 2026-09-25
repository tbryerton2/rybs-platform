import test from "node:test";
import assert from "node:assert/strict";

import { getAdminAuthRedirectUrl } from "../src/lib/admin/auth-redirects.ts";

test("admin invite redirect prefers the configured admin app over the request host", () => {
  assert.equal(
    getAdminAuthRedirectUrl("/admin/accept-invite", {
      adminAppUrl: "https://app.rybsoftware.com",
      forwardedHost: "demo-preview.rybsoftware.com",
      forwardedProto: "https",
      siteUrl: "http://localhost:3000",
      nodeEnv: "production",
    }),
    "https://app.rybsoftware.com/admin/accept-invite",
  );
});

test("admin invite redirect keeps preview hosts usable when no canonical app is configured", () => {
  assert.equal(
    getAdminAuthRedirectUrl("/admin/accept-invite", {
      host: "demo-preview.rybsoftware.com",
      forwardedProto: "https",
      siteUrl: "https://rybsoftware.com",
      nodeEnv: "production",
    }),
    "https://demo-preview.rybsoftware.com/admin/accept-invite",
  );
});

test("admin invite redirect keeps local development links local", () => {
  assert.equal(
    getAdminAuthRedirectUrl("/admin/accept-invite", {
      host: "localhost:3000",
      siteUrl: "https://app.rybsoftware.com",
      nodeEnv: "development",
    }),
    "http://localhost:3000/admin/accept-invite",
  );
});

test("admin invite redirect ignores malformed forwarded hosts before tenant fallback", () => {
  assert.equal(
    getAdminAuthRedirectUrl("/admin/accept-invite", {
      forwardedHost: "https://bad_host_name:3000/admin",
      fallbackBaseUrl: "https://fallback-tenant.example.com",
      siteUrl: "http://localhost:3000",
      nodeEnv: "production",
    }),
    "https://fallback-tenant.example.com/admin/accept-invite",
  );
});

test("admin password recovery still falls back to localhost without request or configured URLs", () => {
  assert.equal(
    getAdminAuthRedirectUrl("/admin/update-password", {
      nodeEnv: "development",
    }),
    "http://localhost:3000/admin/update-password",
  );
});
