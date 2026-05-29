alter table public.booking_payments
  add column if not exists booking_charge_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_payments'::regclass
      and conname = 'booking_payments_booking_charge_id_fkey'
  ) then
    alter table public.booking_payments
      add constraint booking_payments_booking_charge_id_fkey
      foreign key (booking_charge_id)
      references public.booking_charges (id)
      on delete set null;
  end if;
end
$$;

create index if not exists booking_payments_booking_charge_id_idx
  on public.booking_payments (booking_charge_id);

create unique index if not exists booking_payments_booking_charge_id_paid_key
  on public.booking_payments (booking_charge_id)
  where booking_charge_id is not null
    and status = 'paid';

create unique index if not exists booking_payments_booking_charge_id_pending_key
  on public.booking_payments (booking_charge_id)
  where booking_charge_id is not null
    and status = 'pending';
