create table if not exists public.business_expenses (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  expense_date date not null,
  category text not null
    check (length(btrim(category)) > 0),
  vendor text not null
    check (length(btrim(vendor)) > 0),
  description text not null
    check (length(btrim(description)) > 0),
  amount_cents integer not null
    check (amount_cents > 0),
  status text not null default 'Paid'
    check (status in ('Paid', 'Scheduled', 'Outstanding')),
  payment_method text not null default 'Other'
    check (payment_method in ('Card', 'ACH', 'Check', 'Cash', 'Payroll run', 'Other')),
  asset_reference text,
  tax_deductible boolean not null default true,
  receipt_reference text,
  notes text,
  archived_at timestamptz,
  archived_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null
);

create index if not exists business_expenses_business_id_idx
  on public.business_expenses (business_id);

create index if not exists business_expenses_business_id_expense_date_idx
  on public.business_expenses (business_id, expense_date desc);

create index if not exists business_expenses_business_id_status_idx
  on public.business_expenses (business_id, status);

create index if not exists business_expenses_business_id_archived_at_idx
  on public.business_expenses (business_id, archived_at);

drop trigger if exists business_expenses_set_updated_at on public.business_expenses;
create trigger business_expenses_set_updated_at
before update on public.business_expenses
for each row execute function public.set_updated_at();

comment on table public.business_expenses is
  'Business-scoped operational expenses for admin use. Records can be soft-archived instead of deleted.';

alter table public.business_expenses enable row level security;

drop policy if exists "business expenses select by business" on public.business_expenses;
create policy "business expenses select by business"
on public.business_expenses
for select
to authenticated
using (business_id = public.current_business_id());

drop policy if exists "business expenses insert by business" on public.business_expenses;
create policy "business expenses insert by business"
on public.business_expenses
for insert
to authenticated
with check (business_id = public.current_business_id());

drop policy if exists "business expenses update by business" on public.business_expenses;
create policy "business expenses update by business"
on public.business_expenses
for update
to authenticated
using (business_id = public.current_business_id())
with check (business_id = public.current_business_id());

drop policy if exists "business expenses delete by business" on public.business_expenses;
create policy "business expenses delete by business"
on public.business_expenses
for delete
to authenticated
using (business_id = public.current_business_id());
