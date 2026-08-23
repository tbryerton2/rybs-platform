create extension if not exists pgcrypto;

create table if not exists public.tenant_email_identities (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  sender_domain text not null,
  sender_local_part text not null default 'bookings',
  sender_display_name text,
  reply_to_email text,
  provider text not null default 'ses',
  provider_status text not null default 'pending',
  verification_status text not null default 'pending',
  ses_region text,
  dkim_tokens jsonb not null default '[]'::jsonb,
  dns_instructions jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_email_identities_business_unique unique (business_id),
  constraint tenant_email_identities_sender_domain_unique unique (sender_domain),
  constraint tenant_email_identities_sender_domain_normalized_check
    check (
      sender_domain = lower(sender_domain)
      and sender_domain = btrim(sender_domain)
      and sender_domain !~ '^[a-z][a-z0-9+.-]*://'
      and sender_domain !~ '[:/?#]'
      and sender_domain <> ''
      and length(sender_domain) <= 253
      and sender_domain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$'
    ),
  constraint tenant_email_identities_sender_local_part_check
    check (
      sender_local_part = lower(sender_local_part)
      and sender_local_part = btrim(sender_local_part)
      and length(sender_local_part) between 1 and 64
      and sender_local_part ~ '^[a-z0-9][a-z0-9._+-]{0,63}$'
      and sender_local_part !~ '\.\.'
      and sender_local_part !~ '\.$'
    ),
  constraint tenant_email_identities_reply_to_email_check
    check (
      reply_to_email is null
      or (
        reply_to_email = lower(reply_to_email)
        and reply_to_email = btrim(reply_to_email)
        and reply_to_email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      )
    ),
  constraint tenant_email_identities_provider_check
    check (provider in ('ses')),
  constraint tenant_email_identities_provider_status_check
    check (provider_status in ('pending', 'dns_required', 'verified', 'failed', 'disabled')),
  constraint tenant_email_identities_verification_status_check
    check (verification_status in ('pending', 'dns_required', 'verified', 'failed', 'disabled')),
  constraint tenant_email_identities_dkim_tokens_array_check
    check (jsonb_typeof(dkim_tokens) = 'array'),
  constraint tenant_email_identities_dns_instructions_object_check
    check (dns_instructions is null or jsonb_typeof(dns_instructions) = 'object')
);

comment on table public.tenant_email_identities is
  'Tenant-scoped customer-facing email sender identity. This is configuration/state only; current email delivery behavior is intentionally unchanged by this migration.';

comment on column public.tenant_email_identities.business_id is
  'References tenants.id, treated as the business id throughout the app.';

comment on column public.tenant_email_identities.sender_domain is
  'Normalized tenant-owned domain used to derive the From address with sender_local_part.';

comment on column public.tenant_email_identities.sender_local_part is
  'Normalized local part used with sender_domain to derive the From address. The default customer-facing sender is bookings.';

comment on column public.tenant_email_identities.sender_display_name is
  'Optional display name for customer-facing email. If null, runtime code may fall back to the tenant brand name.';

comment on column public.tenant_email_identities.reply_to_email is
  'Optional tenant-specific Reply-To address. This can point to a normal inbox such as Gmail.';

comment on column public.tenant_email_identities.provider_status is
  'SES identity readiness for the current tenant sender identity: pending, dns_required, verified, failed, or disabled.';

comment on column public.tenant_email_identities.verification_status is
  'SES domain verification state mirrored separately from provider lifecycle for future provisioning checks.';

create index if not exists tenant_email_identities_business_provider_status_idx
  on public.tenant_email_identities (business_id, provider_status);

create index if not exists tenant_email_identities_verification_status_idx
  on public.tenant_email_identities (verification_status);

create or replace function public.normalize_tenant_email_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.sender_domain = lower(btrim(new.sender_domain));
  new.sender_local_part = lower(btrim(coalesce(new.sender_local_part, 'bookings')));
  new.provider = lower(btrim(coalesce(new.provider, 'ses')));
  new.provider_status = lower(btrim(coalesce(new.provider_status, 'pending')));
  new.verification_status = lower(btrim(coalesce(new.verification_status, 'pending')));
  new.sender_display_name = nullif(btrim(new.sender_display_name), '');
  new.reply_to_email = lower(nullif(btrim(new.reply_to_email), ''));
  new.ses_region = nullif(btrim(new.ses_region), '');
  new.last_error = nullif(btrim(new.last_error), '');
  return new;
end;
$$;

drop trigger if exists tenant_email_identities_normalize on public.tenant_email_identities;
create trigger tenant_email_identities_normalize
before insert or update on public.tenant_email_identities
for each row execute function public.normalize_tenant_email_identity();

drop trigger if exists tenant_email_identities_set_updated_at on public.tenant_email_identities;
create trigger tenant_email_identities_set_updated_at
before update on public.tenant_email_identities
for each row execute function public.set_updated_at();

alter table public.tenant_email_identities enable row level security;

revoke all on table public.tenant_email_identities from anon;
revoke all on table public.tenant_email_identities from authenticated;
grant all on table public.tenant_email_identities to service_role;

with tan_can_man_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
), tan_can_man_support as (
  select
    tenant_settings.tenant_id,
    case
      when jsonb_typeof(tenant_settings.value_json) = 'string'
        and trim(both '"' from tenant_settings.value_json::text) ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'
      then lower(trim(both '"' from tenant_settings.value_json::text))
      else null
    end as reply_to_email
  from public.tenant_settings
  join tan_can_man_tenant on tan_can_man_tenant.id = tenant_settings.tenant_id
  where tenant_settings.category = 'support'
    and tenant_settings.key = 'email'
  limit 1
)
insert into public.tenant_email_identities (
  business_id,
  sender_domain,
  sender_local_part,
  sender_display_name,
  reply_to_email,
  provider,
  provider_status,
  verification_status
)
select
  tan_can_man_tenant.id,
  'tancanman.com',
  'bookings',
  'Tan Can Man',
  tan_can_man_support.reply_to_email,
  'ses',
  'pending',
  'pending'
from tan_can_man_tenant
left join tan_can_man_support on tan_can_man_support.tenant_id = tan_can_man_tenant.id
on conflict on constraint tenant_email_identities_business_unique do nothing;
