alter table public.customers
  add column if not exists primary_state text;

alter table public.bookings
  add column if not exists customer_state text;

alter table public.customer_locations
  add column if not exists state text,
  add column if not exists access_notes text,
  add column if not exists onsite_contact_name text,
  add column if not exists onsite_contact_phone text;

update public.customer_locations
set state = coalesce(nullif(state, ''), nullif((select primary_state from public.customers where id = customer_locations.customer_id), ''), 'NY')
where state is null or state = '';

alter table public.customer_locations
  alter column state set not null;

create index if not exists customer_locations_customer_id_default_idx
  on public.customer_locations (customer_id, is_default desc, updated_at desc);
