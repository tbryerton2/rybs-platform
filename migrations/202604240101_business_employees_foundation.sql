create extension if not exists pgcrypto;

create or replace function public.current_business_id()
returns uuid
language sql
stable
as $$
  select nullif(
    coalesce(
      auth.jwt() ->> 'business_id',
      auth.jwt() ->> 'tenant_id',
      auth.jwt() -> 'app_metadata' ->> 'business_id',
      auth.jwt() -> 'app_metadata' ->> 'tenant_id'
    ),
    ''
  )::uuid
$$;

create or replace function public.sync_business_employee_derived_fields()
returns trigger
language plpgsql
as $$
begin
  new.full_name := nullif(btrim(concat_ws(' ', new.first_name, new.last_name)), '');
  new.normalized_email := public.normalize_email(new.email);
  return new;
end;
$$;

create table if not exists public.business_employees (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  employee_code text,
  first_name text not null
    check (length(btrim(first_name)) > 0),
  last_name text not null
    check (length(btrim(last_name)) > 0),
  full_name text,
  email text,
  normalized_email text,
  phone text,
  second_phone text,
  preferred_contact_method text not null default 'phone'
    check (preferred_contact_method in ('phone', 'text', 'email')),
  street_address text,
  city text,
  state text
    check (state is null or state ~ '^[A-Z]{2}$'),
  postal_code text
    check (postal_code is null or postal_code ~ '^[0-9]{5}$'),
  date_of_birth date,
  hire_date date,
  emergency_contact_name text,
  emergency_contact_phone text,
  job_title text,
  role_key text,
  status text not null default 'active'
    check (status in ('active', 'inactive', 'invited')),
  is_active boolean generated always as (status = 'active') stored,
  deactivated_at timestamptz,
  deactivation_reason text,
  notes text,
  linked_user_id uuid references auth.users (id) on delete set null,
  license_number text,
  license_state text
    check (license_state is null or license_state ~ '^[A-Z]{2}$'),
  license_class text,
  license_expiration date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  updated_by uuid references auth.users (id) on delete set null,
  constraint business_employees_deactivation_status_check
    check (
      (status = 'inactive' and deactivated_at is not null)
      or (status <> 'inactive' and deactivated_at is null and deactivation_reason is null)
    ),
  constraint business_employees_employee_code_format_check
    check (employee_code is null or employee_code ~ '^[A-Z0-9]+(?:-[A-Z0-9]+)*$')
);

create index if not exists business_employees_business_id_idx
  on public.business_employees (business_id);

create index if not exists business_employees_business_id_status_idx
  on public.business_employees (business_id, status);

create index if not exists business_employees_business_id_is_active_idx
  on public.business_employees (business_id, is_active);

create index if not exists business_employees_linked_user_id_idx
  on public.business_employees (linked_user_id);

create unique index if not exists business_employees_business_id_employee_code_key
  on public.business_employees (business_id, employee_code)
  where employee_code is not null;

create unique index if not exists business_employees_business_id_normalized_email_key
  on public.business_employees (business_id, normalized_email)
  where normalized_email is not null;

drop trigger if exists business_employees_set_updated_at on public.business_employees;
create trigger business_employees_set_updated_at
before update on public.business_employees
for each row execute function public.set_updated_at();

drop trigger if exists business_employees_sync_derived_fields on public.business_employees;
create trigger business_employees_sync_derived_fields
before insert or update of first_name, last_name, email on public.business_employees
for each row execute function public.sync_business_employee_derived_fields();

comment on table public.business_employees is
  'Business-scoped employee records for operations/admin use. Records are soft-deactivated rather than deleted and can link to auth users later.';

comment on column public.business_employees.linked_user_id is
  'Optional future link to an auth user account. Employee records exist independently from login access.';

alter table public.business_employees enable row level security;

drop policy if exists "business employees select by business" on public.business_employees;
create policy "business employees select by business"
on public.business_employees
for select
to authenticated
using (business_id = public.current_business_id());

drop policy if exists "business employees insert by business" on public.business_employees;
create policy "business employees insert by business"
on public.business_employees
for insert
to authenticated
with check (business_id = public.current_business_id());

drop policy if exists "business employees update by business" on public.business_employees;
create policy "business employees update by business"
on public.business_employees
for update
to authenticated
using (business_id = public.current_business_id())
with check (business_id = public.current_business_id());

drop policy if exists "business employees delete by business" on public.business_employees;
create policy "business employees delete by business"
on public.business_employees
for delete
to authenticated
using (business_id = public.current_business_id());
