create extension if not exists pgcrypto;

create table if not exists public.booking_payments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_hold_id uuid references public.booking_holds (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  provider text not null default 'square'
    check (provider in ('square')),
  provider_environment text not null default 'sandbox'
    check (provider_environment in ('sandbox', 'production')),
  status text not null default 'pending'
    check (status in ('pending', 'paid', 'failed', 'canceled', 'refunded', 'partially_refunded')),
  amount_cents integer not null
    check (amount_cents >= 0),
  currency text not null default 'USD',
  provider_payment_id text,
  provider_order_id text,
  provider_location_id text,
  idempotency_key text not null,
  failure_code text,
  failure_message text,
  raw_provider_response jsonb,
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_payments_business_id_idx
  on public.booking_payments (business_id);

create index if not exists booking_payments_booking_hold_id_idx
  on public.booking_payments (booking_hold_id);

create index if not exists booking_payments_booking_id_idx
  on public.booking_payments (booking_id);

create index if not exists booking_payments_provider_payment_id_idx
  on public.booking_payments (provider_payment_id);

create unique index if not exists booking_payments_idempotency_key_key
  on public.booking_payments (idempotency_key);

drop trigger if exists booking_payments_set_updated_at on public.booking_payments;
create trigger booking_payments_set_updated_at
before update on public.booking_payments
for each row execute function public.set_updated_at();

alter table public.bookings
  add column if not exists payment_status text not null default 'unpaid',
  add column if not exists paid_at timestamptz,
  add column if not exists payment_provider text,
  add column if not exists payment_provider_payment_id text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_payment_status_check'
  ) then
    alter table public.bookings
      add constraint bookings_payment_status_check
      check (
        payment_status in (
          'unpaid',
          'pending',
          'paid',
          'failed',
          'refunded',
          'partially_refunded'
        )
      );
  end if;
end
$$;

create index if not exists bookings_payment_status_idx
  on public.bookings (payment_status);

create index if not exists bookings_payment_provider_payment_id_idx
  on public.bookings (payment_provider_payment_id);
