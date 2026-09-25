begin;

alter table public.entity_history enable row level security;
alter table public.customers_legacy_derived enable row level security;
alter table public.pricing_defaults enable row level security;
alter table public.tenants enable row level security;
alter table public.tenant_content_entries enable row level security;
alter table public.booking_messages enable row level security;
alter table public.booking_holds enable row level security;
alter table public.dumpsters enable row level security;
alter table public.dumpster_product_settings enable row level security;
alter table public.bookings enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.booking_events enable row level security;

revoke all privileges on table public.entity_history from anon, authenticated;
revoke all privileges on table public.customers_legacy_derived from anon, authenticated;
revoke all privileges on table public.pricing_defaults from anon, authenticated;
revoke all privileges on table public.tenants from anon, authenticated;
revoke all privileges on table public.tenant_content_entries from anon, authenticated;
revoke all privileges on table public.booking_messages from anon, authenticated;
revoke all privileges on table public.booking_holds from anon, authenticated;
revoke all privileges on table public.dumpsters from anon, authenticated;
revoke all privileges on table public.dumpster_product_settings from anon, authenticated;
revoke all privileges on table public.bookings from anon, authenticated;
revoke all privileges on table public.pricing_settings from anon, authenticated;
revoke all privileges on table public.booking_events from anon, authenticated;

alter view public.customer_rollups set (security_invoker = true);
revoke all privileges on table public.customer_rollups from anon, authenticated;

revoke all on function public.expire_active_holds_for_client(text)
  from public, anon, authenticated;
grant execute on function public.expire_active_holds_for_client(text) to service_role;

revoke all on function public.get_delivery_availability(date, integer)
  from public, anon, authenticated;
grant execute on function public.get_delivery_availability(date, integer) to service_role;

revoke all on function public.next_tight_date(date)
  from public, anon, authenticated;
grant execute on function public.next_tight_date(date) to service_role;

revoke all on function public.get_admin_reports_business_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.get_admin_reports_business_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) to service_role;

revoke all on function public.get_admin_reports_website_funnel_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) from public, anon, authenticated;
grant execute on function public.get_admin_reports_website_funnel_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) to service_role;

revoke all on function public.record_external_booking_charge_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  integer,
  date,
  text,
  text,
  text,
  timestamptz
) from public, anon, authenticated;
grant execute on function public.record_external_booking_charge_payment(
  uuid,
  uuid,
  uuid,
  uuid,
  text,
  integer,
  date,
  text,
  text,
  text,
  timestamptz
) to service_role;

commit;
