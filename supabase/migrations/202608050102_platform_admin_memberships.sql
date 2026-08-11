create extension if not exists pgcrypto;

create table if not exists public.platform_admin_memberships (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'admin',
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint platform_admin_memberships_auth_user_id_key
    unique (auth_user_id),
  constraint platform_admin_memberships_role_check
    check (role in ('owner', 'admin')),
  constraint platform_admin_memberships_status_check
    check (status in ('active', 'disabled'))
);

comment on table public.platform_admin_memberships is
  'Global platform-owner/admin access memberships. This table is intentionally not tenant-scoped and is checked only by server-side platform-admin authorization.';

comment on column public.platform_admin_memberships.auth_user_id is
  'Supabase Auth user granted platform-admin access.';

comment on column public.platform_admin_memberships.role is
  'Global platform role. Phase 1 supports owner and admin only.';

comment on column public.platform_admin_memberships.status is
  'Membership lifecycle status. Disabled memberships are rejected by platform-admin authorization.';

drop trigger if exists platform_admin_memberships_set_updated_at on public.platform_admin_memberships;
create trigger platform_admin_memberships_set_updated_at
before update on public.platform_admin_memberships
for each row execute function public.set_updated_at();

alter table public.platform_admin_memberships enable row level security;

revoke all on table public.platform_admin_memberships from anon;
revoke all on table public.platform_admin_memberships from authenticated;
grant all on table public.platform_admin_memberships to service_role;
