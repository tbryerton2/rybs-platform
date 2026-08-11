do $$
begin
  if exists (
    select 1
    from public.dumpsters
    where equipment_id = 'DST-104'
      and id <> '00000000-0000-4000-8000-000000000104'
  ) then
    raise exception 'Cannot repair dumpster 104 equipment ID because DST-104 is already assigned to another dumpster.';
  end if;

  update public.dumpsters
  set
    equipment_id = 'DST-104',
    updated_at = now()
  where id = '00000000-0000-4000-8000-000000000104'
    and upper(trim(equipment_id)) = 'ROLL-OFF 104';
end
$$;
