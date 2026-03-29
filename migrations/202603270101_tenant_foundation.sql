create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tenant_settings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  category text not null,
  key text not null,
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_settings_tenant_category_key_unique
    unique (tenant_id, category, key)
);

create table if not exists public.tenant_content_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  value_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_content_entries_tenant_key_unique
    unique (tenant_id, key)
);

create index if not exists tenant_settings_tenant_id_idx
  on public.tenant_settings (tenant_id);

create index if not exists tenant_content_entries_tenant_id_idx
  on public.tenant_content_entries (tenant_id);

drop trigger if exists tenants_set_updated_at on public.tenants;
create trigger tenants_set_updated_at
before update on public.tenants
for each row execute function public.set_updated_at();

drop trigger if exists tenant_settings_set_updated_at on public.tenant_settings;
create trigger tenant_settings_set_updated_at
before update on public.tenant_settings
for each row execute function public.set_updated_at();

drop trigger if exists tenant_content_entries_set_updated_at on public.tenant_content_entries;
create trigger tenant_content_entries_set_updated_at
before update on public.tenant_content_entries
for each row execute function public.set_updated_at();

with seeded_tenant as (
  insert into public.tenants (slug, status)
  values ('tan-can-man', 'active')
  on conflict (slug) do update
    set status = excluded.status,
        updated_at = now()
  returning id
), resolved_tenant as (
  select id from seeded_tenant
  union all
  select id from public.tenants where slug = 'tan-can-man'
  limit 1
)
insert into public.tenant_settings (tenant_id, category, key, value_json)
select resolved_tenant.id, seeded.category, seeded.key, seeded.value_json
from resolved_tenant
cross join (
  values
    ('brand', 'name', to_jsonb('Tan Can Man'::text)),
    ('brand', 'tagline', to_jsonb('Big Jobs Need Big Cans'::text)),
    ('brand', 'legalDisplayName', to_jsonb('A division of EJs Contractors'::text)),
    ('brand', 'headerPrimaryCtaLabel', to_jsonb('Call/Text'::text)),
    ('brand', 'headerPrimaryCtaType', to_jsonb('tel'::text)),
    ('brand', 'headerPrimaryCtaValue', to_jsonb('+1-315-555-0123'::text)),
    ('support', 'phone', to_jsonb('+1-315-555-0123'::text)),
    ('support', 'email', 'null'::jsonb),
    ('support', 'timezone', to_jsonb('America/New_York'::text)),
    ('runtime', 'storageNamespace', to_jsonb('tan_can_man'::text))
) as seeded(category, key, value_json)
on conflict (tenant_id, category, key) do nothing;
