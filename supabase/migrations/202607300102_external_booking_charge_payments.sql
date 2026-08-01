alter table public.booking_payments
  drop constraint if exists booking_payments_provider_check;

alter table public.booking_payments
  add constraint booking_payments_provider_check
  check (provider in ('square', 'external'));

alter table public.booking_payments
  add column if not exists payment_collection_type text not null default 'square_checkout',
  add column if not exists external_payment_method text,
  add column if not exists external_reference text,
  add column if not exists external_notes text,
  add column if not exists external_recorded_by uuid references auth.users (id) on delete set null,
  add column if not exists external_recorded_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_payments'::regclass
      and conname = 'booking_payments_payment_collection_type_check'
  ) then
    alter table public.booking_payments
      add constraint booking_payments_payment_collection_type_check
      check (payment_collection_type in ('square_checkout', 'square_saved_card', 'external'));
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_payments'::regclass
      and conname = 'booking_payments_external_payment_method_check'
  ) then
    alter table public.booking_payments
      add constraint booking_payments_external_payment_method_check
      check (
        external_payment_method is null
        or external_payment_method in (
          'cash',
          'check',
          'square_invoice',
          'manually_processed_card',
          'other'
        )
      );
  end if;
end
$$;

create index if not exists booking_payments_payment_collection_type_idx
  on public.booking_payments (payment_collection_type);

create index if not exists booking_payments_external_recorded_by_idx
  on public.booking_payments (external_recorded_by);
