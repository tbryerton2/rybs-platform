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

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  auth_user_id uuid references auth.users (id) on delete set null,
  name text,
  email text,
  normalized_email text,
  phone text,
  primary_street text,
  primary_city text,
  primary_zip text,
  notes text,
  portal_status text not null default 'invited',
  last_login_at timestamptz
);

alter table public.customers
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null,
  add column if not exists name text,
  add column if not exists email text,
  add column if not exists normalized_email text,
  add column if not exists phone text,
  add column if not exists primary_street text,
  add column if not exists primary_city text,
  add column if not exists primary_zip text,
  add column if not exists notes text,
  add column if not exists portal_status text,
  add column if not exists last_login_at timestamptz;

update public.customers
set portal_status = 'invited'
where portal_status is null;

alter table public.customers
  alter column portal_status set default 'invited';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_portal_status_check'
  ) then
    alter table public.customers
      add constraint customers_portal_status_check
      check (portal_status in ('invited', 'active', 'disabled'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_contact_required'
  ) then
    alter table public.customers
      add constraint customers_contact_required
      check (normalized_email is not null or phone is not null);
  end if;
end
$$;

create or replace function public.sync_customer_normalized_email()
returns trigger
language plpgsql
as $$
begin
  new.normalized_email = public.normalize_email(new.email);
  return new;
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

  if not normalized_email_is_generated then
    update public.customers
    set normalized_email = public.normalize_email(email)
    where normalized_email is distinct from public.normalize_email(email);

    drop trigger if exists customers_sync_normalized_email on public.customers;
    create trigger customers_sync_normalized_email
    before insert or update of email on public.customers
    for each row execute function public.sync_customer_normalized_email();
  end if;
end
$$;

create unique index if not exists customers_normalized_email_key
  on public.customers (normalized_email)
  where normalized_email is not null;

create unique index if not exists customers_auth_user_id_key
  on public.customers (auth_user_id)
  where auth_user_id is not null;

create index if not exists customers_portal_status_idx
  on public.customers (portal_status);

drop trigger if exists customers_set_updated_at on public.customers;
create trigger customers_set_updated_at
before update on public.customers
for each row execute function public.set_updated_at();

create table if not exists public.customer_locations (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  label text not null,
  street text not null,
  city text not null,
  zip text not null,
  delivery_notes text,
  is_default boolean not null default false
);

alter table public.customer_locations
  add column if not exists customer_id uuid,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists label text,
  add column if not exists street text,
  add column if not exists city text,
  add column if not exists zip text,
  add column if not exists delivery_notes text,
  add column if not exists is_default boolean not null default false;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customer_locations'::regclass
      and conname = 'customer_locations_customer_id_fkey'
  ) then
    alter table public.customer_locations
      add constraint customer_locations_customer_id_fkey
      foreign key (customer_id) references public.customers (id) on delete cascade;
  end if;
end
$$;

create index if not exists customer_locations_customer_id_idx
  on public.customer_locations (customer_id);

create unique index if not exists customer_locations_default_per_customer_idx
  on public.customer_locations (customer_id)
  where is_default;

drop trigger if exists customer_locations_set_updated_at on public.customer_locations;
create trigger customer_locations_set_updated_at
before update on public.customer_locations
for each row execute function public.set_updated_at();

alter table public.bookings
  add column if not exists customer_id uuid references public.customers (id) on delete set null;

do $$
begin
  update public.bookings booking
  set customer_id = customer_match.id
  from public.customers customer_match
  where booking.customer_id is not null
    and not exists (
      select 1
      from public.customers existing_customer
      where existing_customer.id = booking.customer_id
    )
    and customer_match.normalized_email is not null
    and customer_match.normalized_email = public.normalize_email(coalesce(booking.customer_email, ''));

  update public.bookings booking
  set customer_id = null
  where booking.customer_id is not null
    and not exists (
      select 1
      from public.customers existing_customer
      where existing_customer.id = booking.customer_id
    );

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

create index if not exists bookings_customer_id_idx
  on public.bookings (customer_id);

create table if not exists public.rental_action_requests (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  action_type text not null
    check (action_type in ('pickup_request', 'extension_request', 'issue_report')),
  status text not null default 'submitted'
    check (status in ('submitted', 'under_review', 'approved', 'denied', 'completed')),
  customer_visible_status text not null default 'received'
    check (
      customer_visible_status in (
        'received',
        'under_review',
        'pickup_scheduled',
        'unable_to_confirm',
        'completed'
      )
    ),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  details_json jsonb not null default '{}'::jsonb,
  internal_notes text,
  customer_update text,
  reviewed_by text,
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rental_action_requests
  add column if not exists booking_id uuid,
  add column if not exists customer_id uuid,
  add column if not exists action_type text,
  add column if not exists status text not null default 'submitted',
  add column if not exists customer_visible_status text not null default 'received',
  add column if not exists priority text not null default 'normal',
  add column if not exists details_json jsonb not null default '{}'::jsonb,
  add column if not exists internal_notes text,
  add column if not exists customer_update text,
  add column if not exists reviewed_by text,
  add column if not exists submitted_at timestamptz not null default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists resolved_at timestamptz,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_booking_id_fkey'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_booking_id_fkey
      foreign key (booking_id) references public.bookings (id) on delete cascade;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_customer_id_fkey'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_customer_id_fkey
      foreign key (customer_id) references public.customers (id) on delete cascade;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_action_type_check'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_action_type_check
      check (action_type in ('pickup_request', 'extension_request', 'issue_report'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_status_check'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_status_check
      check (status in ('submitted', 'under_review', 'approved', 'denied', 'completed'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_customer_visible_status_check'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_customer_visible_status_check
      check (
        customer_visible_status in (
          'received',
          'under_review',
          'pickup_scheduled',
          'unable_to_confirm',
          'completed'
        )
      );
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.rental_action_requests'::regclass
      and conname = 'rental_action_requests_priority_check'
  ) then
    alter table public.rental_action_requests
      add constraint rental_action_requests_priority_check
      check (priority in ('low', 'normal', 'high', 'urgent'));
  end if;
end
$$;

create index if not exists rental_action_requests_booking_id_idx
  on public.rental_action_requests (booking_id);

create index if not exists rental_action_requests_customer_id_idx
  on public.rental_action_requests (customer_id);

create index if not exists rental_action_requests_status_idx
  on public.rental_action_requests (status);

create index if not exists rental_action_requests_action_type_idx
  on public.rental_action_requests (action_type);

create index if not exists rental_action_requests_submitted_at_idx
  on public.rental_action_requests (submitted_at desc);

create unique index if not exists rental_action_requests_open_pickup_per_booking_idx
  on public.rental_action_requests (booking_id, action_type)
  where action_type = 'pickup_request'
    and status in ('submitted', 'under_review', 'approved');

drop trigger if exists rental_action_requests_set_updated_at on public.rental_action_requests;
create trigger rental_action_requests_set_updated_at
before update on public.rental_action_requests
for each row execute function public.set_updated_at();

with ranked_booking_customer_matches as (
  select
    b.id as booking_id,
    c.id as customer_id,
    count(*) over (partition by b.id) as customer_match_count,
    row_number() over (
      partition by b.id
      order by c.created_at asc nulls last, c.id asc
    ) as match_rank
  from public.bookings b
  join public.customers c
    on c.normalized_email = public.normalize_email(b.customer_email)
  where b.customer_id is null
    and public.normalize_email(b.customer_email) is not null
    and c.normalized_email is not null
),
uniquely_matched_bookings as (
  select
    booking_id,
    customer_id,
    customer_match_count
  from ranked_booking_customer_matches
  where match_rank = 1
)
update public.bookings b
set customer_id = uniquely_matched_bookings.customer_id
from uniquely_matched_bookings
where b.id = uniquely_matched_bookings.booking_id
  and uniquely_matched_bookings.customer_match_count = 1;

alter table public.customers enable row level security;
alter table public.customer_locations enable row level security;
alter table public.rental_action_requests enable row level security;
