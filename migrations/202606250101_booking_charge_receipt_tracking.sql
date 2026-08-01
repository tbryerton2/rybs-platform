alter table public.booking_charges
  add column if not exists customer_receipt_email_status text
    check (
      customer_receipt_email_status is null
      or customer_receipt_email_status in ('not_applicable', 'queued', 'sent', 'failed')
    ),
  add column if not exists customer_receipt_email_to text,
  add column if not exists customer_receipt_email_message_id uuid,
  add column if not exists customer_receipt_email_sent_at timestamptz,
  add column if not exists customer_receipt_email_failed_at timestamptz,
  add column if not exists customer_receipt_email_error text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.booking_charges'::regclass
      and conname = 'booking_charges_customer_receipt_email_message_id_fkey'
  ) then
    alter table public.booking_charges
      add constraint booking_charges_customer_receipt_email_message_id_fkey
      foreign key (customer_receipt_email_message_id)
      references public.booking_messages (id)
      on delete set null;
  end if;
end
$$;

create index if not exists booking_charges_customer_receipt_email_status_idx
  on public.booking_charges (customer_receipt_email_status);

create index if not exists booking_charges_customer_receipt_email_message_id_idx
  on public.booking_charges (customer_receipt_email_message_id);
