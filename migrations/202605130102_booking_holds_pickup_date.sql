alter table public.booking_holds
  add column if not exists pickup_date date;

create index if not exists booking_holds_pickup_date_idx
  on public.booking_holds (pickup_date);

with defaults as (
  select
    coalesce(
      (
        select ps.included_rental_days::integer
        from public.pricing_settings ps
        order by ps.created_at asc
        limit 1
      ),
      7
    ) as default_rental_days
)
update public.booking_holds hold
set pickup_date = hold.delivery_date + defaults.default_rental_days
from defaults
where hold.pickup_date is null
  and hold.delivery_date is not null
  and hold.status in ('active', 'converting');
