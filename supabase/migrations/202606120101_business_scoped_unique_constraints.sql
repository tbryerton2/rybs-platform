-- Phase 1 security wrap-up: business-scoped uniqueness.
--
-- This is an intermediate migration. It adds business-scoped unique
-- constraints before runtime onConflict targets are updated and before the old
-- global unique constraints are dropped. business_id remains nullable for now,
-- and RLS is intentionally unchanged.

do $$
begin
  if exists (
    select 1
    from public.service_area_zips
    where business_id is not null
    group by business_id, zip
    having count(*) > 1
  ) then
    raise exception 'Cannot add service_area_zips_business_id_zip_key: duplicate business_id + zip rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_area_zips_business_id_zip_key'
      and conrelid = 'public.service_area_zips'::regclass
  ) then
    alter table public.service_area_zips
      add constraint service_area_zips_business_id_zip_key
      unique (business_id, zip);
  end if;

  if exists (
    select 1
    from public.dumpster_product_settings
    where business_id is not null
    group by business_id, dumpster_size
    having count(*) > 1
  ) then
    raise exception 'Cannot add dumpster_product_settings_business_id_dumpster_size_key: duplicate business_id + dumpster_size rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpster_product_settings_business_id_dumpster_size_key'
      and conrelid = 'public.dumpster_product_settings'::regclass
  ) then
    alter table public.dumpster_product_settings
      add constraint dumpster_product_settings_business_id_dumpster_size_key
      unique (business_id, dumpster_size);
  end if;

  if exists (
    select 1
    from public.dumpster_product_settings
    where business_id is not null
    group by business_id, dumpster_product_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add dumpster_product_settings_business_id_dumpster_product_id_key: duplicate business_id + dumpster_product_id rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpster_product_settings_business_id_dumpster_product_id_key'
      and conrelid = 'public.dumpster_product_settings'::regclass
  ) then
    alter table public.dumpster_product_settings
      add constraint dumpster_product_settings_business_id_dumpster_product_id_key
      unique (business_id, dumpster_product_id);
  end if;

  if exists (
    select 1
    from public.dumpsters
    where business_id is not null
    group by business_id, equipment_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add dumpsters_business_id_equipment_id_key: duplicate business_id + equipment_id rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'dumpsters_business_id_equipment_id_key'
      and conrelid = 'public.dumpsters'::regclass
  ) then
    alter table public.dumpsters
      add constraint dumpsters_business_id_equipment_id_key
      unique (business_id, equipment_id);
  end if;

  if exists (
    select 1
    from public.pricing_settings
    where business_id is not null
    group by business_id
    having count(*) > 1
  ) then
    raise exception 'Cannot add pricing_settings_business_id_key: duplicate business_id rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_business_id_key'
      and conrelid = 'public.pricing_settings'::regclass
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_business_id_key
      unique (business_id);
  end if;

  if exists (
    select 1
    from public.service_area_zip_pricing_overrides
    where business_id is not null
    group by business_id, service_area_zip_id, dumpster_size
    having count(*) > 1
  ) then
    raise exception 'Cannot add service_area_zip_pricing_overrides_business_id_zip_size_key: duplicate business_id + service_area_zip_id + dumpster_size rows exist.';
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'service_area_zip_pricing_overrides_business_id_zip_size_key'
      and conrelid = 'public.service_area_zip_pricing_overrides'::regclass
  ) then
    alter table public.service_area_zip_pricing_overrides
      add constraint service_area_zip_pricing_overrides_business_id_zip_size_key
      unique (business_id, service_area_zip_id, dumpster_size);
  end if;
end
$$;

comment on constraint service_area_zips_business_id_zip_key on public.service_area_zips is
  'Intermediate Phase 1 business-scoped uniqueness. Keep old global ZIP uniqueness until runtime onConflict targets are updated.';

comment on constraint dumpster_product_settings_business_id_dumpster_size_key on public.dumpster_product_settings is
  'Intermediate Phase 1 business-scoped uniqueness. Keep old global dumpster_size uniqueness until runtime onConflict targets are updated.';

comment on constraint dumpster_product_settings_business_id_dumpster_product_id_key on public.dumpster_product_settings is
  'Intermediate Phase 1 business-scoped uniqueness. Keep old global dumpster_product_id uniqueness until runtime onConflict targets are updated.';

comment on constraint dumpsters_business_id_equipment_id_key on public.dumpsters is
  'Intermediate Phase 1 business-scoped uniqueness. Keep old global equipment_id uniqueness until runtime code is updated and verified.';

comment on constraint pricing_settings_business_id_key on public.pricing_settings is
  'Intermediate Phase 1 business-scoped uniqueness. Enforces one pricing settings row per business before final hardening.';

comment on constraint service_area_zip_pricing_overrides_business_id_zip_size_key on public.service_area_zip_pricing_overrides is
  'Intermediate Phase 1 business-scoped uniqueness. Keep old global service_area_zip_id + dumpster_size uniqueness until runtime onConflict targets are updated.';
