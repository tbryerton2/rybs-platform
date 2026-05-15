alter table public.business_expenses
  add column if not exists is_recurring boolean not null default false,
  add column if not exists recurrence_frequency text;

alter table public.business_expenses
  drop constraint if exists business_expenses_recurrence_frequency_check;

alter table public.business_expenses
  add constraint business_expenses_recurrence_frequency_check
  check (
    (
      is_recurring = false
      and recurrence_frequency is null
    )
    or (
      is_recurring = true
      and recurrence_frequency in ('daily', 'weekly', 'monthly', 'annually')
    )
  );

create index if not exists business_expenses_business_id_is_recurring_idx
  on public.business_expenses (business_id, is_recurring);
