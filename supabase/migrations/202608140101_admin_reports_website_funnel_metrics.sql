with target_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
)
insert into public.tenant_settings (tenant_id, category, key, value_json)
select
  target_tenant.id,
  'analytics',
  'website_funnel_tracking_started_at',
  to_jsonb('2026-08-14T17:37:00.000Z'::text)
from target_tenant
on conflict on constraint tenant_settings_tenant_category_key_unique
do update
  set value_json = excluded.value_json,
      updated_at = now();

create or replace function public.get_admin_reports_website_funnel_metrics(
  p_business_id uuid,
  p_current_start_at timestamptz,
  p_current_end_at timestamptz,
  p_previous_start_at timestamptz default null,
  p_previous_end_at timestamptz default null,
  p_product_filter text default 'all',
  p_device_filter text default 'all',
  p_visitor_filter text default 'all'
)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with tracking_setting as (
    select nullif(value_json #>> '{}', '')::timestamptz as tracking_started_at
    from public.tenant_settings
    where tenant_id = p_business_id
      and category = 'analytics'
      and key = 'website_funnel_tracking_started_at'
    limit 1
  ),
  params as (
    select
      p_business_id as business_id,
      p_current_start_at as requested_current_start_at,
      p_current_end_at as current_end_at,
      p_previous_start_at as requested_previous_start_at,
      p_previous_end_at as previous_end_at,
      coalesce((select tracking_started_at from tracking_setting), null) as tracking_started_at,
      case
        when coalesce(nullif(trim(p_product_filter), ''), 'all') = 'all' then 'all'
        when coalesce(nullif(trim(p_product_filter), ''), 'all') = 'unknown' then 'unknown'
        when left(coalesce(nullif(trim(p_product_filter), ''), 'all'), 8) = 'product:' then coalesce(nullif(trim(p_product_filter), ''), 'all')
        when left(coalesce(nullif(trim(p_product_filter), ''), 'all'), 5) = 'size:' then coalesce(nullif(trim(p_product_filter), ''), 'all')
        else 'all'
      end as product_filter,
      case
        when coalesce(nullif(trim(p_device_filter), ''), 'all') in ('all', 'desktop', 'mobile', 'tablet')
          then coalesce(nullif(trim(p_device_filter), ''), 'all')
        else 'all'
      end as device_filter,
      case
        when coalesce(nullif(trim(p_visitor_filter), ''), 'all') in ('all', 'new', 'returning')
          then coalesce(nullif(trim(p_visitor_filter), ''), 'all')
        else 'all'
      end as visitor_filter
  ),
  effective_params as (
    select
      *,
      case
        when requested_current_start_at is null then tracking_started_at
        when tracking_started_at is null then requested_current_start_at
        else greatest(requested_current_start_at, tracking_started_at)
      end as current_start_at,
      case
        when requested_previous_start_at is null then null
        when tracking_started_at is null then requested_previous_start_at
        else greatest(requested_previous_start_at, tracking_started_at)
      end as previous_start_at
    from params
  ),
  canonical_steps as (
    select *
    from (
      values
        (1, 'service_area', 'Service area'),
        (2, 'rental_options', 'Rental options'),
        (3, 'rental_timing', 'Rental timing'),
        (4, 'placement_details', 'Placement details'),
        (5, 'review', 'Review'),
        (6, 'checkout', 'Checkout'),
        (7, 'confirmation', 'Confirmation')
    ) as step(step_rank, step_key, step_label)
  ),
  current_sessions as (
    select s.*
    from public.analytics_booking_sessions s
    cross join effective_params p
    where s.business_id = p.business_id
      and s.started_at < p.current_end_at
      and (p.current_start_at is null or s.started_at >= p.current_start_at)
      and (
        p.device_filter = 'all'
        or (p.device_filter in ('desktop', 'mobile', 'tablet') and s.device_type = p.device_filter)
      )
      and (
        p.visitor_filter = 'all'
        or (p.visitor_filter in ('new', 'returning') and s.visitor_type = p.visitor_filter)
      )
      and (
        p.product_filter = 'all'
        or (
          left(p.product_filter, 8) = 'product:'
          and s.dumpster_product_id = substring(p.product_filter from 9)
        )
        or (
          left(p.product_filter, 5) = 'size:'
          and nullif(s.dumpster_product_id, '') is null
          and s.dumpster_size = substring(p.product_filter from 6)
        )
        or (
          p.product_filter = 'unknown'
          and nullif(s.dumpster_product_id, '') is null
          and nullif(s.dumpster_size, '') is null
        )
      )
  ),
  previous_sessions as (
    select s.*
    from public.analytics_booking_sessions s
    cross join effective_params p
    where p.previous_start_at is not null
      and p.previous_end_at is not null
      and s.business_id = p.business_id
      and s.started_at >= p.previous_start_at
      and s.started_at < p.previous_end_at
      and (
        p.device_filter = 'all'
        or (p.device_filter in ('desktop', 'mobile', 'tablet') and s.device_type = p.device_filter)
      )
      and (
        p.visitor_filter = 'all'
        or (p.visitor_filter in ('new', 'returning') and s.visitor_type = p.visitor_filter)
      )
      and (
        p.product_filter = 'all'
        or (
          left(p.product_filter, 8) = 'product:'
          and s.dumpster_product_id = substring(p.product_filter from 9)
        )
        or (
          left(p.product_filter, 5) = 'size:'
          and nullif(s.dumpster_product_id, '') is null
          and s.dumpster_size = substring(p.product_filter from 6)
        )
        or (
          p.product_filter = 'unknown'
          and nullif(s.dumpster_product_id, '') is null
          and nullif(s.dumpster_size, '') is null
        )
      )
  ),
  current_summary as (
    select
      count(*)::integer as sessions_started,
      count(*) filter (
        where completed_at is not null
          and booking_id is not null
      )::integer as completed_sessions,
      count(*) filter (
        where resumed_count > 0
          or first_resumed_at is not null
          or last_resumed_at is not null
      )::integer as resumed_sessions,
      coalesce(avg(extract(epoch from (completed_at - started_at))) filter (
        where completed_at is not null
          and booking_id is not null
          and completed_at >= started_at
      ), 0)::numeric as avg_completion_seconds
    from current_sessions
  ),
  previous_summary as (
    select
      count(*)::integer as sessions_started,
      count(*) filter (
        where completed_at is not null
          and booking_id is not null
      )::integer as completed_sessions,
      count(*) filter (
        where resumed_count > 0
          or first_resumed_at is not null
          or last_resumed_at is not null
      )::integer as resumed_sessions,
      coalesce(avg(extract(epoch from (completed_at - started_at))) filter (
        where completed_at is not null
          and booking_id is not null
          and completed_at >= started_at
      ), 0)::numeric as avg_completion_seconds
    from previous_sessions
  ),
  current_step_presence as (
    select distinct
      s.id as session_id,
      step.step_rank,
      step.step_key,
      step.step_label
    from current_sessions s
    join public.analytics_booking_events event
      on event.business_id = s.business_id
     and event.booking_session_id = s.id
     and event.visitor_id = s.visitor_id
     and event.event_name = 'booking_step_viewed'
    join canonical_steps step
      on step.step_key = event.step_key
  ),
  current_session_progress as (
    select
      s.id as session_id,
      coalesce(max(step.step_rank), 0) as furthest_step_rank,
      bool_or(s.completed_at is not null and s.booking_id is not null) as completed
    from current_sessions s
    left join current_step_presence step
      on step.session_id = s.id
    group by s.id
  ),
  step_rows as (
    select
      step.step_rank,
      step.step_key,
      step.step_label,
      count(distinct presence.session_id)::integer as sessions
    from canonical_steps step
    left join current_step_presence presence
      on presence.step_rank = step.step_rank
    group by step.step_rank, step.step_key, step.step_label
    order by step.step_rank
  ),
  transition_rows as (
    select
      source.step_rank as source_step_rank,
      source.step_key as source_step_key,
      source.step_label as source_step_label,
      next_step.step_key as next_step_key,
      next_step.step_label as next_step_label,
      count(distinct source_presence.session_id)::integer as reached_source,
      count(distinct source_presence.session_id) filter (
        where progress.completed
          or progress.furthest_step_rank > source.step_rank
      )::integer as progressed,
      count(distinct source_presence.session_id) filter (
        where not (
          progress.completed
          or progress.furthest_step_rank > source.step_rank
        )
      )::integer as lost
    from canonical_steps source
    join canonical_steps next_step
      on next_step.step_rank = source.step_rank + 1
    left join current_step_presence source_presence
      on source_presence.step_rank = source.step_rank
    left join current_session_progress progress
      on progress.session_id = source_presence.session_id
    where source.step_rank < 7
    group by
      source.step_rank,
      source.step_key,
      source.step_label,
      next_step.step_key,
      next_step.step_label
    order by source.step_rank
  ),
  biggest_dropoff as (
    select *
    from transition_rows
    where reached_source > 0
    order by lost desc, source_step_rank asc
    limit 1
  )
  select jsonb_build_object(
    'trackingStartedAt', (select tracking_started_at from effective_params),
    'effectiveCurrentStartAt', (select current_start_at from effective_params),
    'effectivePreviousStartAt', (select previous_start_at from effective_params),
    'summary', (select to_jsonb(current_summary) from current_summary),
    'previousSummary', (select to_jsonb(previous_summary) from previous_summary),
    'stepRows', coalesce((select jsonb_agg(to_jsonb(step_rows) order by step_rank) from step_rows), '[]'::jsonb),
    'transitionRows', coalesce((select jsonb_agg(to_jsonb(transition_rows) order by source_step_rank) from transition_rows), '[]'::jsonb),
    'biggestDropoff', coalesce((select to_jsonb(biggest_dropoff) from biggest_dropoff), '{}'::jsonb)
  );
$$;

revoke all on function public.get_admin_reports_website_funnel_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) from public;

grant execute on function public.get_admin_reports_website_funnel_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) to service_role;
