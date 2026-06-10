create extension if not exists pgcrypto;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'booking-charge-attachments',
  'booking-charge-attachments',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where not exists (
  select 1 from storage.buckets where id = 'booking-charge-attachments'
);

create table if not exists public.booking_charge_attachments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  booking_charge_id uuid not null references public.booking_charges (id) on delete cascade,
  storage_bucket text not null default 'booking-charge-attachments'
    check (storage_bucket = 'booking-charge-attachments'),
  storage_path text not null
    check (length(btrim(storage_path)) > 0),
  original_filename text not null
    check (length(btrim(original_filename)) > 0),
  content_type text not null
    check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf')),
  file_size_bytes integer not null
    check (file_size_bytes > 0),
  description text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists booking_charge_attachments_business_id_idx
  on public.booking_charge_attachments (business_id);

create index if not exists booking_charge_attachments_booking_id_idx
  on public.booking_charge_attachments (booking_id);

create index if not exists booking_charge_attachments_booking_charge_id_idx
  on public.booking_charge_attachments (booking_charge_id);

create index if not exists booking_charge_attachments_created_at_idx
  on public.booking_charge_attachments (created_at);

create unique index if not exists booking_charge_attachments_storage_object_unique
  on public.booking_charge_attachments (storage_bucket, storage_path);

drop trigger if exists booking_charge_attachments_set_updated_at on public.booking_charge_attachments;
create trigger booking_charge_attachments_set_updated_at
before update on public.booking_charge_attachments
for each row execute function public.set_updated_at();

alter table public.booking_charge_attachments enable row level security;
