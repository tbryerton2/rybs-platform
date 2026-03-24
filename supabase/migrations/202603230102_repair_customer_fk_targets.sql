do $$
begin
  if to_regclass('public.customer_locations') is not null then
    if exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.customer_locations'::regclass
        and c.conname = 'customer_locations_customer_id_fkey'
    ) then
      alter table public.customer_locations
        drop constraint customer_locations_customer_id_fkey;
    end if;

    alter table public.customer_locations
      add constraint customer_locations_customer_id_fkey
      foreign key (customer_id) references public.customers (id) on delete cascade;
  end if;

  if to_regclass('public.bookings') is not null then
    if exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.bookings'::regclass
        and c.conname = 'bookings_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers_legacy_derived'
    ) then
      alter table public.bookings
        drop constraint bookings_customer_id_fkey;
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.bookings'::regclass
        and c.conname = 'bookings_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers'
    ) then
      alter table public.bookings
        add constraint bookings_customer_id_fkey
        foreign key (customer_id) references public.customers (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.booking_requests') is not null then
    if exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.booking_requests'::regclass
        and c.conname = 'booking_requests_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers_legacy_derived'
    ) then
      alter table public.booking_requests
        drop constraint booking_requests_customer_id_fkey;
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.booking_requests'::regclass
        and c.conname = 'booking_requests_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers'
    ) then
      alter table public.booking_requests
        add constraint booking_requests_customer_id_fkey
        foreign key (customer_id) references public.customers (id) on delete set null;
    end if;
  end if;

  if to_regclass('public.rental_action_requests') is not null then
    if exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.rental_action_requests'::regclass
        and c.conname = 'rental_action_requests_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers_legacy_derived'
    ) then
      alter table public.rental_action_requests
        drop constraint rental_action_requests_customer_id_fkey;
    end if;

    if not exists (
      select 1
      from pg_constraint c
      join pg_class ref on ref.oid = c.confrelid
      join pg_namespace ref_ns on ref_ns.oid = ref.relnamespace
      where c.conrelid = 'public.rental_action_requests'::regclass
        and c.conname = 'rental_action_requests_customer_id_fkey'
        and ref_ns.nspname = 'public'
        and ref.relname = 'customers'
    ) then
      alter table public.rental_action_requests
        add constraint rental_action_requests_customer_id_fkey
        foreign key (customer_id) references public.customers (id) on delete cascade;
    end if;
  end if;
end
$$;
