-- Admin Security Phase 1B Batch 1: core customer/rental business scoping.
--
-- This migration adds nullable business_id columns to the highest-priority
-- operational tables and backfills current Tan Can Man data. The columns remain
-- nullable until all public, portal, and admin write paths are updated to set
-- business_id explicitly.
--
-- These are operational business records, so business_id references tenants(id)
-- with restrict/no-action semantics rather than cascading tenant deletion into
-- customer, booking, hold, location, or request history.

alter table public.customers
  add column if not exists business_id uuid;

alter table public.bookings
  add column if not exists business_id uuid;

alter table public.booking_holds
  add column if not exists business_id uuid;

alter table public.customer_locations
  add column if not exists business_id uuid;

alter table public.rental_action_requests
  add column if not exists business_id uuid;

comment on column public.customers.business_id is
  'Phase 1B Batch 1 business scope. Nullable until all customer write paths set business_id.';

comment on column public.bookings.business_id is
  'Phase 1B Batch 1 business scope. Nullable until all booking write paths set business_id.';

comment on column public.booking_holds.business_id is
  'Phase 1B Batch 1 business scope. Nullable until all booking hold write paths set business_id.';

comment on column public.customer_locations.business_id is
  'Phase 1B Batch 1 business scope. Nullable until all customer location write paths set business_id.';

comment on column public.rental_action_requests.business_id is
  'Phase 1B Batch 1 business scope. Nullable until all rental action request write paths set business_id.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_business_id_fkey'
  ) then
    alter table public.customers
      add constraint customers_business_id_fkey
      foreign key (business_id) references public.tenants (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_business_id_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_business_id_fkey
      foreign key (business_id) references public.tenants (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_holds'::regclass
      and conname = 'booking_holds_business_id_fkey'
  ) then
    alter table public.booking_holds
      add constraint booking_holds_business_id_fkey
      foreign key (business_id) references public.tenants (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_locations'::regclass
      and conname = 'customer_locations_business_id_fkey'
  ) then
    alter table public.customer_locations
      add constraint customer_locations_business_id_fkey
      foreign key (business_id) references public.tenants (id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_business_id_fkey'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_business_id_fkey
      foreign key (business_id) references public.tenants (id) on delete restrict;
  end if;
end
$$;

do $$
declare
  tan_can_man_business_id uuid;
begin
  select tenants.id
    into tan_can_man_business_id
  from public.tenants
  where tenants.slug = 'tan-can-man'
  limit 1;

  if tan_can_man_business_id is null then
    raise exception 'Cannot backfill Phase 1B Batch 1 business_id columns: tenant slug tan-can-man was not found.';
  end if;

  update public.customers
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.bookings
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.booking_holds
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.customer_locations
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.rental_action_requests
  set business_id = tan_can_man_business_id
  where business_id is null;
end
$$;

create index if not exists customers_business_id_idx
  on public.customers (business_id);

create index if not exists bookings_business_id_idx
  on public.bookings (business_id);

create index if not exists booking_holds_business_id_idx
  on public.booking_holds (business_id);

create index if not exists customer_locations_business_id_idx
  on public.customer_locations (business_id);

create index if not exists rental_action_requests_business_id_idx
  on public.rental_action_requests (business_id);

create index if not exists bookings_business_id_delivery_date_idx
  on public.bookings (business_id, delivery_date);

create index if not exists booking_holds_business_id_status_idx
  on public.booking_holds (business_id, status);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
  ) then
    create index if not exists customers_business_id_normalized_email_idx
      on public.customers (business_id, normalized_email);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_phone'
  ) then
    create index if not exists customers_business_id_normalized_phone_idx
      on public.customers (business_id, normalized_phone);
  end if;
end
$$;
