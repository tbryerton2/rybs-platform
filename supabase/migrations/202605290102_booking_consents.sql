create extension if not exists pgcrypto;

create table if not exists public.booking_consents (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_hold_id uuid references public.booking_holds (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  customer_id uuid references public.customers (id) on delete set null,
  consent_type text not null
    check (consent_type in ('rental_terms', 'card_on_file')),
  consent_version text not null
    check (length(btrim(consent_version)) > 0),
  consent_text text not null
    check (length(btrim(consent_text)) > 0),
  accepted_at timestamptz not null,
  source_page text not null
    check (source_page in ('confirm', 'checkout', 'admin')),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_consents_business_id_idx
  on public.booking_consents (business_id);

create index if not exists booking_consents_booking_hold_id_idx
  on public.booking_consents (booking_hold_id);

create index if not exists booking_consents_booking_id_idx
  on public.booking_consents (booking_id);

create index if not exists booking_consents_customer_id_idx
  on public.booking_consents (customer_id);

create index if not exists booking_consents_consent_type_idx
  on public.booking_consents (consent_type);

create index if not exists booking_consents_accepted_at_idx
  on public.booking_consents (accepted_at);

create unique index if not exists booking_consents_hold_type_version_unique
  on public.booking_consents (business_id, booking_hold_id, consent_type, consent_version)
  where booking_hold_id is not null;

create unique index if not exists booking_consents_booking_type_version_unique
  on public.booking_consents (business_id, booking_id, consent_type, consent_version)
  where booking_id is not null;

drop trigger if exists booking_consents_set_updated_at on public.booking_consents;
create trigger booking_consents_set_updated_at
before update on public.booking_consents
for each row execute function public.set_updated_at();

alter table public.booking_consents enable row level security;
