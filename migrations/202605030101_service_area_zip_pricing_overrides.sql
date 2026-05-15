do $$
begin
  if not exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'service_area_zip_pricing_overrides'
  ) then
    create table public.service_area_zip_pricing_overrides (
      id uuid primary key default gen_random_uuid(),
      service_area_zip_id bigint not null references public.service_area_zips (id) on delete cascade,
      dumpster_size integer not null,
      price_override integer not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      constraint service_area_zip_pricing_overrides_zip_size_key
        unique (service_area_zip_id, dumpster_size)
    );
  end if;
end
$$;

alter table public.service_area_zip_pricing_overrides
  add column if not exists created_at timestamptz not null default now();

alter table public.service_area_zip_pricing_overrides
  add column if not exists updated_at timestamptz not null default now();

create index if not exists service_area_zip_pricing_overrides_zip_id_idx
  on public.service_area_zip_pricing_overrides (service_area_zip_id);

create index if not exists service_area_zip_pricing_overrides_size_idx
  on public.service_area_zip_pricing_overrides (dumpster_size);

create unique index if not exists service_area_zip_pricing_overrides_zip_size_key
  on public.service_area_zip_pricing_overrides (service_area_zip_id, dumpster_size);

do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'set_updated_at'
      and pg_function_is_visible(oid)
  ) then
    drop trigger if exists service_area_zip_pricing_overrides_set_updated_at on public.service_area_zip_pricing_overrides;
    create trigger service_area_zip_pricing_overrides_set_updated_at
    before update on public.service_area_zip_pricing_overrides
    for each row execute function public.set_updated_at();
  end if;
end
$$;

insert into public.service_area_zip_pricing_overrides (service_area_zip_id, dumpster_size, price_override)
select id, 14, price_14_yard_override
from public.service_area_zips
where price_14_yard_override is not null
on conflict (service_area_zip_id, dumpster_size) do update
  set price_override = excluded.price_override,
      updated_at = now();
