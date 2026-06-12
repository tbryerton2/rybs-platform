-- Phase 1B Batch 2 business data scoping.
--
-- Adds nullable business_id columns for pricing, service area, product,
-- inventory, fleet, service-date, and availability-adjacent tables.
-- business_id intentionally remains nullable until all write/read paths are
-- updated and verified. Unique constraints and RLS are intentionally unchanged
-- in this migration.

alter table public.pricing_settings
  add column if not exists business_id uuid;

alter table public.dumpster_product_settings
  add column if not exists business_id uuid;

alter table public.service_area_zips
  add column if not exists business_id uuid;

alter table public.service_area_zip_pricing_overrides
  add column if not exists business_id uuid;

alter table public.dumpsters
  add column if not exists business_id uuid;

alter table public.dumpster_service_dates
  add column if not exists business_id uuid;

alter table public.fleet_equipment
  add column if not exists business_id uuid;

alter table public.fleet_equipment_service_dates
  add column if not exists business_id uuid;

comment on column public.pricing_settings.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until pricing read/write paths are business-scoped.';
comment on column public.dumpster_product_settings.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until dumpster product read/write paths are business-scoped.';
comment on column public.service_area_zips.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until service area read/write paths are business-scoped.';
comment on column public.service_area_zip_pricing_overrides.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until ZIP pricing override read/write paths are business-scoped.';
comment on column public.dumpsters.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until dumpster inventory read/write paths are business-scoped.';
comment on column public.dumpster_service_dates.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until dumpster service-date read/write paths are business-scoped.';
comment on column public.fleet_equipment.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until fleet equipment read/write paths are business-scoped.';
comment on column public.fleet_equipment_service_dates.business_id is
  'Phase 1B Batch 2 business scoping. Nullable until fleet service-date read/write paths are business-scoped.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_business_id_fkey'
      and conrelid = 'public.pricing_settings'::regclass
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpster_product_settings_business_id_fkey'
      and conrelid = 'public.dumpster_product_settings'::regclass
  ) then
    alter table public.dumpster_product_settings
      add constraint dumpster_product_settings_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_area_zips_business_id_fkey'
      and conrelid = 'public.service_area_zips'::regclass
  ) then
    alter table public.service_area_zips
      add constraint service_area_zips_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_area_zip_pricing_overrides_business_id_fkey'
      and conrelid = 'public.service_area_zip_pricing_overrides'::regclass
  ) then
    alter table public.service_area_zip_pricing_overrides
      add constraint service_area_zip_pricing_overrides_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpsters_business_id_fkey'
      and conrelid = 'public.dumpsters'::regclass
  ) then
    alter table public.dumpsters
      add constraint dumpsters_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpster_service_dates_business_id_fkey'
      and conrelid = 'public.dumpster_service_dates'::regclass
  ) then
    alter table public.dumpster_service_dates
      add constraint dumpster_service_dates_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fleet_equipment_business_id_fkey'
      and conrelid = 'public.fleet_equipment'::regclass
  ) then
    alter table public.fleet_equipment
      add constraint fleet_equipment_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'fleet_equipment_service_dates_business_id_fkey'
      and conrelid = 'public.fleet_equipment_service_dates'::regclass
  ) then
    alter table public.fleet_equipment_service_dates
      add constraint fleet_equipment_service_dates_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;
end
$$;

do $$
declare
  tan_can_man_business_id uuid;
begin
  select id
  into tan_can_man_business_id
  from public.tenants
  where slug = 'tan-can-man';

  if tan_can_man_business_id is null then
    raise exception 'Cannot backfill Phase 1B Batch 2 business_id columns: tenant slug tan-can-man was not found.';
  end if;

  update public.pricing_settings
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.dumpster_product_settings
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.service_area_zips
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.dumpsters
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.fleet_equipment
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.service_area_zip_pricing_overrides overrides
  set business_id = zips.business_id
  from public.service_area_zips zips
  where overrides.service_area_zip_id = zips.id
    and overrides.business_id is null
    and zips.business_id is not null;

  update public.service_area_zip_pricing_overrides
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.dumpster_service_dates service_dates
  set business_id = dumpsters.business_id
  from public.dumpsters dumpsters
  where service_dates.dumpster_id = dumpsters.id
    and service_dates.business_id is null
    and dumpsters.business_id is not null;

  update public.dumpster_service_dates
  set business_id = tan_can_man_business_id
  where business_id is null;

  update public.fleet_equipment_service_dates service_dates
  set business_id = fleet.business_id
  from public.fleet_equipment fleet
  where service_dates.fleet_equipment_id = fleet.id
    and service_dates.business_id is null
    and fleet.business_id is not null;

  update public.fleet_equipment_service_dates
  set business_id = tan_can_man_business_id
  where business_id is null;
end
$$;

create index if not exists pricing_settings_business_id_idx
  on public.pricing_settings (business_id);

create index if not exists dumpster_product_settings_business_id_idx
  on public.dumpster_product_settings (business_id);

create index if not exists service_area_zips_business_id_idx
  on public.service_area_zips (business_id);

create index if not exists service_area_zip_pricing_overrides_business_id_idx
  on public.service_area_zip_pricing_overrides (business_id);

create index if not exists dumpsters_business_id_idx
  on public.dumpsters (business_id);

create index if not exists dumpster_service_dates_business_id_idx
  on public.dumpster_service_dates (business_id);

create index if not exists fleet_equipment_business_id_idx
  on public.fleet_equipment (business_id);

create index if not exists fleet_equipment_service_dates_business_id_idx
  on public.fleet_equipment_service_dates (business_id);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dumpster_product_settings'
      and column_name = 'dumpster_size'
  ) then
    create index if not exists dumpster_product_settings_business_size_idx
      on public.dumpster_product_settings (business_id, dumpster_size);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dumpster_product_settings'
      and column_name = 'dumpster_product_id'
  ) then
    create index if not exists dumpster_product_settings_business_product_id_idx
      on public.dumpster_product_settings (business_id, dumpster_product_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_area_zips'
      and column_name = 'zip'
  ) then
    create index if not exists service_area_zips_business_zip_idx
      on public.service_area_zips (business_id, zip);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_area_zips'
      and column_name = 'active'
  ) then
    create index if not exists service_area_zips_business_active_idx
      on public.service_area_zips (business_id, active);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'service_area_zip_pricing_overrides'
      and column_name = 'service_area_zip_id'
  ) then
    create index if not exists service_area_zip_pricing_overrides_business_zip_id_idx
      on public.service_area_zip_pricing_overrides (business_id, service_area_zip_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dumpsters'
      and column_name = 'equipment_id'
  ) then
    create index if not exists dumpsters_business_equipment_id_idx
      on public.dumpsters (business_id, equipment_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dumpsters'
      and column_name = 'active'
  ) then
    create index if not exists dumpsters_business_active_idx
      on public.dumpsters (business_id, active);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'dumpster_service_dates'
      and column_name = 'dumpster_id'
  ) then
    create index if not exists dumpster_service_dates_business_dumpster_id_idx
      on public.dumpster_service_dates (business_id, dumpster_id);
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fleet_equipment_service_dates'
      and column_name = 'fleet_equipment_id'
  ) then
    create index if not exists fleet_equipment_service_dates_business_equipment_id_idx
      on public.fleet_equipment_service_dates (business_id, fleet_equipment_id);
  end if;
end
$$;
