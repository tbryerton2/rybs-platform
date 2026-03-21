alter table public.bookings
  add column if not exists reordered_from_booking_id uuid;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_reordered_from_booking_id_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_reordered_from_booking_id_fkey
      foreign key (reordered_from_booking_id)
      references public.bookings (id)
      on delete set null;
  end if;
end $$;

create index if not exists bookings_reordered_from_booking_id_idx
  on public.bookings (reordered_from_booking_id);
