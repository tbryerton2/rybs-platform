-- Safe cleanup script for the specific failed external-payment test attempt.
-- Do not run until the SELECT result confirms the payment is still orphaned:
-- payment id: 0c28c1ca-2aba-4515-a1a2-bc0492938c10
-- charge id: cd91feb5-cd6e-4c33-9cd5-aad88edfec04
-- booking id: 524bc36c-597a-4662-a54c-0a9c10a37707

set search_path = public, extensions;

select
  p.id as payment_id,
  p.booking_id,
  p.booking_charge_id,
  p.provider,
  p.status as payment_status,
  p.amount_cents,
  p.payment_collection_type,
  p.external_payment_method,
  p.provider_payment_id,
  p.raw_provider_response,
  p.created_at as payment_created_at,
  c.status as charge_status,
  c.provider as charge_provider,
  c.provider_payment_id as charge_provider_payment_id,
  c.paid_at as charge_paid_at
from public.booking_payments p
join public.booking_charges c on c.id = p.booking_charge_id
where p.id = '0c28c1ca-2aba-4515-a1a2-bc0492938c10'
  and p.booking_id = '524bc36c-597a-4662-a54c-0a9c10a37707'
  and p.booking_charge_id = 'cd91feb5-cd6e-4c33-9cd5-aad88edfec04'
  and p.provider = 'external'
  and p.status = 'paid'
  and p.amount_cents = 298
  and p.provider_payment_id is null
  and p.raw_provider_response is null
  and c.status = 'draft'
  and c.paid_at is null;

-- If and only if the SELECT above returns exactly one row, this removes only
-- the orphaned test payment record and does not touch the booking or charge.
delete from public.booking_payments p
where p.id = '0c28c1ca-2aba-4515-a1a2-bc0492938c10'
  and p.booking_id = '524bc36c-597a-4662-a54c-0a9c10a37707'
  and p.booking_charge_id = 'cd91feb5-cd6e-4c33-9cd5-aad88edfec04'
  and p.provider = 'external'
  and p.status = 'paid'
  and p.amount_cents = 298
  and p.provider_payment_id is null
  and p.raw_provider_response is null
  and exists (
    select 1
    from public.booking_charges c
    where c.id = p.booking_charge_id
      and c.status = 'draft'
      and c.paid_at is null
  )
returning
  p.id,
  p.booking_id,
  p.booking_charge_id,
  p.amount_cents,
  p.created_at;
