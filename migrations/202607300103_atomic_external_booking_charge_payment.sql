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
