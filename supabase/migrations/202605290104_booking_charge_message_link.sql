create extension if not exists pgcrypto;

create table if not exists public.booking_messages (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  channel text not null check (channel in ('email')),
  direction text not null check (direction in ('outbound')),
  template text not null,
  "to" text,
  subject text,
  body text,
  provider text,
  provider_message_id text,
  status text not null default 'queued' check (status in ('queued', 'sent', 'failed')),
  error text,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists booking_messages_booking_id_idx
  on public.booking_messages (booking_id);

create index if not exists booking_messages_status_channel_created_idx
  on public.booking_messages (status, channel, created_at);

alter table public.booking_messages enable row level security;

alter table public.booking_messages
  add column if not exists booking_charge_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_messages'::regclass
      and conname = 'booking_messages_booking_charge_id_fkey'
  ) then
    alter table public.booking_messages
      add constraint booking_messages_booking_charge_id_fkey
      foreign key (booking_charge_id)
      references public.booking_charges (id)
      on delete set null;
  end if;
end
$$;

create index if not exists booking_messages_booking_charge_id_idx
  on public.booking_messages (booking_charge_id);

create unique index if not exists booking_messages_post_booking_charge_paid_once_key
  on public.booking_messages (booking_charge_id, template)
  where booking_charge_id is not null
    and template = 'post_booking_charge_paid'
    and status in ('queued', 'sent');
