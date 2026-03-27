alter table public.customers
  add column if not exists company text,
  add column if not exists preferred_contact_method text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'customers_preferred_contact_method_check'
  ) then
    alter table public.customers
      add constraint customers_preferred_contact_method_check
      check (
        preferred_contact_method is null
        or preferred_contact_method in ('email', 'phone', 'either')
      );
  end if;
end $$;
