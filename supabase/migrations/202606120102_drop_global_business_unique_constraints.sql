-- Phase 1 security wrap-up: remove old global uniqueness.
--
-- The business-scoped unique constraints must exist before this migration runs.
-- Dropping the old global constraints enables future businesses to use the same
-- ZIPs, dumpster product sizes/IDs, ZIP override sizes, and equipment IDs as
-- Tan Can Man while preserving uniqueness within each business.

do $$
declare
  missing_constraints text[];
begin
  select array_agg(required.constraint_name order by required.constraint_name)
  into missing_constraints
  from (
    values
      ('public.service_area_zips'::regclass, 'service_area_zips_business_id_zip_key'),
      ('public.dumpster_product_settings'::regclass, 'dumpster_product_settings_business_id_dumpster_size_key'),
      ('public.dumpster_product_settings'::regclass, 'dumpster_product_settings_business_id_dumpster_product_id_key'),
      ('public.dumpsters'::regclass, 'dumpsters_business_id_equipment_id_key'),
      ('public.pricing_settings'::regclass, 'pricing_settings_business_id_key'),
      ('public.service_area_zip_pricing_overrides'::regclass, 'service_area_zip_pricing_overrides_business_id_zip_size_key')
  ) as required(table_oid, constraint_name)
  where not exists (
    select 1
    from pg_constraint constraints
    where constraints.conrelid = required.table_oid
      and constraints.conname = required.constraint_name
  );

  if missing_constraints is not null then
    raise exception
      'Cannot drop old global unique constraints because required business-scoped constraints are missing: %',
      array_to_string(missing_constraints, ', ');
  end if;

  alter table public.service_area_zips
    drop constraint if exists service_area_zips_zip_key;

  alter table public.dumpster_product_settings
    drop constraint if exists dumpster_product_settings_dumpster_size_key;

  alter table public.dumpster_product_settings
    drop constraint if exists dumpster_product_settings_dumpster_product_id_key;

  alter table public.dumpsters
    drop constraint if exists dumpsters_equipment_id_key;

  alter table public.service_area_zip_pricing_overrides
    drop constraint if exists service_area_zip_pricing_overrides_zip_size_key;
end
$$;
