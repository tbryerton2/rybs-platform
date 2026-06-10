alter table public.bookings
  add column if not exists customer_first_name text,
  add column if not exists customer_last_name text;

alter table public.bookings
  drop column if exists customer_name,
  drop column if exists booking_contact_name,
  drop column if exists booking_contact_email,
  drop column if exists booking_contact_phone,
  drop column if exists booking_contact_email_normalized;
