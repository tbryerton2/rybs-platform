alter table public.booking_holds
  add column if not exists dumpster_size text,
  add column if not exists dumpster_product_id text;

create index if not exists booking_holds_dumpster_size_idx
  on public.booking_holds (dumpster_size);

create index if not exists booking_holds_dumpster_product_id_idx
  on public.booking_holds (dumpster_product_id);

update public.booking_holds
set
  dumpster_size = coalesce(nullif(trim(dumpster_size), ''), '14 yard'),
  dumpster_product_id = coalesce(nullif(trim(dumpster_product_id), ''), 'default')
where status in ('active', 'converting')
  and (
    dumpster_size is null
    or trim(dumpster_size) = ''
    or dumpster_product_id is null
    or trim(dumpster_product_id) = ''
  );
