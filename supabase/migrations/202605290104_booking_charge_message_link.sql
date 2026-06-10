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
