do $$
begin
  if to_regclass('public.bookings') is not null then
    alter table public.bookings
      add column if not exists customer_phone text;
  end if;

  if to_regclass('public.customers') is not null then
    alter table public.customers
      add column if not exists phone text;
  end if;
end
$$;
