create extension if not exists pgcrypto;

create table if not exists public.analytics_visitors (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  visitor_token text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analytics_visitors_business_visitor_token_unique
    unique (business_id, visitor_token)
);

create table if not exists public.analytics_booking_sessions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  visitor_id uuid not null references public.analytics_visitors (id) on delete cascade,
  session_token text not null,
  started_at timestamptz not null default now(),
  last_event_at timestamptz not null default now(),
  completed_at timestamptz,
  booking_id uuid references public.bookings (id) on delete set null,
  booking_hold_id uuid references public.booking_holds (id) on delete set null,
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  visitor_type text not null default 'new'
    check (visitor_type in ('new', 'returning')),
  resumed_count integer not null default 0 check (resumed_count >= 0),
  first_resumed_at timestamptz,
  last_resumed_at timestamptz,
  dumpster_product_id text,
  dumpster_size text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint analytics_booking_sessions_business_session_token_unique
    unique (business_id, session_token)
);

create table if not exists public.analytics_booking_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  visitor_id uuid not null references public.analytics_visitors (id) on delete cascade,
  booking_session_id uuid not null references public.analytics_booking_sessions (id) on delete cascade,
  event_name text not null
    check (event_name in ('booking_started', 'booking_step_viewed', 'booking_resumed', 'booking_completed')),
  step_key text
    check (
      step_key is null
      or step_key in (
        'service_area',
        'rental_options',
        'rental_timing',
        'placement_details',
        'review',
        'checkout',
        'confirmation'
      )
    ),
  occurred_at timestamptz not null default now(),
  device_type text not null default 'unknown'
    check (device_type in ('desktop', 'mobile', 'tablet', 'unknown')),
  visitor_type text not null default 'new'
    check (visitor_type in ('new', 'returning')),
  booking_hold_id uuid references public.booking_holds (id) on delete set null,
  booking_id uuid references public.bookings (id) on delete set null,
  dumpster_product_id text,
  dumpster_size text,
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_visitors_business_first_seen_at_idx
  on public.analytics_visitors (business_id, first_seen_at);

create index if not exists analytics_visitors_business_last_seen_at_idx
  on public.analytics_visitors (business_id, last_seen_at);

create index if not exists analytics_booking_sessions_business_started_at_idx
  on public.analytics_booking_sessions (business_id, started_at);

create index if not exists analytics_booking_sessions_business_last_event_at_idx
  on public.analytics_booking_sessions (business_id, last_event_at);

create index if not exists analytics_booking_sessions_business_completed_at_idx
  on public.analytics_booking_sessions (business_id, completed_at)
  where completed_at is not null;

create index if not exists analytics_booking_sessions_business_filters_idx
  on public.analytics_booking_sessions (business_id, device_type, visitor_type, started_at);

create index if not exists analytics_booking_sessions_business_product_idx
  on public.analytics_booking_sessions (business_id, dumpster_product_id, dumpster_size, started_at);

create unique index if not exists analytics_booking_sessions_business_booking_unique_idx
  on public.analytics_booking_sessions (business_id, booking_id)
  where booking_id is not null;

create index if not exists analytics_booking_events_business_occurred_at_idx
  on public.analytics_booking_events (business_id, occurred_at);

create index if not exists analytics_booking_events_business_event_occurred_at_idx
  on public.analytics_booking_events (business_id, event_name, occurred_at);

create index if not exists analytics_booking_events_business_step_occurred_at_idx
  on public.analytics_booking_events (business_id, step_key, occurred_at)
  where step_key is not null;

create index if not exists analytics_booking_events_business_session_occurred_at_idx
  on public.analytics_booking_events (business_id, booking_session_id, occurred_at);

create unique index if not exists analytics_booking_events_business_idempotency_unique_idx
  on public.analytics_booking_events (business_id, idempotency_key)
  where idempotency_key is not null;

create unique index if not exists analytics_booking_events_session_started_unique_idx
  on public.analytics_booking_events (business_id, booking_session_id)
  where event_name = 'booking_started';

create unique index if not exists analytics_booking_events_session_completed_unique_idx
  on public.analytics_booking_events (business_id, booking_session_id)
  where event_name = 'booking_completed';

drop trigger if exists analytics_visitors_set_updated_at on public.analytics_visitors;
create trigger analytics_visitors_set_updated_at
before update on public.analytics_visitors
for each row execute function public.set_updated_at();

drop trigger if exists analytics_booking_sessions_set_updated_at on public.analytics_booking_sessions;
create trigger analytics_booking_sessions_set_updated_at
before update on public.analytics_booking_sessions
for each row execute function public.set_updated_at();

alter table public.analytics_visitors enable row level security;
alter table public.analytics_booking_sessions enable row level security;
alter table public.analytics_booking_events enable row level security;

revoke all on table public.analytics_visitors from anon;
revoke all on table public.analytics_visitors from authenticated;
revoke all on table public.analytics_booking_sessions from anon;
revoke all on table public.analytics_booking_sessions from authenticated;
revoke all on table public.analytics_booking_events from anon;
revoke all on table public.analytics_booking_events from authenticated;

grant all on table public.analytics_visitors to service_role;
grant all on table public.analytics_booking_sessions to service_role;
grant all on table public.analytics_booking_events to service_role;

comment on table public.analytics_visitors is
  'First-party opaque visitor records for public booking funnel analytics. Scoped by business_id.';

comment on table public.analytics_booking_sessions is
  'One booking attempt per tenant-scoped visitor/session token. Used for conversion, resume, device, and visitor-type reporting.';

comment on table public.analytics_booking_events is
  'Allowlisted server-ingested booking funnel events. Contains no PII, IP address, or raw user agent.';
