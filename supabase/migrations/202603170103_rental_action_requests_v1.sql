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

create index if not exists rental_action_requests_booking_id_idx
  on public.rental_action_requests (booking_id);

create index if not exists rental_action_requests_customer_id_idx
  on public.rental_action_requests (customer_id);

create index if not exists rental_action_requests_status_idx
  on public.rental_action_requests (status);

create index if not exists rental_action_requests_action_type_idx
  on public.rental_action_requests (action_type);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rental_action_requests'
      and column_name = 'submitted_at'
  ) then
    execute 'create index if not exists rental_action_requests_submitted_at_idx on public.rental_action_requests (submitted_at desc)';
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'rental_action_requests'
      and column_name = 'created_at'
  ) then
    execute 'create index if not exists rental_action_requests_created_at_idx on public.rental_action_requests (created_at desc)';
  end if;
end
$$;

create unique index if not exists rental_action_requests_open_pickup_per_booking_idx
  on public.rental_action_requests (booking_id, action_type)
  where action_type = 'pickup_request'
    and status in ('submitted', 'under_review', 'approved');

drop trigger if exists rental_action_requests_set_updated_at on public.rental_action_requests;
create trigger rental_action_requests_set_updated_at
before update on public.rental_action_requests
for each row execute function public.set_updated_at();

alter table public.rental_action_requests enable row level security;
