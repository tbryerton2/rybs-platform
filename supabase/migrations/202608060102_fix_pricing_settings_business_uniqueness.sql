-- Correct pricing_settings uniqueness for multi-tenant SaaS.
--
-- Hosted databases may still have the old global singleton unique index
-- pricing_settings_singleton_idx, which allows only one pricing_settings row
-- for the whole application. Drop that named legacy rule only, then ensure the
-- business-scoped uniqueness rule exists.

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.pricing_settings'::regclass
      and conname = 'pricing_settings_singleton_idx'
  ) then
    alter table public.pricing_settings
      drop constraint pricing_settings_singleton_idx;
  end if;
end
$$;

drop index if exists public.pricing_settings_singleton_idx;

do $$
begin
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
    where conrelid = 'public.pricing_settings'::regclass
      and conname = 'pricing_settings_business_id_key'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_business_id_key
      unique (business_id);
  end if;
end
$$;

comment on constraint pricing_settings_business_id_key on public.pricing_settings is
  'Enforces one pricing settings row per business. Replaces legacy global singleton uniqueness.';
