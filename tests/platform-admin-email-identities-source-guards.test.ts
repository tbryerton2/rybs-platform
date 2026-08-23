import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("platform email identity service stays platform-admin scoped", () => {
  const source = readRepoFile("src/lib/platform-admin/email-identities.ts");

  assert.match(source, /await requirePlatformAdmin\(\);/);
  assert.match(source, /\.from\("tenant_email_identities"\)/);
  assert.match(source, /findTenantByIdStrict\(tenantId\.value, \{ requireActive: false \}\)/);
  assert.doesNotMatch(source, /getCurrentTenant\(/);
  assert.doesNotMatch(source, /requireAdminOwner/);
  assert.doesNotMatch(source, /sendEmail\(/);
});

test("platform email identity mutations protect tenant/domain ownership assumptions", () => {
  const source = readRepoFile("src/lib/platform-admin/email-identities.ts");

  assert.match(source, /assertSenderDomainAvailableForTenant/);
  assert.match(source, /\.eq\("sender_domain", senderDomain\)/);
  assert.match(source, /existing\.business_id === tenantId/);
  assert.match(source, /assertDomainCanBeChanged/);
  assert.match(source, /existing\.providerStatus === "verified"/);
  assert.match(source, /existing\.providerStatus === "dns_required"/);
  assert.match(source, /existing\.providerStatus === "failed"/);
  assert.match(source, /Remove the existing SES email identity before changing the sender domain/);
});

test("platform email identity provider removal is provider-aware and database deletion waits", () => {
  const source = readRepoFile("src/lib/platform-admin/email-identities.ts");

  assert.match(source, /shouldRemoveSesIdentity/);
  assert.match(source, /await removeSesEmailIdentity\(\{ senderDomain: identity\.senderDomain \}\)/);
  assert.match(source, /await markEmailIdentityProviderError\(identity, providerError\)/);
  assert.match(source, /throw providerError/);
  assert.match(source, /\.from\("tenant_email_identities"\)\s+\.delete\(\)/);
});

test("platform business detail exposes email identity management without changing email sending", () => {
  const detailPage = readRepoFile("src/app/platform-admin/(protected)/businesses/[tenantId]/page.tsx");
  const actions = readRepoFile("src/app/platform-admin/(protected)/businesses/actions.ts");
  const emailSender = readRepoFile("src/lib/email/ses.ts");

  assert.match(detailPage, /function EmailSendingSection/);
  assert.match(detailPage, /saveEmailIdentityAction/);
  assert.match(detailPage, /provisionEmailIdentityAction/);
  assert.match(detailPage, /checkEmailIdentityAction/);
  assert.match(detailPage, /Derived From address/);
  assert.match(actions, /savePlatformTenantEmailIdentity/);
  assert.match(actions, /provisionPlatformTenantEmailIdentity/);
  assert.match(actions, /checkPlatformTenantEmailIdentity/);
  assert.doesNotMatch(actions, /sendEmail\(/);
  assert.match(emailSender, /SES_FROM_EMAIL/);
  assert.match(emailSender, /SES_REPLY_TO_EMAIL/);
});

test("Tan Can Man can move from seeded pending identity to SES check without provisioning", () => {
  const migration = readRepoFile("supabase/migrations/202608190101_tenant_email_identities.sql");
  const service = readRepoFile("src/lib/platform-admin/email-identities.ts");

  assert.match(migration, /'tancanman\.com'/);
  assert.match(migration, /'bookings'/);
  assert.match(migration, /'pending',\s+'pending'/);
  assert.match(service, /export async function checkPlatformTenantEmailIdentity/);
  assert.match(service, /fetchSesEmailIdentitySnapshot\(\{ senderDomain: identity\.senderDomain \}\)/);
  assert.doesNotMatch(migration, /verified',\s+'verified'/);
});
