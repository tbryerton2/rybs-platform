alter table public.bookings
  add column if not exists placement_preference text,
  add column if not exists placement_details text,
  add column if not exists access_issues jsonb not null default '[]'::jsonb,
  add column if not exists gate_instructions text,
  add column if not exists delivery_presence text,
  add column if not exists alternate_contact_name text,
  add column if not exists alternate_contact_phone text,
  add column if not exists placement_photo_url text,
  add column if not exists special_delivery_instructions text;

select pg_notify('pgrst', 'reload schema');
