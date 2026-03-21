create extension if not exists pgcrypto;

create or replace function public.normalize_email(input text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(input)), '')
$$;

create or replace function public.sync_customer_identity_email()
returns trigger
language plpgsql
as $$
begin
  new.normalized_email = public.normalize_email(new.email);
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'email_normalized'
  ) then
    new.email_normalized = public.normalize_email(new.email);
  end if;
  return new;
end;
$$;

create or replace function public.sync_booking_contact_email()
returns trigger
language plpgsql
as $$
begin
  new.booking_contact_email_normalized = public.normalize_email(new.booking_contact_email);
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

alter table public.customers
  add column if not exists normalized_email text,
  add column if not exists deactivated_at timestamptz,
  add column if not exists deactivation_reason text;

do $$
declare
  normalized_email_is_generated boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
      and is_generated = 'ALWAYS'
  )
  into normalized_email_is_generated;

  if exists (
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
end;
$$;

do $$
declare
  normalized_email_is_generated boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
      and is_generated = 'ALWAYS'
  )
  into normalized_email_is_generated;

  if normalized_email_is_generated then
    update public.customers
    set
      portal_status = case
        when portal_status = 'disabled' then 'deactivated'
        else coalesce(portal_status, 'invited')
      end
    where portal_status = 'disabled'
      or portal_status is null;
  else
    update public.customers
    set
      normalized_email = public.normalize_email(email),
      portal_status = case
        when portal_status = 'disabled' then 'deactivated'
        else coalesce(portal_status, 'invited')
      end
    where normalized_email is distinct from public.normalize_email(email)
      or portal_status = 'disabled'
      or portal_status is null;
  end if;
end;
$$;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'email_normalized'
  ) then
    execute $sql$
      update public.customers
      set email_normalized = normalized_email
      where email_normalized is distinct from normalized_email
    $sql$;
  end if;
end;
$$;

alter table public.customers
  alter column portal_status set default 'invited';

alter table public.customers
  drop constraint if exists customers_portal_status_check;

alter table public.customers
  add constraint customers_portal_status_check
  check (portal_status in ('invited', 'active', 'deactivated'));

drop trigger if exists customers_sync_normalized_email on public.customers;
drop trigger if exists customers_sync_identity_email on public.customers;
do $$
declare
  normalized_email_is_generated boolean := false;
begin
  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'customers'
      and column_name = 'normalized_email'
      and is_generated = 'ALWAYS'
  )
  into normalized_email_is_generated;

  if not normalized_email_is_generated then
    create trigger customers_sync_identity_email
    before insert or update of email on public.customers
    for each row execute function public.sync_customer_identity_email();
  end if;
end;
$$;

create unique index if not exists customers_normalized_email_key_v2
  on public.customers (normalized_email)
  where normalized_email is not null;

alter table public.bookings
  add column if not exists booking_ref text,
  add column if not exists booking_contact_name text,
  add column if not exists booking_contact_email text,
  add column if not exists booking_contact_email_normalized text,
  add column if not exists booking_contact_phone text;

update public.bookings
set
  booking_contact_name = coalesce(booking_contact_name, customer_name),
  booking_contact_email = coalesce(booking_contact_email, customer_email),
  booking_contact_email_normalized = coalesce(booking_contact_email_normalized, public.normalize_email(coalesce(booking_contact_email, customer_email))),
  booking_contact_phone = coalesce(booking_contact_phone, customer_phone)
where
  booking_contact_name is null
  or booking_contact_email is null
  or booking_contact_email_normalized is null
  or booking_contact_phone is null;

drop trigger if exists bookings_sync_contact_email on public.bookings;
create trigger bookings_sync_contact_email
before insert or update of booking_contact_email on public.bookings
for each row execute function public.sync_booking_contact_email();

alter table public.bookings
  alter column booking_ref set default public.generate_booking_ref('BK');

do $$
declare
  booking_record record;
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
end;
$$;

alter table public.bookings
  alter column booking_ref set not null;

create unique index if not exists bookings_booking_ref_key
  on public.bookings (booking_ref);

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
  select distinct on (public.normalize_email(b.booking_contact_email))
    public.normalize_email(b.booking_contact_email) as email_normalized,
    b.booking_contact_email as email,
    b.booking_contact_name as name,
    b.booking_contact_phone as phone,
    coalesce(b.created_at, now()) as created_at
  from public.bookings b
  where public.normalize_email(b.booking_contact_email) is not null
  order by public.normalize_email(b.booking_contact_email), b.created_at asc nulls last
)
insert into public.customers (
  email,
  normalized_email,
  name,
  phone,
  portal_status,
  created_at,
  updated_at
)
select
  contact.email,
  contact.email_normalized,
  contact.name,
  contact.phone,
  'invited',
  contact.created_at,
  now()
from booking_contacts contact
left join public.customers customer
  on customer.normalized_email = contact.email_normalized
where customer.id is null;

update public.bookings booking
set customer_id = customer.id
from public.customers customer
where booking.customer_id is null
  and customer.normalized_email is not null
  and customer.normalized_email = public.normalize_email(coalesce(booking.booking_contact_email, booking.customer_email));

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
