import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAdminInviteAcceptanceUrl,
  findInvitedBusiness,
  parseAdminInviteBrowserLocation,
} from "../src/lib/admin/invite-acceptance.ts";

const DEMO_BUSINESS_ID = "22222222-2222-4222-8222-222222222222";
const TAN_BUSINESS_ID = "11111111-1111-4111-8111-111111111111";

test("brand-new user invites use a tenant-host token-hash acceptance URL", () => {
  const inviteUrl = new URL(
    buildAdminInviteAcceptanceUrl({
      redirectTo: "https://demo-preview.rybsoftware.com/admin/accept-invite",
      businessId: DEMO_BUSINESS_ID,
      tokenHash: "one-time-invite-token-hash",
      type: "invite",
    }),
  );

  assert.equal(inviteUrl.origin, "https://demo-preview.rybsoftware.com");
  assert.equal(inviteUrl.pathname, "/admin/accept-invite");
  assert.equal(inviteUrl.searchParams.get("token_hash"), "one-time-invite-token-hash");
  assert.equal(inviteUrl.searchParams.get("type"), "invite");
  assert.equal(inviteUrl.searchParams.get("business_id"), DEMO_BUSINESS_ID);
  assert.equal(inviteUrl.hash, "");
});

test("existing Auth users receive a tenant-targeted magic-link acceptance URL", () => {
  const inviteUrl = new URL(
    buildAdminInviteAcceptanceUrl({
      redirectTo: "https://demo-preview.rybsoftware.com/admin/accept-invite",
      businessId: DEMO_BUSINESS_ID,
      tokenHash: "one-time-magic-link-hash",
      type: "magiclink",
    }),
  );

  assert.equal(inviteUrl.searchParams.get("type"), "magiclink");
  assert.equal(inviteUrl.searchParams.get("business_id"), DEMO_BUSINESS_ID);
});

test("invite parsing removes raw tokens and one-time auth material from the browser URL", () => {
  const parsed = parseAdminInviteBrowserLocation({
    pathname: "/admin/accept-invite",
    search: `?${new URLSearchParams({ business_id: DEMO_BUSINESS_ID })}`,
    hash: "#access_token=access-secret&refresh_token=refresh-secret&type=magiclink",
  });

  assert.equal(parsed.accessToken, "access-secret");
  assert.equal(parsed.refreshToken, "refresh-secret");
  assert.equal(parsed.type, "magiclink");
  assert.equal(parsed.cleanUrl, `/admin/accept-invite?business_id=${DEMO_BUSINESS_ID}`);
  assert.doesNotMatch(parsed.cleanUrl, /access-secret|refresh-secret|token_hash|code=/);
});

test("token-hash invites retain only tenant intent after immediate URL cleanup", () => {
  const parsed = parseAdminInviteBrowserLocation({
    pathname: "/admin/accept-invite",
    search: `?token_hash=one-time-hash&type=invite&business_id=${DEMO_BUSINESS_ID}`,
    hash: "",
  });

  assert.equal(parsed.tokenHash, "one-time-hash");
  assert.equal(parsed.type, "invite");
  assert.equal(parsed.cleanUrl, `/admin/accept-invite?business_id=${DEMO_BUSINESS_ID}`);
});

test("tenant-target selection preserves every other business membership", () => {
  const businesses = [
    { id: TAN_BUSINESS_ID, name: "Tan Can Man" },
    { id: DEMO_BUSINESS_ID, name: "Demo Dumpster Company" },
  ];

  const selected = findInvitedBusiness(businesses, DEMO_BUSINESS_ID);

  assert.equal(selected?.id, DEMO_BUSINESS_ID);
  assert.deepEqual(businesses.map((business) => business.id), [TAN_BUSINESS_ID, DEMO_BUSINESS_ID]);
});

test("tenant targeting cannot select a business outside active memberships", () => {
  const businesses = [{ id: TAN_BUSINESS_ID, name: "Tan Can Man" }];

  assert.equal(findInvitedBusiness(businesses, DEMO_BUSINESS_ID), null);
});
