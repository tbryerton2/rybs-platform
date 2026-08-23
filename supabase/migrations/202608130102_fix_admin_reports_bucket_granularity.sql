create or replace function public.get_admin_reports_business_metrics(
  p_business_id uuid,
  p_current_start_at timestamptz,
  p_current_end_at timestamptz,
  p_previous_start_at timestamptz default null,
  p_previous_end_at timestamptz default null,
  p_product_filter text default 'all',
  p_bucket_granularity text default 'daily',
  p_time_zone text default 'America/New_York'
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_bucket_granularity text := coalesce(nullif(trim(p_bucket_granularity), ''), 'daily');
  v_bucket_pg_unit text;
  v_bucket_interval interval;
begin
  case v_bucket_granularity
    when 'daily' then
      v_bucket_pg_unit := 'day';
      v_bucket_interval := interval '1 day';
    when 'weekly' then
      v_bucket_pg_unit := 'week';
      v_bucket_interval := interval '1 week';
    when 'monthly' then
      v_bucket_pg_unit := 'month';
      v_bucket_interval := interval '1 month';
    else
      raise exception 'Unsupported admin reports bucket granularity: %. Expected daily, weekly, or monthly.', v_bucket_granularity
        using errcode = '22023';
  end case;

  return (
    with params as (
      select
        p_business_id as business_id,
        p_current_start_at as current_start_at,
        p_current_end_at as current_end_at,
        p_previous_start_at as previous_start_at,
        p_previous_end_at as previous_end_at,
        coalesce(nullif(trim(p_product_filter), ''), 'all') as product_filter,
        v_bucket_granularity as bucket_granularity,
        v_bucket_pg_unit as bucket_pg_unit,
        v_bucket_interval as bucket_interval,
        coalesce(nullif(trim(p_time_zone), ''), 'America/New_York') as time_zone
    ),
    current_bookings as (
      select b.*
      from public.bookings b
      cross join params p
      where b.business_id = p.business_id
        and b.status in ('confirmed', 'delivered', 'picked_up')
        and b.created_at < p.current_end_at
        and (p.current_start_at is null or b.created_at >= p.current_start_at)
        and (
          p.product_filter = 'all'
          or (
            left(p.product_filter, 8) = 'product:'
            and b.dumpster_product_id = substring(p.product_filter from 9)
          )
          or (
            left(p.product_filter, 5) = 'size:'
            and nullif(b.dumpster_product_id, '') is null
            and b.dumpster_size = substring(p.product_filter from 6)
          )
          or (
            p.product_filter = 'unknown'
            and nullif(b.dumpster_product_id, '') is null
            and nullif(b.dumpster_size, '') is null
          )
        )
    ),
    previous_bookings as (
      select b.*
      from public.bookings b
      cross join params p
      where p.previous_start_at is not null
        and p.previous_end_at is not null
        and b.business_id = p.business_id
        and b.status in ('confirmed', 'delivered', 'picked_up')
        and b.created_at >= p.previous_start_at
        and b.created_at < p.previous_end_at
        and (
          p.product_filter = 'all'
          or (
            left(p.product_filter, 8) = 'product:'
            and b.dumpster_product_id = substring(p.product_filter from 9)
          )
          or (
            left(p.product_filter, 5) = 'size:'
            and nullif(b.dumpster_product_id, '') is null
            and b.dumpster_size = substring(p.product_filter from 6)
          )
          or (
            p.product_filter = 'unknown'
            and nullif(b.dumpster_product_id, '') is null
            and nullif(b.dumpster_size, '') is null
          )
        )
    ),
    customer_first_bookings as (
      select
        b.customer_id,
        min(b.created_at) as first_booking_at
      from public.bookings b
      cross join params p
      where b.business_id = p.business_id
        and b.customer_id is not null
        and b.status not in ('cancelled', 'draft')
      group by b.customer_id
    ),
    current_summary as (
      select
        coalesce(sum(coalesce(cb.total_price_cents, 0)), 0)::bigint as booked_revenue_cents,
        count(*)::integer as booking_volume,
        count(distinct cb.customer_id) filter (where cb.customer_id is not null)::integer as booked_customer_count,
        coalesce(sum(
          case
            when first_booking.first_booking_at < cb.created_at then 1
            else 0
          end
        ), 0)::integer as repeat_booking_count
      from current_bookings cb
      left join customer_first_bookings first_booking
        on first_booking.customer_id = cb.customer_id
    ),
    previous_summary as (
      select
        coalesce(sum(coalesce(pb.total_price_cents, 0)), 0)::bigint as booked_revenue_cents,
        count(*)::integer as booking_volume,
        count(distinct pb.customer_id) filter (where pb.customer_id is not null)::integer as booked_customer_count,
        coalesce(sum(
          case
            when first_booking.first_booking_at < pb.created_at then 1
            else 0
          end
        ), 0)::integer as repeat_booking_count
      from previous_bookings pb
      left join customer_first_bookings first_booking
        on first_booking.customer_id = pb.customer_id
    ),
    current_portal_customers as (
      select distinct cb.customer_id
      from current_bookings cb
      where cb.customer_id is not null
    ),
    previous_portal_customers as (
      select distinct pb.customer_id
      from previous_bookings pb
      where pb.customer_id is not null
    ),
    current_portal_summary as (
      select
        count(*)::integer as booked_customer_count,
        count(*) filter (
          where c.auth_user_id is not null
            or c.portal_status = 'active'
        )::integer as linked_customer_count
      from current_portal_customers cohort
      join public.customers c
        on c.id = cohort.customer_id
       and c.business_id = (select business_id from params)
    ),
    previous_portal_summary as (
      select
        count(*)::integer as booked_customer_count,
        count(*) filter (
          where c.auth_user_id is not null
            or c.portal_status = 'active'
        )::integer as linked_customer_count
      from previous_portal_customers cohort
      join public.customers c
        on c.id = cohort.customer_id
       and c.business_id = (select business_id from params)
    ),
    current_portal_requests as (
      select count(*)::integer as request_count
      from public.rental_action_requests request
      cross join params p
      left join public.bookings b
        on b.id = request.booking_id
       and b.business_id = request.business_id
      where request.business_id = p.business_id
        and request.submitted_at < p.current_end_at
        and (p.current_start_at is null or request.submitted_at >= p.current_start_at)
        and (
          p.product_filter = 'all'
          or (
            left(p.product_filter, 8) = 'product:'
            and b.dumpster_product_id = substring(p.product_filter from 9)
          )
          or (
            left(p.product_filter, 5) = 'size:'
            and nullif(b.dumpster_product_id, '') is null
            and b.dumpster_size = substring(p.product_filter from 6)
          )
          or (
            p.product_filter = 'unknown'
            and nullif(b.dumpster_product_id, '') is null
            and nullif(b.dumpster_size, '') is null
          )
        )
    ),
    previous_portal_requests as (
      select count(*)::integer as request_count
      from public.rental_action_requests request
      cross join params p
      left join public.bookings b
        on b.id = request.booking_id
       and b.business_id = request.business_id
      where p.previous_start_at is not null
        and p.previous_end_at is not null
        and request.business_id = p.business_id
        and request.submitted_at >= p.previous_start_at
        and request.submitted_at < p.previous_end_at
        and (
          p.product_filter = 'all'
          or (
            left(p.product_filter, 8) = 'product:'
            and b.dumpster_product_id = substring(p.product_filter from 9)
          )
          or (
            left(p.product_filter, 5) = 'size:'
            and nullif(b.dumpster_product_id, '') is null
            and b.dumpster_size = substring(p.product_filter from 6)
          )
          or (
            p.product_filter = 'unknown'
            and nullif(b.dumpster_product_id, '') is null
            and nullif(b.dumpster_size, '') is null
          )
        )
    ),
    trend_bounds as (
      select
        case
          when p.current_start_at is not null then
            date_trunc(p.bucket_pg_unit, p.current_start_at at time zone p.time_zone)
          else
            coalesce(
              (
                select date_trunc(p.bucket_pg_unit, min(b.created_at) at time zone p.time_zone)
                from current_bookings b
              ),
              date_trunc(p.bucket_pg_unit, (p.current_end_at - interval '1 day') at time zone p.time_zone)
            )
        end as start_bucket,
        date_trunc(p.bucket_pg_unit, (p.current_end_at - interval '1 microsecond') at time zone p.time_zone) as end_bucket,
        p.bucket_interval,
        p.bucket_granularity,
        p.bucket_pg_unit,
        p.time_zone
      from params p
    ),
    trend_series as (
      select generate_series(tb.start_bucket, tb.end_bucket, tb.bucket_interval)::timestamp as bucket_start
      from trend_bounds tb
    ),
    trend_aggregate as (
      select
        date_trunc(tb.bucket_pg_unit, cb.created_at at time zone tb.time_zone)::timestamp as bucket_start,
        coalesce(sum(coalesce(cb.total_price_cents, 0)), 0)::bigint as revenue_cents,
        count(*)::integer as bookings
      from current_bookings cb
      cross join trend_bounds tb
      group by 1
    ),
    trend_rows as (
      select
        ts.bucket_start,
        coalesce(ta.revenue_cents, 0)::bigint as revenue_cents,
        coalesce(ta.bookings, 0)::integer as bookings
      from trend_series ts
      left join trend_aggregate ta on ta.bucket_start = ts.bucket_start
      order by ts.bucket_start
    ),
    product_mix as (
      select
        case
          when nullif(cb.dumpster_product_id, '') is not null then 'product:' || cb.dumpster_product_id
          when nullif(cb.dumpster_size, '') is not null then 'size:' || cb.dumpster_size
          else 'unknown'
        end as value,
        coalesce(nullif(settings.display_name, ''), nullif(cb.dumpster_size, ''), 'Unknown dumpster type') as label,
        coalesce(sum(coalesce(cb.total_price_cents, 0)), 0)::bigint as revenue_cents,
        count(*)::integer as bookings
      from current_bookings cb
      left join public.dumpster_product_settings settings
        on settings.business_id = cb.business_id
       and settings.dumpster_product_id = cb.dumpster_product_id
      group by 1, 2
      order by revenue_cents desc, bookings desc, label asc
    ),
    current_product_options as (
      select
        'product:' || settings.dumpster_product_id as value,
        settings.display_name as label,
        settings.sort_order,
        0 as source_rank
      from public.dumpster_product_settings settings
      cross join params p
      where settings.business_id = p.business_id
        and nullif(settings.dumpster_product_id, '') is not null
    ),
    historical_product_options as (
      select distinct
        case
          when nullif(b.dumpster_product_id, '') is not null then 'product:' || b.dumpster_product_id
          when nullif(b.dumpster_size, '') is not null then 'size:' || b.dumpster_size
          else 'unknown'
        end as value,
        coalesce(nullif(settings.display_name, ''), nullif(b.dumpster_size, ''), 'Unknown dumpster type') as label,
        100000 as sort_order,
        1 as source_rank
      from public.bookings b
      cross join params p
      left join public.dumpster_product_settings settings
        on settings.business_id = b.business_id
       and settings.dumpster_product_id = b.dumpster_product_id
      where b.business_id = p.business_id
        and b.status in ('confirmed', 'delivered', 'picked_up')
    ),
    product_options as (
      select distinct on (value)
        value,
        label,
        sort_order,
        source_rank
      from (
        select * from current_product_options
        union all
        select * from historical_product_options
      ) options
      order by value, source_rank, sort_order, label
    )
    select jsonb_build_object(
      'summary', (select to_jsonb(current_summary) from current_summary),
      'previousSummary', (select to_jsonb(previous_summary) from previous_summary),
      'portalSummary', jsonb_build_object(
        'bookedCustomerCount', (select booked_customer_count from current_portal_summary),
        'linkedCustomerCount', (select linked_customer_count from current_portal_summary),
        'requestCount', (select request_count from current_portal_requests)
      ),
      'previousPortalSummary', jsonb_build_object(
        'bookedCustomerCount', (select booked_customer_count from previous_portal_summary),
        'linkedCustomerCount', (select linked_customer_count from previous_portal_summary),
        'requestCount', (select request_count from previous_portal_requests)
      ),
      'trends', coalesce((select jsonb_agg(to_jsonb(trend_rows)) from trend_rows), '[]'::jsonb),
      'productMix', coalesce((select jsonb_agg(to_jsonb(product_mix)) from product_mix), '[]'::jsonb),
      'productOptions', coalesce((select jsonb_agg(to_jsonb(product_options) order by sort_order, source_rank, label) from product_options), '[]'::jsonb)
    )
  );
end;
$$;

revoke all on function public.get_admin_reports_business_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) from public;

grant execute on function public.get_admin_reports_business_metrics(
  uuid,
  timestamptz,
  timestamptz,
  timestamptz,
  timestamptz,
  text,
  text,
  text
) to service_role;
