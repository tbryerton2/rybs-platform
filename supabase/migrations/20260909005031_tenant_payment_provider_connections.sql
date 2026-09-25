create extension if not exists pgcrypto;

create table if not exists public.tenant_payment_provider_connections (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'square'
    check (provider in ('square')),
  provider_environment text not null default 'sandbox'
    check (provider_environment in ('sandbox', 'production')),
  status text not null default 'pending'
    check (
      status in (
        'pending',
        'active',
        'reauth_required',
        'revoked',
        'disabled',
        'error'
      )
    ),
  provider_merchant_id text,
  provider_location_id text,
  provider_location_name text,
  granted_scopes text[] not null default '{}',
  encrypted_access_token text,
  encrypted_refresh_token text,
  token_cipher_version integer not null default 1,
  token_cipher_key_id text,
  access_token_expires_at timestamptz,
  token_refreshed_at timestamptz,
  connected_by uuid references auth.users (id) on delete set null,
  connected_at timestamptz,
  revoked_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.tenant_payment_provider_connections is
  'Tenant-owned payment provider connections. For Square, each row represents one business connected to its own Square seller account and selected location.';

comment on column public.tenant_payment_provider_connections.encrypted_access_token is
  'Server-only encrypted OAuth access token. Migrations must never seed token values.';

comment on column public.tenant_payment_provider_connections.encrypted_refresh_token is
  'Server-only encrypted OAuth refresh token. Migrations must never seed token values.';

comment on column public.tenant_payment_provider_connections.provider_merchant_id is
  'Provider seller or merchant identifier used to route webhooks and scope provider object IDs.';

comment on column public.tenant_payment_provider_connections.provider_location_id is
  'Tenant-selected provider location used for checkout and charges.';

create index if not exists tenant_payment_provider_connections_business_id_idx
  on public.tenant_payment_provider_connections (business_id);

create index if not exists tenant_payment_provider_connections_status_idx
  on public.tenant_payment_provider_connections (status);

create index if not exists tenant_payment_provider_connections_provider_merchant_idx
  on public.tenant_payment_provider_connections (
    provider,
    provider_environment,
    provider_merchant_id
  )
  where provider_merchant_id is not null;

create unique index if not exists tenant_payment_provider_connections_active_business_provider_unique
  on public.tenant_payment_provider_connections (
    business_id,
    provider,
    provider_environment
  )
  where status in ('pending', 'active', 'reauth_required', 'error');

create unique index if not exists tenant_payment_provider_connections_active_merchant_unique
  on public.tenant_payment_provider_connections (
    provider,
    provider_environment,
    provider_merchant_id
  )
  where provider_merchant_id is not null
    and status in ('pending', 'active', 'reauth_required', 'error');

drop trigger if exists tenant_payment_provider_connections_set_updated_at
  on public.tenant_payment_provider_connections;
create trigger tenant_payment_provider_connections_set_updated_at
before update on public.tenant_payment_provider_connections
for each row execute function public.set_updated_at();

alter table public.tenant_payment_provider_connections enable row level security;

revoke all on table public.tenant_payment_provider_connections from public;
revoke all on table public.tenant_payment_provider_connections from anon;
revoke all on table public.tenant_payment_provider_connections from authenticated;
grant all on table public.tenant_payment_provider_connections to service_role;

alter table public.booking_payments
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text;

comment on column public.booking_payments.payment_provider_connection_id is
  'Tenant payment provider connection used for this payment. Null is allowed for legacy Tan Can Man fallback payments during migration.';

comment on column public.booking_payments.provider_merchant_id is
  'Provider seller or merchant identifier captured with the payment for webhook routing and auditability.';

create index if not exists booking_payments_payment_provider_connection_id_idx
  on public.booking_payments (payment_provider_connection_id);

create index if not exists booking_payments_connection_provider_payment_id_idx
  on public.booking_payments (payment_provider_connection_id, provider_payment_id)
  where payment_provider_connection_id is not null
    and provider_payment_id is not null;

create index if not exists booking_payments_provider_merchant_payment_id_idx
  on public.booking_payments (
    provider,
    provider_environment,
    provider_merchant_id,
    provider_payment_id
  )
  where provider_merchant_id is not null
    and provider_payment_id is not null;

alter table public.customer_provider_accounts
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text;

comment on column public.customer_provider_accounts.payment_provider_connection_id is
  'Tenant payment provider connection that owns this provider customer. Null is allowed for legacy Tan Can Man fallback rows during migration.';

comment on column public.customer_provider_accounts.provider_merchant_id is
  'Provider seller or merchant identifier that owns this provider customer.';

drop index if exists customer_provider_accounts_provider_customer_unique;

create index if not exists customer_provider_accounts_payment_provider_connection_id_idx
  on public.customer_provider_accounts (payment_provider_connection_id);

create unique index if not exists customer_provider_accounts_connection_customer_unique
  on public.customer_provider_accounts (payment_provider_connection_id, customer_id)
  where payment_provider_connection_id is not null;

create unique index if not exists customer_provider_accounts_connection_provider_customer_unique
  on public.customer_provider_accounts (payment_provider_connection_id, provider_customer_id)
  where payment_provider_connection_id is not null;

create unique index if not exists customer_provider_accounts_legacy_provider_customer_unique
  on public.customer_provider_accounts (provider, provider_environment, provider_customer_id)
  where payment_provider_connection_id is null;

alter table public.customer_payment_methods
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text;

comment on column public.customer_payment_methods.payment_provider_connection_id is
  'Tenant payment provider connection that owns this saved provider payment method. Null is allowed for legacy Tan Can Man fallback rows during migration.';

comment on column public.customer_payment_methods.provider_merchant_id is
  'Provider seller or merchant identifier that owns this saved provider payment method.';

alter table public.customer_payment_methods
  drop constraint if exists customer_payment_methods_provider_payment_method_unique;

create index if not exists customer_payment_methods_payment_provider_connection_id_idx
  on public.customer_payment_methods (payment_provider_connection_id);

create unique index if not exists customer_payment_methods_connection_payment_method_unique
  on public.customer_payment_methods (payment_provider_connection_id, provider_payment_method_id)
  where payment_provider_connection_id is not null;

create unique index if not exists customer_payment_methods_legacy_payment_method_unique
  on public.customer_payment_methods (provider, provider_environment, provider_payment_method_id)
  where payment_provider_connection_id is null;

alter table public.booking_charges
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text,
  add column if not exists provider_location_id text;

comment on column public.booking_charges.payment_provider_connection_id is
  'Tenant payment provider connection used for this charge. Null is allowed for legacy Tan Can Man fallback charges during migration.';

comment on column public.booking_charges.provider_merchant_id is
  'Provider seller or merchant identifier captured with the charge for webhook routing and auditability.';

comment on column public.booking_charges.provider_location_id is
  'Provider location used for this charge.';

create index if not exists booking_charges_payment_provider_connection_id_idx
  on public.booking_charges (payment_provider_connection_id);

create index if not exists booking_charges_connection_provider_payment_id_idx
  on public.booking_charges (payment_provider_connection_id, provider_payment_id)
  where payment_provider_connection_id is not null
    and provider_payment_id is not null;

alter table public.payment_exceptions
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text,
  add column if not exists provider_location_id text;

comment on column public.payment_exceptions.payment_provider_connection_id is
  'Tenant payment provider connection related to this payment exception when known.';

comment on column public.payment_exceptions.provider_merchant_id is
  'Provider seller or merchant identifier related to this payment exception when known.';

comment on column public.payment_exceptions.provider_location_id is
  'Provider location related to this payment exception when known.';

create index if not exists payment_exceptions_payment_provider_connection_id_idx
  on public.payment_exceptions (payment_provider_connection_id);

alter table public.square_webhook_events
  add column if not exists payment_provider_connection_id uuid references public.tenant_payment_provider_connections (id) on delete set null,
  add column if not exists provider_merchant_id text,
  add column if not exists provider_location_id text;

comment on column public.square_webhook_events.payment_provider_connection_id is
  'Tenant payment provider connection matched from the Square webhook merchant and environment.';

comment on column public.square_webhook_events.provider_merchant_id is
  'Square merchant identifier from the webhook payload.';

comment on column public.square_webhook_events.provider_location_id is
  'Square location identifier from the webhook payload when present.';

create index if not exists square_webhook_events_payment_provider_connection_id_idx
  on public.square_webhook_events (payment_provider_connection_id);

create index if not exists square_webhook_events_merchant_payment_idx
  on public.square_webhook_events (
    provider_environment,
    provider_merchant_id,
    provider_payment_id
  )
  where provider_merchant_id is not null
    and provider_payment_id is not null;
