import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..");

function readRepoFile(path: string) {
  return readFileSync(resolve(repoRoot, path), "utf8");
}

test("admin reports page uses production website funnel data instead of conversion mock data", () => {
  const pageSource = readRepoFile("src/app/admin/(protected)/analytics/conversion/page.tsx");
  const dataSource = readRepoFile("src/lib/admin/reports.ts");

  assert.doesNotMatch(pageSource, /mock-data/);
  assert.doesNotMatch(dataSource, /mock-data/);
  assert.match(pageSource, /Website funnel health/);
  assert.match(dataSource, /get_admin_reports_website_funnel_metrics/);
});

test("website funnel report filters are explicit and persisted in report hrefs", () => {
  const source = readRepoFile("src/lib/admin/reports.ts");

  assert.match(source, /type DeviceFilterKey = "all" \| "desktop" \| "mobile" \| "tablet"/);
  assert.match(source, /type VisitorFilterKey = "all" \| "new" \| "returning"/);
  assert.match(source, /params\.set\("device", next\.device\)/);
  assert.match(source, /params\.set\("visitorType", next\.visitorType\)/);
});

test("admin reports dumpster type filter uses tenant product catalog options", () => {
  const source = readRepoFile("src/lib/admin/reports.ts");
  const pageSource = readRepoFile("src/app/admin/(protected)/analytics/conversion/page.tsx");

  assert.match(source, /getPublicDumpsterProducts\(undefined, input\.businessId\)/);
  assert.match(source, /getDumpsterSizeCapacity\(left\.dumpsterSize\)/);
  assert.match(source, /return leftCapacity - rightCapacity/);
  assert.match(source, /product\.displayName\.trim\(\)/);
  assert.match(source, /`product:\$\{productId\}`/);
  assert.match(source, /\{ value: "all", label: "All dumpster types" \}/);
  assert.doesNotMatch(pageSource, /14-yard dumpster/);
  assert.doesNotMatch(pageSource, /20-yard dumpster/);
  assert.doesNotMatch(pageSource, /50-yard dumpster/);
});

test("website funnel RPC migration is tenant-scoped and clamps to reliable tracking start", () => {
  const source = readRepoFile("supabase/migrations/202608140101_admin_reports_website_funnel_metrics.sql");

  assert.match(source, /website_funnel_tracking_started_at/);
  assert.match(source, /tenant_settings_tenant_category_key_unique/);
  assert.match(source, /s\.business_id = p\.business_id/);
  assert.match(source, /event\.business_id = s\.business_id/);
  assert.match(source, /event\.visitor_id = s\.visitor_id/);
  assert.match(source, /greatest\(requested_current_start_at, tracking_started_at\)/);
  assert.match(source, /grant execute on function public\.get_admin_reports_website_funnel_metrics/);
});

test("website funnel RPC calculates completion and step progression from first-party analytics tables", () => {
  const source = readRepoFile("supabase/migrations/202608140101_admin_reports_website_funnel_metrics.sql");

  assert.match(source, /from public\.analytics_booking_sessions/);
  assert.match(source, /join public\.analytics_booking_events/);
  assert.match(source, /event\.event_name = 'booking_step_viewed'/);
  assert.match(source, /completed_at is not null/);
  assert.match(source, /booking_id is not null/);
  assert.match(source, /count\(\*\)::integer as sessions_started/);
  assert.match(source, /count\(\*\) filter/);
  assert.match(source, /'confirmation'/);
});

test("admin reports portal value uses request breakdown instead of ambiguous portal access percentage", () => {
  const pageSource = readRepoFile("src/app/admin/(protected)/analytics/conversion/page.tsx");
  const dataSource = readRepoFile("src/lib/admin/reports.ts");
  const migrationSource = readRepoFile("supabase/migrations/202608150101_admin_reports_portal_request_breakdown.sql");

  assert.doesNotMatch(pageSource, /Factual portal signals supported by current persisted account and request data/);
  assert.doesNotMatch(dataSource, /Portal access activated/);
  assert.match(dataSource, /Portal requests submitted/);
  assert.match(dataSource, /pickupRequestCount/);
  assert.match(dataSource, /extensionRequestCount/);
  assert.match(dataSource, /issueReportCount/);
  assert.match(migrationSource, /request\.action_type = 'pickup_request'/);
  assert.match(migrationSource, /request\.action_type = 'extension_request'/);
  assert.match(migrationSource, /request\.action_type = 'issue_report'/);
  assert.match(migrationSource, /request\.business_id = p\.business_id/);
  assert.match(migrationSource, /request\.submitted_at/);
});

test("admin reports portal value uses explicit portal activity and activation tracking", () => {
  const pageSource = readRepoFile("src/app/admin/(protected)/analytics/conversion/page.tsx");
  const dataSource = readRepoFile("src/lib/admin/reports.ts");
  const authSource = readRepoFile("src/lib/portal/auth.ts");
  const migrationSource = readRepoFile("supabase/migrations/202608150102_portal_usage_tracking_reports.sql");

  assert.doesNotMatch(dataSource, /Pickup, extension, and issue requests submitted through the customer portal/);
  assert.match(pageSource, /metric\.helper \?/);
  assert.match(dataSource, /label: "Portal users"/);
  assert.match(dataSource, /label: "New portal users"/);
  assert.match(dataSource, /portalUserCount/);
  assert.match(dataSource, /newPortalUserCount/);

  assert.match(authSource, /async function recordPortalAccess/);
  assert.match(authSource, /requirePortalCustomer/);
  assert.match(authSource, /ignoreDuplicates: true/);
  assert.match(authSource, /formatDateInTimeZone\(now, getBusinessTimeZone\(\)\)/);
  assert.match(authSource, /onConflict: "business_id,customer_id,event_type,occurred_on"/);
  assert.match(authSource, /\.is\("portal_activated_at", null\)/);
  assert.match(authSource, /update\(\{ portal_activated_at: now \}\)/);
  assert.match(authSource, /catch \(error\)/);

  assert.match(migrationSource, /add column if not exists portal_activated_at timestamptz/);
  assert.match(migrationSource, /create table if not exists public\.portal_activity_events/);
  assert.match(migrationSource, /check \(event_type in \('portal_accessed'\)\)/);
  assert.match(migrationSource, /portal_activity_events_daily_access_key/);
  assert.match(migrationSource, /occurred_on date not null/);
  assert.match(migrationSource, /business-local reporting date/i);
  assert.doesNotMatch(migrationSource, /occurred_on_utc/);
  assert.match(migrationSource, /foreign key \(customer_id, business_id\)/);
  assert.match(migrationSource, /enable row level security/);
  assert.match(migrationSource, /revoke all on table public\.portal_activity_events from anon/);
  assert.match(migrationSource, /grant all on table public\.portal_activity_events to service_role/);
  assert.match(migrationSource, /prevent_portal_activated_at_overwrite/);
  assert.match(migrationSource, /count\(distinct event\.customer_id\)::integer as portal_user_count/);
  assert.match(migrationSource, /customer\.portal_activated_at >= p\.previous_start_at/);
});
