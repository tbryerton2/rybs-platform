-- Supabase Dashboard SQL Editor script for hosted project:
-- https://cxuescemyrwunpipekjc.supabase.co
--
-- Execution order:
-- 1. Run the preflight block and review the result sets.
-- 2. Run the migration block.
-- 3. Run the verification queries at the bottom.
--
-- This script is additive/idempotent. It does not update existing booking,
-- charge, authorization, or payment records.

set search_path = public, extensions;

-- Preflight: confirm the active application schema is public and the
-- payment_exceptions foundation migration exists before applying hardening.
select current_schema() as active_schema;

select table_schema, table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('payment_exceptions', 'booking_payments')
order by table_name;

select version, name
from supabase_migrations.schema_migrations
where version in ('202607300101', '202607300102')
order by version;

do $$
begin
  if to_regclass('public.payment_exceptions') is null then
    raise exception 'public.payment_exceptions is missing. Apply 202606180101_square_webhooks_and_payment_exceptions.sql before 202607300101.';
  end if;

  if to_regclass('public.booking_payments') is null then
    raise exception 'public.booking_payments is missing. Apply 202605180101_booking_payments_foundation.sql before 202607300102.';
  end if;
end
$$;

-- Migration 202607300101_harden_card_on_file_payment_exceptions.sql
alter table public.payment_exceptions
  add column if not exists booking_id uuid references public.bookings (id) on delete set null,
  add column if not exists customer_id uuid references public.customers (id) on delete set null,
  add column if not exists failure_stage text,
  add column if not exists safe_error_code text,
  add column if not exists sanitized_error_message text,
  add column if not exists attempted_at timestamptz not null default now(),
  add column if not exists retryable boolean not null default false,
  add column if not exists correlation_id text;

create index if not exists payment_exceptions_booking_id_idx
  on public.payment_exceptions (booking_id);

create index if not exists payment_exceptions_customer_id_idx
  on public.payment_exceptions (customer_id);

create index if not exists payment_exceptions_failure_stage_idx
  on public.payment_exceptions (failure_stage);

create index if not exists payment_exceptions_safe_error_code_idx
  on public.payment_exceptions (safe_error_code);

create index if not exists payment_exceptions_correlation_id_idx
  on public.payment_exceptions (correlation_id);

-- Migration 202607300102_external_booking_charge_payments.sql
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

-- Migration 202607300103_atomic_external_booking_charge_payment.sql
create or replace function public.record_external_booking_charge_payment(
  p_business_id uuid,
  p_booking_id uuid,
  p_booking_charge_id uuid,
  p_operator_user_id uuid,
  p_external_payment_method text,
  p_amount_cents integer,
  p_payment_date date,
  p_reference text default null,
  p_notes text default null,
  p_provider_environment text default 'sandbox',
  p_recorded_at timestamptz default now()
)
returns table (
  booking_charge_id uuid,
  booking_payment_id uuid,
  paid_at timestamptz,
  recorded_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  charge_record public.booking_charges%rowtype;
  payment_id uuid;
  collected_at timestamptz;
begin
  if p_amount_cents is null or p_amount_cents <= 0 then
    raise exception 'External payment amount must be greater than $0.00.';
  end if;

  if p_external_payment_method not in (
    'cash',
    'check',
    'square_invoice',
    'manually_processed_card',
    'other'
  ) then
    raise exception 'Choose a valid external payment method.';
  end if;

  if p_provider_environment not in ('sandbox', 'production') then
    raise exception 'Choose a valid payment provider environment.';
  end if;

  select *
  into charge_record
  from public.booking_charges bc
  where bc.id = p_booking_charge_id
    and bc.booking_id = p_booking_id
    and bc.business_id = p_business_id
  for update;

  if not found then
    raise exception 'Charge was not found for this booking.';
  end if;

  if charge_record.status <> 'draft' then
    raise exception 'External payment can only be recorded for charges that still need approval.';
  end if;

  if exists (
    select 1
    from public.booking_payments bp
    where bp.business_id = p_business_id
      and bp.booking_id = p_booking_id
      and bp.booking_charge_id = p_booking_charge_id
      and bp.status = 'paid'
  ) then
    raise exception 'A paid payment is already recorded for this charge.';
  end if;

  collected_at := (p_payment_date::text || ' 12:00:00+00')::timestamptz;

  insert into public.booking_payments (
    business_id,
    booking_id,
    booking_charge_id,
    provider,
    provider_environment,
    status,
    amount_cents,
    currency,
    provider_payment_id,
    provider_order_id,
    provider_location_id,
    idempotency_key,
    payment_collection_type,
    external_payment_method,
    external_reference,
    external_notes,
    external_recorded_by,
    external_recorded_at,
    paid_at,
    raw_provider_response
  )
  values (
    p_business_id,
    p_booking_id,
    p_booking_charge_id,
    'external',
    p_provider_environment,
    'paid',
    p_amount_cents,
    coalesce(charge_record.currency, 'USD'),
    null,
    null,
    null,
    'external-charge-' || p_booking_charge_id::text,
    'external',
    p_external_payment_method,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_notes, '')), ''),
    p_operator_user_id,
    p_recorded_at,
    collected_at,
    null
  )
  returning id into payment_id;

  update public.booking_charges bc
  set
    status = 'paid',
    customer_payment_method_id = null,
    paid_at = collected_at,
    failed_at = null,
    customer_receipt_email_status = 'not_applicable',
    customer_receipt_email_error = 'External payment recorded by admin.'
  where bc.id = p_booking_charge_id
    and bc.booking_id = p_booking_id
    and bc.business_id = p_business_id
    and bc.status = 'draft';

  if not found then
    raise exception 'External payment can only be recorded for charges that still need approval.';
  end if;

  insert into public.entity_history (
    business_id,
    entity_type,
    entity_id,
    field_name,
    old_value,
    new_value,
    changed_by_type,
    changed_by_id,
    change_reason
  )
  values
    (
      p_business_id,
      'booking',
      p_booking_id,
      'external_charge_payment',
      null,
      jsonb_build_object(
        'bookingChargeId', p_booking_charge_id,
        'bookingPaymentId', payment_id,
        'externalPaymentMethod', p_external_payment_method,
        'amountCents', p_amount_cents,
        'paymentDate', p_payment_date,
        'reference', nullif(trim(coalesce(p_reference, '')), '')
      )::text,
      'admin',
      p_operator_user_id,
      'Recorded external payment for post-booking charge'
    ),
    (
      p_business_id,
      'booking',
      p_booking_id,
      'booking_charge_status',
      charge_record.status,
      'paid',
      'admin',
      p_operator_user_id,
      'External payment recorded'
    );

  booking_charge_id := p_booking_charge_id;
  booking_payment_id := payment_id;
  paid_at := collected_at;
  recorded_at := p_recorded_at;
  return next;
end;
$$;

-- Optional migration-history markers. Supabase Dashboard SQL Editor does not
-- automatically add these when SQL is pasted manually.
insert into supabase_migrations.schema_migrations (version, name, statements)
values
  ('202607300101', 'harden_card_on_file_payment_exceptions', array['manual dashboard application']),
  ('202607300102', 'external_booking_charge_payments', array['manual dashboard application']),
  ('202607300103', 'atomic_external_booking_charge_payment', array['manual dashboard application'])
on conflict (version) do nothing;

notify pgrst, 'reload schema';

-- Verification: columns
select table_name, column_name, data_type, is_nullable, column_default
from information_schema.columns
where table_schema = 'public'
  and (
    (table_name = 'payment_exceptions' and column_name in (
      'booking_id',
      'customer_id',
      'failure_stage',
      'safe_error_code',
      'sanitized_error_message',
      'attempted_at',
      'retryable',
      'correlation_id'
    ))
    or
    (table_name = 'booking_payments' and column_name in (
      'payment_collection_type',
      'external_payment_method',
      'external_reference',
      'external_notes',
      'external_recorded_by',
      'external_recorded_at'
    ))
  )
order by table_name, column_name;

-- Verification: constraints
select conrelid::regclass::text as table_name, conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid in (
    'public.payment_exceptions'::regclass,
    'public.booking_payments'::regclass,
    'public.booking_charges'::regclass
  )
  and conname in (
    'booking_charges_provider_check',
    'booking_payments_provider_check',
    'booking_payments_payment_collection_type_check',
    'booking_payments_external_payment_method_check'
  )
order by table_name, conname;

-- Verification: indexes
select schemaname, tablename, indexname, indexdef
from pg_indexes
where schemaname = 'public'
  and indexname in (
    'payment_exceptions_booking_id_idx',
    'payment_exceptions_customer_id_idx',
    'payment_exceptions_failure_stage_idx',
    'payment_exceptions_safe_error_code_idx',
    'payment_exceptions_correlation_id_idx',
    'booking_payments_payment_collection_type_idx',
    'booking_payments_external_recorded_by_idx'
  )
order by tablename, indexname;

-- Verification: RPC function
select n.nspname as schema_name, p.proname as function_name, pg_get_function_arguments(p.oid) as arguments
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'record_external_booking_charge_payment';
