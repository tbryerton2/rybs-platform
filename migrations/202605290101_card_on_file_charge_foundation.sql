create extension if not exists pgcrypto;

create table if not exists public.customer_provider_accounts (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  provider text not null default 'square'
    check (provider in ('square')),
  provider_environment text not null default 'sandbox'
    check (provider_environment in ('sandbox', 'production')),
  provider_customer_id text not null,
  status text not null default 'active'
    check (status in ('active', 'disabled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_provider_accounts_business_id_idx
  on public.customer_provider_accounts (business_id);

create index if not exists customer_provider_accounts_customer_id_idx
  on public.customer_provider_accounts (customer_id);

create index if not exists customer_provider_accounts_provider_customer_id_idx
  on public.customer_provider_accounts (provider_customer_id);

create index if not exists customer_provider_accounts_status_idx
  on public.customer_provider_accounts (status);

create unique index if not exists customer_provider_accounts_business_customer_provider_unique
  on public.customer_provider_accounts (business_id, customer_id, provider, provider_environment);

create unique index if not exists customer_provider_accounts_provider_customer_unique
  on public.customer_provider_accounts (provider, provider_environment, provider_customer_id);

drop trigger if exists customer_provider_accounts_set_updated_at on public.customer_provider_accounts;
create trigger customer_provider_accounts_set_updated_at
before update on public.customer_provider_accounts
for each row execute function public.set_updated_at();

alter table public.customer_provider_accounts enable row level security;

create table if not exists public.customer_payment_methods (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  customer_provider_account_id uuid references public.customer_provider_accounts (id) on delete set null,
  provider text not null default 'square'
    check (provider in ('square')),
  provider_environment text not null default 'sandbox'
    check (provider_environment in ('sandbox', 'production')),
  provider_customer_id text not null,
  provider_payment_method_id text not null,
  card_brand text,
  card_last_4 text,
  card_exp_month integer
    check (card_exp_month is null or card_exp_month between 1 and 12),
  card_exp_year integer,
  status text not null default 'active'
    check (status in ('active', 'disabled', 'expired')),
  consent_text text,
  consent_accepted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint customer_payment_methods_provider_payment_method_unique
    unique (provider, provider_environment, provider_payment_method_id)
);

create index if not exists customer_payment_methods_business_id_idx
  on public.customer_payment_methods (business_id);

create index if not exists customer_payment_methods_customer_id_idx
  on public.customer_payment_methods (customer_id);

create index if not exists customer_payment_methods_customer_provider_account_id_idx
  on public.customer_payment_methods (customer_provider_account_id);

create index if not exists customer_payment_methods_provider_customer_id_idx
  on public.customer_payment_methods (provider_customer_id);

create index if not exists customer_payment_methods_provider_payment_method_id_idx
  on public.customer_payment_methods (provider_payment_method_id);

create index if not exists customer_payment_methods_status_idx
  on public.customer_payment_methods (status);

drop trigger if exists customer_payment_methods_set_updated_at on public.customer_payment_methods;
create trigger customer_payment_methods_set_updated_at
before update on public.customer_payment_methods
for each row execute function public.set_updated_at();

alter table public.customer_payment_methods enable row level security;

create table if not exists public.booking_charges (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_payment_method_id uuid references public.customer_payment_methods (id) on delete set null,
  charge_type text not null
    check (
      charge_type in (
        'weight_overage',
        'damage',
        'extra_day',
        'trip_fee',
        'prohibited_material',
        'manual_adjustment'
      )
    ),
  description text,
  amount_cents integer not null
    check (amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'draft'
    check (
      status in (
        'draft',
        'pending',
        'paid',
        'failed',
        'waived',
        'canceled',
        'refunded'
      )
    ),
  evidence_notes text,
  provider text
    check (provider is null or provider in ('square')),
  provider_environment text
    check (provider_environment is null or provider_environment in ('sandbox', 'production')),
  provider_payment_id text,
  paid_at timestamptz,
  failed_at timestamptz,
  waived_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_charges_business_id_idx
  on public.booking_charges (business_id);

create index if not exists booking_charges_booking_id_idx
  on public.booking_charges (booking_id);

create index if not exists booking_charges_customer_payment_method_id_idx
  on public.booking_charges (customer_payment_method_id);

create index if not exists booking_charges_charge_type_idx
  on public.booking_charges (charge_type);

create index if not exists booking_charges_status_idx
  on public.booking_charges (status);

create index if not exists booking_charges_provider_payment_id_idx
  on public.booking_charges (provider_payment_id);

create index if not exists booking_charges_created_at_idx
  on public.booking_charges (created_at);

drop trigger if exists booking_charges_set_updated_at on public.booking_charges;
create trigger booking_charges_set_updated_at
before update on public.booking_charges
for each row execute function public.set_updated_at();

alter table public.booking_charges enable row level security;
