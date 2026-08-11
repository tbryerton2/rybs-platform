import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("business-admin forgot password sends Supabase recovery to admin update-password", () => {
  const source = readRepoFile("src/app/admin/(auth)/forgot-password/actions.ts");

  assert.match(source, /resetPasswordForEmail\(email,\s*\{/);
  assert.match(source, /redirectTo/);
  assert.match(source, /\/admin\/update-password/);
  assert.match(source, /NEXT_PUBLIC_SITE_URL/);
  assert.match(source, /headers\(\)/);
  assert.doesNotMatch(source, /platform-admin/);
  assert.doesNotMatch(source, /business_admin_memberships/);
});

test("business-admin update password consumes recovery session and updates Supabase password", () => {
  const source = readRepoFile("src/app/admin/(auth)/update-password/update-password-client.tsx");

  assert.match(source, /verifyOtp\(\{[\s\S]*type: "recovery"/);
  assert.match(source, /exchangeCodeForSession\(code\)/);
  assert.match(source, /setSession\(\{/);
  assert.match(source, /updateUser\(\{ password \}\)/);
  assert.match(source, /router\.replace\("\/admin\/login\?success=password-updated"\)/);
  assert.doesNotMatch(source, /platform-admin/);
  assert.doesNotMatch(source, /business_admin_memberships/);
});

test("business-admin login links to recovery and displays reset success", () => {
  const source = readRepoFile("src/app/admin/(auth)/login/page.tsx");

  assert.match(source, /href=\{`\/admin\/forgot-password/);
  assert.match(source, /Forgot password\?/);
  assert.match(source, /success === "password-updated"/);
  assert.doesNotMatch(source, /platform-admin/);
});

test("platform admin recovery is not wired in this phase", () => {
  const platformLogin = readRepoFile("src/app/platform-admin/(auth)/login/page.tsx");
  const platformActions = readRepoFile("src/app/platform-admin/(auth)/login/actions.ts");

  assert.doesNotMatch(platformLogin, /forgot-password|update-password|resetPasswordForEmail/);
  assert.doesNotMatch(platformActions, /forgot-password|update-password|resetPasswordForEmail/);
});
