create table if not exists public.booking_charge_disputes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  booking_id uuid not null references public.bookings (id) on delete cascade,
  booking_charge_id uuid not null references public.booking_charges (id) on delete cascade,
  customer_id uuid not null references public.customers (id) on delete cascade,
  status text not null default 'open'
    check (status in ('open', 'resolved')),
  customer_explanation text not null
    check (length(btrim(customer_explanation)) >= 10),
  resolution_notes text,
  submitted_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_charge_disputes_resolution_check
    check (
      (status = 'open' and resolved_at is null)
      or
      (status = 'resolved' and resolved_at is not null and length(btrim(coalesce(resolution_notes, ''))) > 0)
    )
);

comment on table public.booking_charge_disputes is
  'Customer-submitted disputes for paid post-booking charges. Disputes record a review workflow only and do not automatically refund, void, or reverse payments.';

comment on column public.booking_charge_disputes.business_id is
  'Tenant/business that owns the booking, charge, customer, and dispute.';

comment on column public.booking_charge_disputes.booking_charge_id is
  'Paid booking_charges row being disputed. Initial booking payments are intentionally outside this workflow.';

create index if not exists booking_charge_disputes_business_id_idx
  on public.booking_charge_disputes (business_id);

create index if not exists booking_charge_disputes_booking_id_idx
  on public.booking_charge_disputes (booking_id);

create index if not exists booking_charge_disputes_booking_charge_id_idx
  on public.booking_charge_disputes (booking_charge_id);

create index if not exists booking_charge_disputes_customer_id_idx
  on public.booking_charge_disputes (customer_id);

create index if not exists booking_charge_disputes_status_idx
  on public.booking_charge_disputes (status);

create index if not exists booking_charge_disputes_submitted_at_idx
  on public.booking_charge_disputes (submitted_at desc);

create unique index if not exists booking_charge_disputes_one_open_per_charge_idx
  on public.booking_charge_disputes (business_id, booking_charge_id)
  where status = 'open';

drop trigger if exists booking_charge_disputes_set_updated_at on public.booking_charge_disputes;
create trigger booking_charge_disputes_set_updated_at
before update on public.booking_charge_disputes
for each row execute function public.set_updated_at();

alter table public.booking_charge_disputes enable row level security;

revoke all on table public.booking_charge_disputes from public;
revoke all on table public.booking_charge_disputes from anon;
revoke all on table public.booking_charge_disputes from authenticated;
grant all on table public.booking_charge_disputes to service_role;
