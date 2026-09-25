# Tenant Isolation and RLS Audit

Last updated: 2026-09-09

## Current Application Posture

RYBS Platform is a single multi-tenant application. Runtime tenant isolation is
primarily enforced in server-side application code with explicit `business_id`
or `tenant_id` filters, using server-only Supabase clients.

The latest safe application-level fix from this audit scopes the admin booking
detail page's future dependency-date lookup by `business_id`.

## Database/RLS Follow-Ups Requiring Migration Review

These items should be handled with reviewed Supabase migrations and hosted
verification. Do not apply them opportunistically during local application work.

- Many core business-owned tables still rely on application-level filtering and
  service-role-only server code instead of table-level RLS policies. Examples
  include bookings, booking holds, booking payments, pricing settings, service
  area ZIPs, dumpsters, dumpster service dates, fleet equipment, tenant settings,
  tenant content, tenant domains, and business admin memberships.
- Several newer sensitive tables intentionally enable RLS and revoke direct
  browser-role access, but have no end-user policies because they are currently
  server-owned. This is appropriate for tables such as platform admin
  memberships and tenant payment provider connections, but should be verified in
  hosted Supabase before relying on it as the only isolation layer.
- The legacy `current_business_id()` helper reads business identifiers from JWT
  claims. Any future RLS expansion should avoid user-editable metadata and
  should prefer membership-table authorization checks or trusted app metadata
  that is refreshed deliberately.
- Public Data API exposure needs a deliberate access model. Before granting
  `anon` or `authenticated` table access, enable RLS and add tenant-aware
  policies with both `USING` and `WITH CHECK` where writes are allowed.
- No hosted RLS migration, grant change, or destructive schema cleanup was
  applied as part of this audit.

## Recommended Migration Direction

1. Inventory hosted grants and RLS state directly from `pg_tables`,
   `pg_policies`, and `information_schema.role_table_grants`.
2. Classify every public table as one of:
   `server_owned`, `public_read`, `authenticated_member_access`, or
   `platform_admin_only`.
3. For `server_owned` tables, explicitly revoke direct browser-role access and
   grant only the server role required by the application.
4. For member-access tables, add policies that authorize through active
   memberships, not through client-provided tenant or business identifiers.
5. Apply changes in small migrations with hosted verification after each batch.
