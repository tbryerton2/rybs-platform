create table if not exists public.tenant_domains (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  hostname text not null,
  domain_type text not null
    check (domain_type in ('platform_subdomain', 'custom_domain', 'booking_domain')),
  status text not null
    check (status in ('active', 'pending', 'disabled')),
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_domains_hostname_normalized_check
    check (
      hostname = lower(hostname)
      and hostname = btrim(hostname)
      and hostname !~ '^[a-z][a-z0-9+.-]*://'
      and hostname !~ '[:/?#]'
      and hostname !~ '/$'
      and hostname <> ''
    ),
  constraint tenant_domains_hostname_unique unique (hostname)
);

create index if not exists tenant_domains_tenant_id_idx
  on public.tenant_domains (tenant_id);

create index if not exists tenant_domains_active_hostname_idx
  on public.tenant_domains (hostname)
  where status = 'active';

create unique index if not exists tenant_domains_one_primary_per_tenant_idx
  on public.tenant_domains (tenant_id)
  where is_primary;

drop trigger if exists tenant_domains_set_updated_at on public.tenant_domains;
create trigger tenant_domains_set_updated_at
before update on public.tenant_domains
for each row execute function public.set_updated_at();
