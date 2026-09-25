import test from "node:test";
import assert from "node:assert/strict";

import {
  getCanonicalAdminRedirectUrl,
  isAdminSurfacePath,
  normalizeAdminAppOrigin,
} from "../src/lib/admin/app-url.ts";

test("normalizes a configured admin app origin", () => {
  assert.equal(
    normalizeAdminAppOrigin("https://app.rybsoftware.com/"),
    "https://app.rybsoftware.com",
  );
});

test("rejects admin app URLs with paths or non-http protocols", () => {
  assert.throws(
    () => normalizeAdminAppOrigin("https://app.rybsoftware.com/admin"),
    /only an origin/,
  );
  assert.throws(
    () => normalizeAdminAppOrigin("ftp://app.rybsoftware.com"),
    /http or https/,
  );
});

test("recognizes business and platform admin surfaces only", () => {
  assert.equal(isAdminSurfacePath("/admin"), true);
  assert.equal(isAdminSurfacePath("/admin/login"), true);
  assert.equal(isAdminSurfacePath("/platform-admin/businesses"), true);
  assert.equal(isAdminSurfacePath("/portal"), false);
  assert.equal(isAdminSurfacePath("/administrator"), false);
});

test("redirects customer-host admin paths to the canonical app and preserves query", () => {
  assert.equal(
    getCanonicalAdminRedirectUrl({
      requestUrl: "https://customer.example.com/admin/login?next=%2Fadmin%2Fbookings",
      adminAppUrl: "https://app.rybsoftware.com",
    })?.toString(),
    "https://app.rybsoftware.com/admin/login?next=%2Fadmin%2Fbookings",
  );
});

test("does not redirect canonical, public, or unconfigured requests", () => {
  assert.equal(
    getCanonicalAdminRedirectUrl({
      requestUrl: "https://app.rybsoftware.com/admin/login",
      adminAppUrl: "https://app.rybsoftware.com",
    }),
    null,
  );
  assert.equal(
    getCanonicalAdminRedirectUrl({
      requestUrl: "https://customer.example.com/portal",
      adminAppUrl: "https://app.rybsoftware.com",
    }),
    null,
  );
  assert.equal(
    getCanonicalAdminRedirectUrl({
      requestUrl: "http://localhost:3000/admin/login",
    }),
    null,
  );
});
