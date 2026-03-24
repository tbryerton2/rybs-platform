alter table public.bookings
  add column if not exists base_rental_price_cents integer,
  add column if not exists included_rental_days integer,
  add column if not exists rental_duration_days integer,
  add column if not exists extra_days integer,
  add column if not exists daily_overage_price_cents integer,
  add column if not exists extra_days_charge_cents integer,
  add column if not exists subtotal_cents integer,
  add column if not exists taxable_subtotal_cents integer,
  add column if not exists tax_cents integer;
