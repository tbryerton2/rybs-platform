create or replace function public.sync_service_area_zip_coordinates()
returns integer
language plpgsql
security invoker
set search_path = public
as $$
declare
  updated_count integer := 0;
  source_table regclass := to_regclass('public.zip_reference');
  destination_table regclass := to_regclass('public.service_area_zips');
begin
  if source_table is null or destination_table is null then
    return 0;
  end if;

  execute format($update$
    update %s as saz
    set
      latitude = zr.latitude,
      longitude = zr.longitude
    from %s as zr
    where saz.zip = zr.zip
      and (
        saz.latitude is distinct from zr.latitude
        or saz.longitude is distinct from zr.longitude
      )
  $update$, destination_table, source_table);

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.sync_service_area_zip_coordinates()
  from public, anon, authenticated;
grant execute on function public.sync_service_area_zip_coordinates()
  to service_role;

comment on function public.sync_service_area_zip_coordinates() is
  'Copies coordinates from the optional zip_reference table when both source and destination tables exist.';
