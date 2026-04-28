alter table public.bookings
  add column if not exists dumpster_size text,
  add column if not exists dumpster_product_id text;

update public.bookings
set
  dumpster_size = coalesce(nullif(trim(dumpster_size), ''), '14 yard'),
  dumpster_product_id = coalesce(nullif(trim(dumpster_product_id), ''), 'default')
where dumpster_size is null
   or trim(dumpster_size) = ''
   or dumpster_product_id is null
   or trim(dumpster_product_id) = '';

create index if not exists bookings_dumpster_size_idx
  on public.bookings (dumpster_size);

create index if not exists bookings_dumpster_product_id_idx
  on public.bookings (dumpster_product_id);
