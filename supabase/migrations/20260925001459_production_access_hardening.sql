begin;

do $$
declare
  relation_name text;
  relation_kind "char";
begin
  foreach relation_name in array array[
    'entity_history',
    'customers_legacy_derived',
    'pricing_defaults',
    'tenants',
    'tenant_content_entries',
    'booking_messages',
    'booking_holds',
    'dumpsters',
    'dumpster_product_settings',
    'bookings',
    'pricing_settings',
    'booking_events'
  ] loop
    relation_kind := null;

    select c.relkind
      into relation_kind
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname = relation_name;

    if relation_kind in ('r', 'p') then
      execute format(
        'alter table public.%I enable row level security',
        relation_name
      );
    end if;

    if relation_kind is not null then
      execute format(
        'revoke all privileges on table public.%I from anon, authenticated',
        relation_name
      );
    end if;
  end loop;
end
$$;

do $$
begin
  if to_regclass('public.customer_rollups') is not null then
    execute 'alter view public.customer_rollups set (security_invoker = true)';
    execute 'revoke all privileges on table public.customer_rollups from anon, authenticated';
  end if;
end
$$;

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
