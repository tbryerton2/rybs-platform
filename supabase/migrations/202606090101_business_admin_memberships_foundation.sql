create extension if not exists pgcrypto;

create table if not exists public.business_admin_memberships (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'owner',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint business_admin_memberships_business_auth_user_unique
    unique (business_id, auth_user_id),
  constraint business_admin_memberships_role_check
    check (role in ('owner')),
  constraint business_admin_memberships_status_check
    check (status in ('active', 'disabled'))
);

comment on table public.business_admin_memberships is
  'Owner-only admin access memberships scoped to a business. This is intentionally separate from business_employees: employee records are operational/HR data, while this table controls admin authentication and access.';

comment on column public.business_admin_memberships.business_id is
  'References tenants.id, which is treated as the business id for admin access.';

comment on column public.business_admin_memberships.auth_user_id is
  'Supabase Auth user granted admin access for the referenced business.';

comment on column public.business_admin_memberships.role is
  'Admin access role. Phase 1 allows only owner; employee roles and custom permissions are intentionally out of scope.';

create index if not exists business_admin_memberships_business_id_idx
  on public.business_admin_memberships (business_id);

create index if not exists business_admin_memberships_auth_user_id_idx
  on public.business_admin_memberships (auth_user_id);

create index if not exists business_admin_memberships_status_idx
  on public.business_admin_memberships (status);

create index if not exists business_admin_memberships_business_id_auth_user_id_idx
  on public.business_admin_memberships (business_id, auth_user_id);

drop trigger if exists business_admin_memberships_set_updated_at on public.business_admin_memberships;
create trigger business_admin_memberships_set_updated_at
before update on public.business_admin_memberships
for each row execute function public.set_updated_at();

-- Bootstrap note for the first Tan Can Man owner after the Supabase Auth user exists.
-- Find the business id:
-- select id from public.tenants where slug = 'tan-can-man';
-- Find the auth user id:
-- select id, email from auth.users where email = '<owner-email>';
-- Create the owner membership:
-- insert into public.business_admin_memberships (business_id, auth_user_id, role, status)
-- select id, '<auth-user-uuid>'::uuid, 'owner', 'active'
-- from public.tenants
-- where slug = 'tan-can-man';
