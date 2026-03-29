create extension if not exists pgcrypto;

do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'pricing_settings'
  ) then
    create table public.pricing_settings (
      id uuid primary key default gen_random_uuid(),
      standard_rental_price numeric(10,2) not null default 475,
      scheduled_pickup_price numeric(10,2) not null default 450,
      included_rental_days integer not null default 7,
      included_tons numeric(10,2) not null default 1,
      daily_overage_price numeric(10,2) not null default 30,
      ton_overage_price numeric(10,2) not null default 100,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    );
  end if;
end
$$;

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    drop trigger if exists pricing_settings_set_updated_at on public.pricing_settings;
    create trigger pricing_settings_set_updated_at
    before update on public.pricing_settings
    for each row execute function public.set_updated_at();
  end if;
end
$$;

insert into public.pricing_settings (
  standard_rental_price,
  scheduled_pickup_price,
  included_rental_days,
  included_tons,
  daily_overage_price,
  ton_overage_price
)
select 475, 450, 7, 1, 30, 100
where not exists (
  select 1
  from public.pricing_settings
);
