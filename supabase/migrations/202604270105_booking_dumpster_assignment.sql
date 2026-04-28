alter table public.bookings
  add column if not exists dumpster_id uuid references public.dumpsters (id) on delete set null;

create index if not exists bookings_dumpster_id_idx
  on public.bookings (dumpster_id);
