import test from "node:test";
import assert from "node:assert/strict";
import { businessUserStatus, normalizeBusinessUserName } from "../src/lib/admin/user-management-types";
import { buildAdminUserInviteEmail } from "../src/lib/email/templates/admin-user-invite";

test("inactive access takes priority over invitation acceptance", () => {
  assert.equal(businessUserStatus("disabled", null), "inactive");
  assert.equal(businessUserStatus("disabled", "2026-10-18"), "inactive");
  assert.equal(businessUserStatus("active", null), "invited");
  assert.equal(businessUserStatus("active", "2026-10-18"), "active");
});
test("names accept international text and reject blank and oversized input", () => {
  assert.equal(normalizeBusinessUserName("  María   李  "), "María 李");
  assert.throws(() => normalizeBusinessUserName(" \n "));
  assert.throws(() => normalizeBusinessUserName("a".repeat(121)));
  assert.throws(() => normalizeBusinessUserName(null));
  assert.equal(normalizeBusinessUserName("a".repeat(120)).length, 120);
});
test("personalized invitations escape names and keep the acceptance link", () => {
  const email = buildAdminUserInviteEmail({ businessName: "Example Business", recipientName: '<Jane & "Team">', inviteUrl: "https://example.test/admin/accept-invite?type=invite&business_id=demo", roleLabel: "Admin" });
  assert.match(email.text, /Hi <Jane & "Team">,/);
  assert.match(email.html, /Hi &lt;Jane &amp; &quot;Team&quot;&gt;,/);
  assert.doesNotMatch(email.html, /<Jane/);
  assert.match(email.html, /type=invite&amp;business_id=demo/);
});
