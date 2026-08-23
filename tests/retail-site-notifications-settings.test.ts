import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("retail site settings persist booking notification email under tenant notifications", () => {
  const source = readRepoFile("src/lib/tenant/retail-site-settings.ts");

  assert.match(source, /const SETTINGS_CATEGORY_NOTIFICATIONS = "notifications"/);
  assert.match(source, /bookingEmail: settings\.get\(`\$\{SETTINGS_CATEGORY_NOTIFICATIONS\}\.bookingEmail`\) \?\? ""/);
  assert.match(source, /category: SETTINGS_CATEGORY_NOTIFICATIONS,\s+key: "bookingEmail",\s+value_json: settings\.notifications\.bookingEmail/s);
  assert.match(source, /A valid booking notification email address is required/);
  assert.doesNotMatch(source, /ADMIN_BOOKING_EMAIL/);
});

test("retail site settings editor exposes a separate booking notification email field", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/retail-site/retail-site-settings-editor.tsx");

  assert.match(source, /\{ id: "notifications", label: "Notifications" \}/);
  assert.match(source, /label="Booking notification email"/);
  assert.match(source, /Private\. New booking notifications will be sent to this email address\./);
  assert.match(source, /settings\.notifications\.bookingEmail/);
  assert.match(source, /current\.notifications\.bookingEmail = value/);
  assert.match(source, /Enter a valid booking notification email address\./);
  assert.match(source, /credentials: "include"/);

  const notificationsSection = source.slice(
    source.indexOf('activeTab === "notifications"'),
    source.indexOf('activeTab === "homeVisibility"'),
  );

  assert.doesNotMatch(notificationsSection, /settings\.header\.emailAddress/);
  assert.doesNotMatch(notificationsSection, /ADMIN_BOOKING_EMAIL/);
});

test("retail site public contact email remains separate from private notification email", () => {
  const source = readRepoFile("src/app/admin/(protected)/settings/retail-site/retail-site-settings-editor.tsx");

  assert.match(source, /title="Public contact email"/);
  assert.match(source, /label="Public contact email"/);
  assert.match(source, /Shown to customers on your website\./);
  assert.match(source, /current\.header\.emailAddress = value/);
});
