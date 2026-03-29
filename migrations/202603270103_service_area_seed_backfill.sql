do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'service_area_zips'
  ) then
    with seeded(zip, county, town) as (
      values
        ('13031', 'Onondaga', 'Camillus'),
        ('13057', 'Onondaga', 'East Syracuse'),
        ('13066', 'Onondaga', 'Fayetteville'),
        ('13104', 'Onondaga', 'Manlius'),
        ('13108', 'Onondaga', 'Marcellus'),
        ('13152', 'Onondaga', 'Skaneateles'),
        ('13202', 'Onondaga', 'Syracuse'),
        ('13203', 'Onondaga', 'Syracuse'),
        ('13204', 'Onondaga', 'Syracuse'),
        ('13205', 'Onondaga', 'Syracuse'),
        ('13206', 'Onondaga', 'Syracuse'),
        ('13207', 'Onondaga', 'Syracuse'),
        ('13208', 'Onondaga', 'Syracuse'),
        ('13209', 'Onondaga', 'Syracuse'),
        ('13210', 'Onondaga', 'Syracuse'),
        ('13211', 'Onondaga', 'Syracuse'),
        ('13212', 'Onondaga', 'North Syracuse'),
        ('13214', 'Onondaga', 'Syracuse'),
        ('13215', 'Onondaga', 'Syracuse'),
        ('13219', 'Onondaga', 'Syracuse'),
        ('13224', 'Onondaga', 'Syracuse'),
        ('13035', 'Madison', 'Cazenovia'),
        ('13037', 'Madison', 'Chittenango'),
        ('13082', 'Madison', 'Kirkville'),
        ('13122', 'Madison', 'New Woodstock'),
        ('13154', 'Madison', 'Sullivan'),
        ('13346', 'Madison', 'Hamilton'),
        ('13348', 'Madison', 'Lebanon')
    )
    update public.service_area_zips as existing
    set
      active = true,
      county = coalesce(existing.county, seeded.county),
      town = coalesce(existing.town, seeded.town)
    from seeded
    where existing.zip = seeded.zip;

    with seeded(zip, county, town) as (
      values
        ('13031', 'Onondaga', 'Camillus'),
        ('13057', 'Onondaga', 'East Syracuse'),
        ('13066', 'Onondaga', 'Fayetteville'),
        ('13104', 'Onondaga', 'Manlius'),
        ('13108', 'Onondaga', 'Marcellus'),
        ('13152', 'Onondaga', 'Skaneateles'),
        ('13202', 'Onondaga', 'Syracuse'),
        ('13203', 'Onondaga', 'Syracuse'),
        ('13204', 'Onondaga', 'Syracuse'),
        ('13205', 'Onondaga', 'Syracuse'),
        ('13206', 'Onondaga', 'Syracuse'),
        ('13207', 'Onondaga', 'Syracuse'),
        ('13208', 'Onondaga', 'Syracuse'),
        ('13209', 'Onondaga', 'Syracuse'),
        ('13210', 'Onondaga', 'Syracuse'),
        ('13211', 'Onondaga', 'Syracuse'),
        ('13212', 'Onondaga', 'North Syracuse'),
        ('13214', 'Onondaga', 'Syracuse'),
        ('13215', 'Onondaga', 'Syracuse'),
        ('13219', 'Onondaga', 'Syracuse'),
        ('13224', 'Onondaga', 'Syracuse'),
        ('13035', 'Madison', 'Cazenovia'),
        ('13037', 'Madison', 'Chittenango'),
        ('13082', 'Madison', 'Kirkville'),
        ('13122', 'Madison', 'New Woodstock'),
        ('13154', 'Madison', 'Sullivan'),
        ('13346', 'Madison', 'Hamilton'),
        ('13348', 'Madison', 'Lebanon')
    )
    insert into public.service_area_zips (zip, active, county, town)
    select seeded.zip, true, seeded.county, seeded.town
    from seeded
    where not exists (
      select 1
      from public.service_area_zips existing
      where existing.zip = seeded.zip
    );
  end if;
end
$$;
