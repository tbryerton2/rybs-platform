create extension if not exists pgcrypto;

create or replace function public.normalize_email(input text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(input)), '')
$$;

create or replace function public.normalize_phone(input text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(input, ''), '[^0-9]', '', 'g'), '')
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_booking_ref(p_prefix text default 'BK')
returns text
language plpgsql
as $$
declare
  candidate text;
begin
  loop
    candidate := upper(coalesce(nullif(trim(p_prefix), ''), 'BK')) || '-' || lpad((floor(random() * 1000000))::int::text, 6, '0');

    exit when not exists (
      select 1
      from public.bookings
      where booking_ref = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.prevent_booking_ref_changes()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'UPDATE' and old.booking_ref is distinct from new.booking_ref then
    raise exception 'booking_ref is immutable';
  end if;

  return new;
end;
$$;

do $$
declare
  customers_kind "char";
  bookings_kind "char";
begin
  select c.relkind
    into customers_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'customers';

  select c.relkind
    into bookings_kind
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = 'bookings';

  if customers_kind is distinct from 'r' and customers_kind is distinct from 'p' then
    raise exception 'identity reconciliation requires public.customers to be a base table; found relkind=%', customers_kind;
  end if;

  if bookings_kind is distinct from 'r' and bookings_kind is distinct from 'p' then
    raise exception 'identity reconciliation requires public.bookings to be a base table; found relkind=%', bookings_kind;
  end if;
end
$$;

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists primary_street text,
  add column if not exists primary_city text,
  add column if not exists primary_zip text,
  add column if not exists notes text,
  add column if not exists portal_status text,
  add column if not exists last_login_at timestamptz,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text;

do $$
declare
  has_normalized_email boolean := false;
  normalized_email_is_generated boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
  )
  into has_normalized_email;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
      and is_generated = 'ALWAYS'
  )
  into normalized_email_is_generated;

  if has_normalized_email and exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'email_normalized'
  ) then
    execute $sql$
      update public.customers
      set normalized_email = coalesce(normalized_email, email_normalized)
      where normalized_email is null
        and email_normalized is not null
    $sql$;
  end if;

  if not has_normalized_email then
    execute $sql$
      alter table public.customers
      add column normalized_email text generated always as (public.normalize_email(email)) stored
    $sql$;
  elsif not normalized_email_is_generated then
    execute 'alter table public.customers drop constraint if exists customers_contact_required';
    execute 'drop index if exists public.customers_normalized_email_key';
    execute 'drop index if exists public.customers_normalized_email_key_v2';
    execute 'drop index if exists public.customers_email_normalized_key';
    execute 'drop trigger if exists customers_sync_normalized_email on public.customers';
    execute 'drop trigger if exists customers_sync_identity_email on public.customers';
    execute 'alter table public.customers drop column normalized_email';
    execute $sql$
      alter table public.customers
      add column normalized_email text generated always as (public.normalize_email(email)) stored
    $sql$;
  end if;
end
$$;

update public.customers
set
  portal_status = case
    when portal_status = 'disabled' then 'deactivated'
    else coalesce(portal_status, 'invited')
  end
where portal_status is null
  or portal_status = 'disabled'
  or portal_status not in ('invited', 'active', 'deactivated');

do $$
declare
  duplicate_count integer;
begin
  select count(*)
  into duplicate_count
  from (
    select public.normalize_email(email)
    from public.customers
    where public.normalize_email(email) is not null
    group by public.normalize_email(email)
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'identity reconciliation aborted: duplicate customers by normalized email (% duplicates) must be merged first', duplicate_count;
  end if;
end
$$;

alter table public.customers
  alter column portal_status set default 'invited';

alter table public.customers
  drop constraint if exists customers_portal_status_check;

alter table public.customers
  add constraint customers_portal_status_check
  check (portal_status in ('invited', 'active', 'deactivated'));

alter table public.customers
  drop constraint if exists customers_contact_required;

alter table public.customers
  add constraint customers_contact_required
  check (normalized_email is not null or phone is not null);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'identifier'
  ) then
    execute 'alter table public.customers alter column identifier drop not null';
    execute 'alter table public.customers alter column identifier drop default';
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'identifier_type'
  ) then
    execute 'alter table public.customers alter column identifier_type drop not null';
    execute 'alter table public.customers alter column identifier_type drop default';
  end if;
end
$$;

drop index if exists public.customers_email_normalized_key;
drop index if exists public.customers_normalized_email_key_v2;
create unique index if not exists customers_normalized_email_key
  on public.customers (normalized_email)
  where normalized_email is not null;

create unique index if not exists customers_auth_user_id_key
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create index if not exists customers_portal_status_idx
  on public.customers (portal_status);

drop trigger if exists customers_sync_normalized_email on public.customers;
drop trigger if exists customers_sync_identity_email on public.customers;
drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'email_normalized'
  ) then
    execute 'alter table public.customers drop column email_normalized';
  end if;
end
$$;

alter table public.bookings
  add column if not exists customer_id uuid,
  add column if not exists booking_ref text,
  add column if not exists booking_contact_name text,
  add column if not exists booking_contact_email text,
  add column if not exists booking_contact_phone text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.bookings'::regclass
      and conname = 'bookings_customer_id_fkey'
  ) then
    alter table public.bookings
      add constraint bookings_customer_id_fkey
      foreign key (customer_id) references public.customers (id) on delete set null;
  end if;
end
$$;

update public.bookings
set
  booking_contact_name = coalesce(booking_contact_name, customer_name),
  booking_contact_email = coalesce(booking_contact_email, customer_email),
  booking_contact_phone = coalesce(booking_contact_phone, customer_phone)
where booking_contact_name is null
   or booking_contact_email is null
   or booking_contact_phone is null;

do $$
declare
  has_contact_email_normalized boolean := false;
  contact_email_normalized_is_generated boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'booking_contact_email_normalized'
  )
  into has_contact_email_normalized;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'bookings'
      and column_name = 'booking_contact_email_normalized'
      and is_generated = 'ALWAYS'
  )
  into contact_email_normalized_is_generated;

  if not has_contact_email_normalized then
    execute $sql$
      alter table public.bookings
      add column booking_contact_email_normalized text generated always as (public.normalize_email(booking_contact_email)) stored
    $sql$;
  elsif not contact_email_normalized_is_generated then
    execute 'drop trigger if exists bookings_sync_contact_email on public.bookings';
    execute 'alter table public.bookings drop column booking_contact_email_normalized';
    execute $sql$
      alter table public.bookings
      add column booking_contact_email_normalized text generated always as (public.normalize_email(booking_contact_email)) stored
    $sql$;
  end if;
end
$$;

alter table public.bookings
  alter column booking_ref set default public.generate_booking_ref('BK');

do $$
declare
  booking_record record;
  duplicate_count integer;
begin
  for booking_record in
    select id
    from public.bookings
    where booking_ref is null
  loop
    update public.bookings
    set booking_ref = public.generate_booking_ref('BK')
    where id = booking_record.id
      and booking_ref is null;
  end loop;

  select count(*)
  into duplicate_count
  from (
    select booking_ref
    from public.bookings
    where booking_ref is not null
    group by booking_ref
    having count(*) > 1
  ) duplicates;

  if duplicate_count > 0 then
    raise exception 'identity reconciliation aborted: duplicate booking_ref values (% duplicates) must be resolved first', duplicate_count;
  end if;
end
$$;

alter table public.bookings
  alter column booking_ref set not null;

create unique index if not exists bookings_booking_ref_key
  on public.bookings (booking_ref);

create index if not exists bookings_customer_id_idx
  on public.bookings (customer_id);

drop trigger if exists bookings_sync_contact_email on public.bookings;
drop trigger if exists bookings_prevent_booking_ref_changes on public.bookings;
create trigger bookings_prevent_booking_ref_changes
before update on public.bookings
for each row execute function public.prevent_booking_ref_changes();

create table if not exists public.entity_history (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  field_name text not null,
  old_value text,
  new_value text,
  changed_by_type text not null default 'system',
  changed_by_id text,
  change_reason text,
  created_at timestamptz not null default now()
);

create index if not exists entity_history_entity_idx
  on public.entity_history (entity_type, entity_id, created_at desc);

create index if not exists entity_history_field_idx
  on public.entity_history (field_name, created_at desc);

with booking_contacts as (
  select distinct on (public.normalize_email(coalesce(b.booking_contact_email, b.customer_email)))
    coalesce(b.booking_contact_email, b.customer_email) as email,
    coalesce(b.booking_contact_name, b.customer_name) as name,
    coalesce(b.booking_contact_phone, b.customer_phone) as phone,
    coalesce(b.created_at, now()) as created_at
  from public.bookings b
  where public.normalize_email(coalesce(b.booking_contact_email, b.customer_email)) is not null
  order by public.normalize_email(coalesce(b.booking_contact_email, b.customer_email)), b.created_at asc nulls last
)
insert into public.customers (
  email,
  name,
  phone,
  portal_status,
  created_at,
  updated_at
)
select
  contact.email,
  contact.name,
  contact.phone,
  'invited',
  contact.created_at,
  now()
from booking_contacts contact
left join public.customers customer
  on customer.normalized_email = public.normalize_email(contact.email)
where customer.id is null;

update public.bookings booking
set customer_id = customer.id
from public.customers customer
where booking.customer_id is null
  and customer.normalized_email is not null
  and customer.normalized_email = public.normalize_email(coalesce(booking.booking_contact_email, booking.customer_email));

do $$
declare
  invalid_status_count integer;
  missing_booking_ref_count integer;
begin
  select count(*)
  into invalid_status_count
  from public.customers
  where portal_status not in ('invited', 'active', 'deactivated');

  if invalid_status_count > 0 then
    raise exception 'identity reconciliation validation failed: % customers still have invalid portal_status values', invalid_status_count;
  end if;

  select count(*)
  into missing_booking_ref_count
  from public.bookings
  where booking_ref is null;

  if missing_booking_ref_count > 0 then
    raise exception 'identity reconciliation validation failed: % bookings are still missing booking_ref', missing_booking_ref_count;
  end if;
end
$$;

insert into public.entity_history (
  entity_type,
  entity_id,
  field_name,
  old_value,
  new_value,
  changed_by_type,
  change_reason
)
select
  'customer',
  customer.id,
  'customer_created',
  null,
  coalesce(customer.email, customer.phone, customer.id::text),
  'system',
  'Backfilled existing customer record'
from public.customers customer
where not exists (
  select 1
  from public.entity_history history
  where history.entity_type = 'customer'
    and history.entity_id = customer.id
    and history.field_name = 'customer_created'
);

insert into public.entity_history (
  entity_type,
  entity_id,
  field_name,
  old_value,
  new_value,
  changed_by_type,
  change_reason
)
select
  'booking',
  booking.id,
  'booking_created',
  null,
  booking.booking_ref,
  'system',
  'Backfilled existing booking identity'
from public.bookings booking
where not exists (
  select 1
  from public.entity_history history
  where history.entity_type = 'booking'
    and history.entity_id = booking.id
    and history.field_name = 'booking_created'
);

select pg_notify('pgrst', 'reload schema');
