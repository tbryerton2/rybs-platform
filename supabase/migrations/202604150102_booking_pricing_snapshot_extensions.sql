alter table public.bookings
  add column if not exists max_rental_days_snapshot integer,
  add column if not exists allow_extended_rental_at_booking_snapshot boolean;
