alter table public.tenant_domains
  add column if not exists provider text
    check (provider is null or provider in ('vercel')),
  add column if not exists provider_status text not null default 'not_provisioned'
    check (provider_status in (
      'not_provisioned',
      'provisioning',
      'awaiting_dns',
      'awaiting_verification',
      'ready',
      'error'
    )),
  add column if not exists verification_status text not null default 'unknown'
    check (verification_status in ('unknown', 'verified', 'verification_required')),
  add column if not exists dns_instructions jsonb,
  add column if not exists last_checked_at timestamptz,
  add column if not exists last_error text;

create index if not exists tenant_domains_provider_status_idx
  on public.tenant_domains (provider, provider_status);
