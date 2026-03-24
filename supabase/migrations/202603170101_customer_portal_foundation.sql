create extension if not exists pgcrypto;

create or replace function public.normalize_email(input text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(input)), '')
$$;

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(input, ''), '[^0-9]', '', 'g'), '')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  customers_kind "char";
begin
  select c.relkind
    into customers_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'customers';

  if customers_kind is not null then
    if not exists (
      select 1
      from pg_class c
      join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public'
        and c.relname = 'customers_legacy_derived'
    ) then
      if customers_kind = 'v' then
        execute 'alter view public.customers rename to customers_legacy_derived';
      elsif customers_kind = 'm' then
        execute 'alter materialized view public.customers rename to customers_legacy_derived';
      elsif customers_kind in ('r', 'p') then
        execute 'alter table public.customers rename to customers_legacy_derived';
      elsif customers_kind = 'f' then
        execute 'alter foreign table public.customers rename to customers_legacy_derived';
      end if;
    end if;
  end if;
end
$$;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid unique references auth.users (id) on delete set null,
  name text,
  email text,
  normalized_email text generated always as (public.normalize_email(email)) stored,
  phone text,
  primary_street text,
  primary_city text,
  primary_zip text,
  notes text,
  portal_status text not null default 'invited'
    check (portal_status in ('invited', 'active', 'disabled')),
  last_login_at timestamptz,
  constraint customers_contact_required
    check (normalized_email is not null or phone is not null)
);

create unique index if not exists customers_normalized_email_key
  on public.customers (normalized_email)
  where normalized_email is not null;

create index if not exists customers_portal_status_idx
  on public.customers (portal_status);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table if not exists public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null,
  street text not null,
  city text not null,
  zip text not null,
  delivery_notes text,
  is_default boolean not null default false
);

create index if not exists customer_locations_customer_id_idx
  on public.customer_locations (customer_id);

create unique index if not exists customer_locations_default_per_customer_idx
  on public.customer_locations (customer_id)
  where is_default;

drop trigger if exists customer_locations_set_updated_at on public.customer_locations;
create trigger customer_locations_set_updated_at
before update on public.customer_locations
for each row execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'bookings'
  ) then
    alter table public.bookings
      add column if not exists customer_id uuid references public.customers (id) on delete set null;

    create index if not exists bookings_customer_id_idx
      on public.bookings (customer_id);
  end if;
end
$$;

alter table public.customers enable row level security;
alter table public.customer_locations enable row level security;
do $$
begin
  if to_regclass('public.bookings') is not null then
    create table if not exists public.booking_requests (
      id uuid primary key default gen_random_uuid(),
      booking_id uuid not null references public.bookings (id) on delete cascade,
      customer_id uuid references public.customers (id) on delete set null,
      request_type text not null
        check (request_type in ('pickup', 'extension', 'issue')),
      status text not null default 'submitted'
        check (status in ('submitted', 'reviewed', 'approved', 'rejected', 'completed')),
      message text,
      requested_pickup_date date,
      requested_extension_days integer
        check (requested_extension_days is null or requested_extension_days > 0),
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );

    create index if not exists booking_requests_booking_id_idx
      on public.booking_requests (booking_id);

    create index if not exists booking_requests_customer_id_idx
      on public.booking_requests (customer_id);

    create index if not exists booking_requests_status_idx
      on public.booking_requests (status);

    drop trigger if exists booking_requests_set_updated_at on public.booking_requests;
    create trigger booking_requests_set_updated_at
    before update on public.booking_requests
    for each row execute function public.set_updated_at();

    alter table public.booking_requests enable row level security;

    execute $view$
      create or replace view public.customer_rollups as
      with base as (
        select
          b.id,
          b.created_at,
          b.delivery_date,
          b.status,
          b.total_price_cents,
          b.customer_name,
          b.customer_email,
          b.customer_phone,
          b.customer_city,
          b.customer_zip,
          case
            when public.normalize_email(b.customer_email) is not null then public.normalize_email(b.customer_email)
            else public.normalize_phone(b.customer_phone)
          end as identifier,
          case
            when public.normalize_email(b.customer_email) is not null then 'email'
            else 'phone'
          end as identifier_type
        from public.bookings b
        where public.normalize_email(b.customer_email) is not null
           or public.normalize_phone(b.customer_phone) is not null
      ),
      ranked as (
        select
          base.*,
          row_number() over (
            partition by base.identifier, base.identifier_type
            order by base.delivery_date desc nulls last, base.created_at desc nulls last
          ) as rn
        from base
      )
      select
        (array_agg(
          ranked.id
          order by ranked.delivery_date desc nulls last, ranked.created_at desc nulls last, ranked.id desc
        ))[1] as id,
        ranked.identifier,
        ranked.identifier_type::text as identifier_type,
        max(ranked.customer_name) filter (where ranked.customer_name is not null and ranked.customer_name <> '') as name,
        max(ranked.customer_email) filter (where ranked.customer_email is not null and ranked.customer_email <> '') as email,
        max(ranked.customer_phone) filter (where ranked.customer_phone is not null and ranked.customer_phone <> '') as phone,
        max(ranked.customer_city) filter (where ranked.rn = 1) as primary_city,
        max(ranked.customer_zip) filter (where ranked.rn = 1) as primary_zip,
        count(*)::integer as booking_count,
        count(*) filter (where ranked.status in ('confirmed', 'scheduled', 'delivered'))::integer as active_booking_count,
        min(ranked.created_at) as first_booking_at,
        max(ranked.created_at) as last_booking_at,
        (
          sum(
            case
              when ranked.total_price_cents is null then 0
              else ranked.total_price_cents
            end
          )::numeric / 100
        )::numeric(12, 2) as lifetime_revenue
      from ranked
      group by ranked.identifier, ranked.identifier_type
    $view$;
  end if;
end
$$;
