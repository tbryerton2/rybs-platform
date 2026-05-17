alter table public.pricing_settings
  add column if not exists included_services_blurb text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_included_services_blurb_length'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_included_services_blurb_length
      check (
        included_services_blurb is null
        or char_length(included_services_blurb) <= 300
      );
  end if;
end
$$;
