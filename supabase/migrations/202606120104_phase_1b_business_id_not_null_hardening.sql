-- Final Phase 1B business_id hardening.
--
-- Batch 1, Batch 2, and Batch 3 runtime scoping/backfills have been completed
-- and validated in hosted Supabase. This migration verifies that no scoped table
-- still has null business_id values, verifies key parent/child business_id
-- relationships, and then makes business_id NOT NULL.
--
-- This intentionally does not add RLS, does not alter auth behavior, and does
-- not touch customer uniqueness constraints.

do $$
declare
  table_name text;
  null_count bigint;
begin
  foreach table_name in array array[
    'bookings',
    'booking_holds',
    'customers',
    'customer_locations',
    'rental_action_requests',
    'pricing_settings',
    'dumpster_product_settings',
    'service_area_zips',
    'service_area_zip_pricing_overrides',
    'dumpsters',
    'dumpster_service_dates',
    'fleet_equipment',
    'fleet_equipment_service_dates',
    'entity_history',
    'booking_events',
    'booking_messages'
  ]
  loop
    execute format('select count(*) from public.%I where business_id is null', table_name)
      into null_count;

    if null_count > 0 then
      raise exception
        'Cannot harden public.% business_id to NOT NULL: % rows still have null business_id.',
        table_name,
        null_count;
    end if;
  end loop;
end $$;

do $$
declare
  mismatch_count bigint;
begin
  select count(*)
  into mismatch_count
  from public.customer_locations locations
  join public.customers customers on customers.id = locations.customer_id
  where locations.business_id is distinct from customers.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % customer_locations rows do not match their customer business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.bookings bookings
  join public.customers customers on customers.id = bookings.customer_id
  where bookings.customer_id is not null
    and bookings.business_id is distinct from customers.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % bookings rows do not match their customer business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.service_area_zip_pricing_overrides overrides
  join public.service_area_zips zips on zips.id = overrides.service_area_zip_id
  where overrides.business_id is distinct from zips.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % service_area_zip_pricing_overrides rows do not match their service_area_zips business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.dumpster_service_dates service_dates
  join public.dumpsters dumpsters on dumpsters.id = service_dates.dumpster_id
  where service_dates.business_id is distinct from dumpsters.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % dumpster_service_dates rows do not match their dumpster business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.fleet_equipment_service_dates service_dates
  join public.fleet_equipment fleet on fleet.id = service_dates.fleet_equipment_id
  where service_dates.business_id is distinct from fleet.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % fleet_equipment_service_dates rows do not match their fleet_equipment business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.booking_events events
  join public.bookings bookings on bookings.id = events.booking_id
  where events.booking_id is not null
    and events.business_id is distinct from bookings.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % booking_events rows do not match their booking business_id.',
      mismatch_count;
  end if;

  select count(*)
  into mismatch_count
  from public.booking_messages messages
  join public.bookings bookings on bookings.id = messages.booking_id
  where messages.business_id is distinct from bookings.business_id;

  if mismatch_count > 0 then
    raise exception
      'Cannot harden business_id: % booking_messages rows do not match their booking business_id.',
      mismatch_count;
  end if;
end $$;

alter table public.bookings
  alter column business_id set not null;

alter table public.booking_holds
  alter column business_id set not null;

alter table public.customers
  alter column business_id set not null;

alter table public.customer_locations
  alter column business_id set not null;

alter table public.rental_action_requests
  alter column business_id set not null;

alter table public.pricing_settings
  alter column business_id set not null;

alter table public.dumpster_product_settings
  alter column business_id set not null;

alter table public.service_area_zips
  alter column business_id set not null;

alter table public.service_area_zip_pricing_overrides
  alter column business_id set not null;

alter table public.dumpsters
  alter column business_id set not null;

alter table public.dumpster_service_dates
  alter column business_id set not null;

alter table public.fleet_equipment
  alter column business_id set not null;

alter table public.fleet_equipment_service_dates
  alter column business_id set not null;

alter table public.entity_history
  alter column business_id set not null;

alter table public.booking_events
  alter column business_id set not null;

alter table public.booking_messages
  alter column business_id set not null;
