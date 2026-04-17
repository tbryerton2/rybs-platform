alter table public.pricing_settings
  add column if not exists max_rental_days integer,
  add column if not exists allow_extended_rental_at_booking boolean;

update public.pricing_settings
set allow_extended_rental_at_booking = false
where allow_extended_rental_at_booking is null;

alter table public.pricing_settings
  alter column allow_extended_rental_at_booking set default false;

alter table public.pricing_settings
  alter column allow_extended_rental_at_booking set not null;

update public.pricing_settings
set scheduled_pickup_price = standard_rental_price
where scheduled_pickup_price is distinct from standard_rental_price;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_standard_rental_price_nonnegative'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_standard_rental_price_nonnegative
      check (standard_rental_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_included_rental_days_min'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_included_rental_days_min
      check (included_rental_days >= 1);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_daily_overage_price_nonnegative'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_daily_overage_price_nonnegative
      check (daily_overage_price >= 0);
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'pricing_settings_max_rental_days_valid'
  ) then
    alter table public.pricing_settings
      add constraint pricing_settings_max_rental_days_valid
      check (
        max_rental_days is null
        or max_rental_days >= included_rental_days
      );
  end if;
end
$$;
