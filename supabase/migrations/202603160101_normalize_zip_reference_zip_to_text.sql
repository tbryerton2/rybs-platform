begin;

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'zip_reference'
  ) then
    alter table public.zip_reference
      alter column zip type text
      using zip::text;

    alter table public.zip_reference
      alter column zip set not null;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      join pg_attribute a on a.attrelid = t.oid and a.attnum = any (c.conkey)
      where n.nspname = 'public'
        and t.relname = 'zip_reference'
        and c.contype = 'p'
        and a.attname = 'zip'
    ) then
      alter table public.zip_reference
        add constraint zip_reference_pkey primary key (zip);
    end if;
  end if;
end
$$;

create or replace function public.sync_service_area_zip_coordinates()
returns integer
language plpgsql
as $$
declare
  updated_count integer;
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'zip_reference'
  ) and exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'service_area_zips'
  ) then
    update public.service_area_zips as saz
    set
      latitude = zr.latitude,
      longitude = zr.longitude
    from public.zip_reference as zr
    where saz.zip = zr.zip
      and (
        saz.latitude is distinct from zr.latitude
        or saz.longitude is distinct from zr.longitude
      );

    get diagnostics updated_count = row_count;
    return updated_count;
  end if;

  return 0;
end;
$$;

commit;
