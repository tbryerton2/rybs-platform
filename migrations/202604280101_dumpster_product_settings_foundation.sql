create extension if not exists pgcrypto;

create table if not exists public.dumpster_product_settings (
  id uuid primary key default gen_random_uuid(),
  dumpster_size text not null,
  dumpster_product_id text not null,
  display_name text not null,
  short_description text,
  dimensions text,
  included_weight_tons numeric,
  included_rental_days integer,
  extra_day_price numeric,
  base_price numeric,
  is_public boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint dumpster_product_settings_dumpster_size_key unique (dumpster_size),
  constraint dumpster_product_settings_dumpster_product_id_key unique (dumpster_product_id),
  constraint dumpster_product_settings_included_rental_days_check
    check (included_rental_days is null or included_rental_days >= 1),
  constraint dumpster_product_settings_included_weight_tons_check
    check (included_weight_tons is null or included_weight_tons >= 0),
  constraint dumpster_product_settings_extra_day_price_check
    check (extra_day_price is null or extra_day_price >= 0),
  constraint dumpster_product_settings_base_price_check
    check (base_price is null or base_price >= 0)
);

create index if not exists dumpster_product_settings_public_sort_idx
  on public.dumpster_product_settings (is_public, sort_order, display_name);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    drop trigger if exists dumpster_product_settings_set_updated_at on public.dumpster_product_settings;
    create trigger dumpster_product_settings_set_updated_at
    before update on public.dumpster_product_settings
    for each row execute function public.set_updated_at();
  end if;
end
$$;

with current_pricing as (
  select
    coalesce(ps.standard_rental_price, 475)::numeric as base_price,
    coalesce(ps.included_rental_days, 7)::integer as included_rental_days,
    coalesce(ps.daily_overage_price, 30)::numeric as extra_day_price,
    coalesce(ps.included_tons, 1)::numeric as included_weight_tons
  from public.pricing_settings ps
  order by ps.created_at asc
  limit 1
), defaults as (
  select
    coalesce((select base_price from current_pricing), 475::numeric) as base_price,
    coalesce((select included_rental_days from current_pricing), 7) as included_rental_days,
    coalesce((select extra_day_price from current_pricing), 30::numeric) as extra_day_price,
    coalesce((select included_weight_tons from current_pricing), 1::numeric) as included_weight_tons
), seeded as (
  select
    '14 yard'::text as dumpster_size,
    'default'::text as dumpster_product_id,
    '14-yard dumpster'::text as display_name,
    'Includes delivery, pickup, and the standard weight allowance.'::text as short_description,
    '7'' × 14'' × 4'''::text as dimensions,
    defaults.included_weight_tons,
    defaults.included_rental_days,
    defaults.extra_day_price,
    defaults.base_price,
    true as is_public,
    10 as sort_order
  from defaults

  union all

  select
    '20 yard'::text as dumpster_size,
    '20-yard'::text as dumpster_product_id,
    '20-yard dumpster'::text as display_name,
    'Temporary placeholder pricing and product details for this 20-yard dumpster offering. Confirm customer-facing copy before broad promotion.'::text as short_description,
    'Dimensions TBD'::text as dimensions,
    defaults.included_weight_tons,
    defaults.included_rental_days,
    defaults.extra_day_price,
    defaults.base_price,
    true as is_public,
    20 as sort_order
  from defaults
)
insert into public.dumpster_product_settings (
  dumpster_size,
  dumpster_product_id,
  display_name,
  short_description,
  dimensions,
  included_weight_tons,
  included_rental_days,
  extra_day_price,
  base_price,
  is_public,
  sort_order
)
select
  seeded.dumpster_size,
  seeded.dumpster_product_id,
  seeded.display_name,
  seeded.short_description,
  seeded.dimensions,
  seeded.included_weight_tons,
  seeded.included_rental_days,
  seeded.extra_day_price,
  seeded.base_price,
  seeded.is_public,
  seeded.sort_order
from seeded
on conflict (dumpster_size) do update
set dumpster_product_id = excluded.dumpster_product_id,
    display_name = excluded.display_name,
    short_description = excluded.short_description,
    dimensions = excluded.dimensions,
    included_weight_tons = excluded.included_weight_tons,
    included_rental_days = excluded.included_rental_days,
    extra_day_price = excluded.extra_day_price,
    base_price = excluded.base_price,
    is_public = excluded.is_public,
    sort_order = excluded.sort_order,
    updated_at = now();
