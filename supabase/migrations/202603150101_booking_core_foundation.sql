create extension if not exists pgcrypto;

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  customer_name text,
  customer_email text,
  customer_phone text,
  customer_street text,
  customer_city text,
  customer_zip text,
  delivery_date date,
  pickup_date date,
  pickup_mode text,
  status text not null default 'draft',
  total_price_cents integer,
  service_town text,
  service_county text,
  notes text
);
