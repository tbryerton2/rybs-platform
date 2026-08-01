create extension if not exists pgcrypto;

create table if not exists public.square_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_id text not null,
  event_type text not null,
  provider_payment_id text,
  provider_environment text
    check (provider_environment is null or provider_environment in ('sandbox', 'production')),
  business_id uuid references public.tenants (id) on delete set null,
  booking_payment_id uuid references public.booking_payments (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  processing_status text not null default 'received'
    check (processing_status in ('received', 'processed', 'ignored', 'unmatched', 'failed')),
  processing_error text,
  raw_event jsonb not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists square_webhook_events_event_id_key
  on public.square_webhook_events (event_id);

create index if not exists square_webhook_events_provider_payment_id_idx
  on public.square_webhook_events (provider_payment_id);

create index if not exists square_webhook_events_business_id_idx
  on public.square_webhook_events (business_id);

create index if not exists square_webhook_events_booking_payment_id_idx
  on public.square_webhook_events (booking_payment_id);

create index if not exists square_webhook_events_processing_status_idx
  on public.square_webhook_events (processing_status);

drop trigger if exists square_webhook_events_set_updated_at on public.square_webhook_events;
create trigger square_webhook_events_set_updated_at
before update on public.square_webhook_events
for each row execute function public.set_updated_at();

alter table public.square_webhook_events enable row level security;

create table if not exists public.payment_exceptions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_hold_id uuid references public.booking_holds (id) on delete set null,
  booking_payment_id uuid references public.booking_payments (id) on delete set null,
  provider text not null default 'square'
    check (provider in ('square')),
  provider_environment text
    check (provider_environment is null or provider_environment in ('sandbox', 'production')),
  provider_payment_id text,
  amount_cents integer
    check (amount_cents is null or amount_cents >= 0),
  currency text not null default 'USD',
  status text not null default 'open'
    check (status in ('open', 'reviewing', 'resolved', 'ignored')),
  exception_type text not null,
  failure_reason text not null,
  customer_name text,
  customer_email text,
  customer_phone text,
  raw_context jsonb,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists payment_exceptions_business_id_idx
  on public.payment_exceptions (business_id);

create index if not exists payment_exceptions_booking_hold_id_idx
  on public.payment_exceptions (booking_hold_id);

create index if not exists payment_exceptions_booking_payment_id_idx
  on public.payment_exceptions (booking_payment_id);

create index if not exists payment_exceptions_provider_payment_id_idx
  on public.payment_exceptions (provider_payment_id);

create index if not exists payment_exceptions_status_idx
  on public.payment_exceptions (status);

drop trigger if exists payment_exceptions_set_updated_at on public.payment_exceptions;
create trigger payment_exceptions_set_updated_at
before update on public.payment_exceptions
for each row execute function public.set_updated_at();

alter table public.payment_exceptions enable row level security;
