create extension if not exists pgcrypto;

create table if not exists public.booking_holds (
  id uuid primary key default gen_random_uuid(),
  delivery_date date not null,
  expires_at timestamptz not null,
  status text not null default 'active'
    check (status in ('active', 'expired', 'converting', 'converted', 'cancelled')),
  client_id text not null,
  zip text,
  created_at timestamptz not null default now()
);

create index if not exists booking_holds_client_id_idx
  on public.booking_holds (client_id);

create index if not exists booking_holds_delivery_date_idx
  on public.booking_holds (delivery_date);

create index if not exists booking_holds_status_idx
  on public.booking_holds (status);

create index if not exists booking_holds_expires_at_idx
  on public.booking_holds (expires_at);

create or replace function public.expire_active_holds_for_client(p_client_id text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  expired_count integer;
begin
  update public.booking_holds
  set status = 'expired'
  where client_id = p_client_id
    and status = 'active';

  get diagnostics expired_count = row_count;
  return expired_count;
end;
$$;

create or replace function public.get_delivery_availability(
  p_delivery_date date,
  p_days integer default null
)
returns table (
  capacity integer,
  used integer,
  remaining integer
)
language sql
security definer
set search_path = public
as $$
  with settings as (
    select
      3::integer as fleet_capacity,
      coalesce(
        (
          select ps.included_rental_days::integer
          from public.pricing_settings ps
          order by ps.created_at asc
          limit 1
        ),
        7
      ) as default_rental_days
  ),
  candidate_window as (
    select generate_series(
      p_delivery_date,
      p_delivery_date + greatest(coalesce(p_days, settings.default_rental_days), 1),
      interval '1 day'
    )::date as day
    from settings
  ),
  booking_usage as (
    select
      candidate.day,
      count(*)::integer as used
    from candidate_window candidate
    join settings on true
    join public.bookings booking
      on booking.delivery_date is not null
     and booking.delivery_date <= candidate.day
     and lower(coalesce(booking.status, '')) in ('confirmed', 'scheduled', 'delivered')
     and (
       coalesce(
         booking.pickup_date,
         booking.delivery_date + coalesce(booking.included_rental_days, settings.default_rental_days)
       ) >= candidate.day
     )
    group by candidate.day
  ),
  hold_usage as (
    select
      candidate.day,
      count(*)::integer as used
    from candidate_window candidate
    join public.booking_holds hold
      on hold.delivery_date = candidate.day
     and hold.status in ('active', 'converting')
     and hold.expires_at > now()
    group by candidate.day
  ),
  daily_usage as (
    select
      candidate.day,
      coalesce(booking_usage.used, 0) + coalesce(hold_usage.used, 0) as used
    from candidate_window candidate
    left join booking_usage on booking_usage.day = candidate.day
    left join hold_usage on hold_usage.day = candidate.day
  )
  select
    max(settings.fleet_capacity)::integer as capacity,
    coalesce(max(daily_usage.used), 0)::integer as used,
    greatest(max(settings.fleet_capacity) - coalesce(max(daily_usage.used), 0), 0)::integer as remaining
  from settings
  left join daily_usage on true;
$$;

create or replace function public.next_tight_date(start_date date)
returns date
language sql
security definer
set search_path = public
as $$
  with settings as (
    select coalesce(
      (
        select ps.included_rental_days::integer
        from public.pricing_settings ps
        order by ps.created_at asc
        limit 1
      ),
      7
    ) as default_rental_days
  ),
  candidate_dates as (
    select generate_series(
      start_date,
      start_date + 30,
      interval '1 day'
    )::date as candidate_date
  ),
  availability as (
    select
      candidate_dates.candidate_date,
      (
        select availability.remaining
        from public.get_delivery_availability(
          candidate_dates.candidate_date,
          settings.default_rental_days
        ) as availability
        limit 1
      ) as remaining
    from candidate_dates
    cross join settings
  )
  select availability.candidate_date
  from availability
  where coalesce(availability.remaining, 0) <= 0
  order by availability.candidate_date asc
  limit 1;
$$;
