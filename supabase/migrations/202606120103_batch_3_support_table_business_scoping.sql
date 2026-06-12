-- Phase 1B Batch 3 business scoping for support tables.
--
-- Adds nullable business_id columns to audit/event/message support tables.
-- business_id intentionally remains nullable until runtime writers and read
-- filters are updated and verified. Legacy entity_history rows that cannot be
-- resolved to a known parent business should be reviewed before NOT NULL
-- hardening.

alter table public.entity_history
  add column if not exists business_id uuid;

alter table public.booking_events
  add column if not exists business_id uuid;

alter table public.booking_messages
  add column if not exists business_id uuid;

comment on column public.entity_history.business_id is
  'Phase 1B Batch 3 business scoping. Nullable until support-table writers/read filters are business-scoped; unresolved legacy history rows should be reviewed before NOT NULL hardening.';

comment on column public.booking_events.business_id is
  'Phase 1B Batch 3 business scoping. Nullable until booking event writers/read filters are business-scoped.';

comment on column public.booking_messages.business_id is
  'Phase 1B Batch 3 business scoping. Nullable until booking message writers/read filters are business-scoped.';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'entity_history_business_id_fkey'
      and conrelid = 'public.entity_history'::regclass
  ) then
    alter table public.entity_history
      add constraint entity_history_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_events_business_id_fkey'
      and conrelid = 'public.booking_events'::regclass
  ) then
    alter table public.booking_events
      add constraint booking_events_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'booking_messages_business_id_fkey'
      and conrelid = 'public.booking_messages'::regclass
  ) then
    alter table public.booking_messages
      add constraint booking_messages_business_id_fkey
      foreign key (business_id) references public.tenants(id) on delete restrict;
  end if;
end
$$;

update public.booking_events events
set business_id = bookings.business_id
from public.bookings bookings
where events.booking_id = bookings.id
  and events.business_id is null
  and bookings.business_id is not null;

update public.booking_messages messages
set business_id = bookings.business_id
from public.bookings bookings
where messages.booking_id = bookings.id
  and messages.business_id is null
  and bookings.business_id is not null;

update public.booking_messages messages
set business_id = charges.business_id
from public.booking_charges charges
where messages.booking_charge_id = charges.id
  and messages.business_id is null
  and charges.business_id is not null;

update public.entity_history history
set business_id = bookings.business_id
from public.bookings bookings
where history.entity_type = 'booking'
  and history.entity_id = bookings.id
  and history.business_id is null
  and bookings.business_id is not null;

update public.entity_history history
set business_id = customers.business_id
from public.customers customers
where history.entity_type = 'customer'
  and history.entity_id = customers.id
  and history.business_id is null
  and customers.business_id is not null;

update public.entity_history history
set business_id = employees.business_id
from public.business_employees employees
where history.entity_type = 'employee'
  and history.entity_id = employees.id
  and history.business_id is null
  and employees.business_id is not null;

update public.entity_history history
set business_id = expenses.business_id
from public.business_expenses expenses
where history.entity_type = 'expense'
  and history.entity_id = expenses.id
  and history.business_id is null
  and expenses.business_id is not null;

create index if not exists entity_history_business_entity_idx
  on public.entity_history (business_id, entity_type, entity_id, created_at desc);

create index if not exists booking_events_business_booking_idx
  on public.booking_events (business_id, booking_id, created_at desc);

create index if not exists booking_messages_business_booking_idx
  on public.booking_messages (business_id, booking_id);

create index if not exists booking_messages_business_status_channel_created_idx
  on public.booking_messages (business_id, status, channel, created_at);
