create or replace function public.business_admin_update_membership(
  p_actor_auth_user_id uuid,
  p_business_id uuid,
  p_membership_id uuid,
  p_role text default null,
  p_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_membership public.business_admin_memberships%rowtype;
  next_role text;
  next_status text;
  active_owner_count integer;
  current_owner_confirmed boolean;
begin
  if p_role is not null and p_role not in ('owner', 'admin') then
    raise exception 'BUSINESS_ADMIN_INVALID_ROLE'
      using errcode = '22023';
  end if;

  if p_status is not null and p_status not in ('active', 'disabled') then
    raise exception 'BUSINESS_ADMIN_INVALID_STATUS'
      using errcode = '22023';
  end if;

  lock table public.business_admin_memberships in share row exclusive mode;

  perform 1
  from public.business_admin_memberships
  where business_id = p_business_id
    and auth_user_id = p_actor_auth_user_id
    and role = 'owner'
    and status = 'active'
  for update;

  if not found then
    raise exception 'BUSINESS_ADMIN_OWNER_REQUIRED'
      using errcode = '42501';
  end if;

  select *
    into current_membership
  from public.business_admin_memberships
  where id = p_membership_id
    and business_id = p_business_id
  for update;

  if current_membership.id is null then
    raise exception 'BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  next_role := coalesce(p_role, current_membership.role);
  next_status := coalesce(p_status, current_membership.status);

  select au.email_confirmed_at is not null
    into current_owner_confirmed
  from auth.users au
  where au.id = current_membership.auth_user_id;

  if current_membership.auth_user_id = p_actor_auth_user_id
    and (next_role is distinct from current_membership.role
      or next_status is distinct from current_membership.status) then
    raise exception 'BUSINESS_ADMIN_SELF_UPDATE_BLOCKED'
      using errcode = '42501';
  end if;

  if current_membership.role = 'owner'
    and current_membership.status = 'active'
    and coalesce(current_owner_confirmed, false)
    and (next_role <> 'owner' or next_status <> 'active') then
    select count(*)
      into active_owner_count
  from public.business_admin_memberships
  join auth.users au on au.id = business_admin_memberships.auth_user_id
    where business_admin_memberships.business_id = p_business_id
      and business_admin_memberships.role = 'owner'
      and business_admin_memberships.status = 'active'
      and au.email_confirmed_at is not null;

    if active_owner_count <= 1 then
      raise exception 'BUSINESS_ADMIN_LAST_OWNER'
        using errcode = 'P0001';
    end if;
  end if;

  update public.business_admin_memberships
  set role = next_role,
      status = next_status,
      updated_at = now()
  where id = p_membership_id
    and business_id = p_business_id;

  return p_membership_id;
end;
$$;

revoke all on function public.business_admin_update_membership(uuid, uuid, uuid, text, text) from public;
revoke all on function public.business_admin_update_membership(uuid, uuid, uuid, text, text) from anon;
revoke all on function public.business_admin_update_membership(uuid, uuid, uuid, text, text) from authenticated;
grant execute on function public.business_admin_update_membership(uuid, uuid, uuid, text, text) to service_role;

comment on function public.business_admin_update_membership(uuid, uuid, uuid, text, text) is
  'Tenant owner-only service-role RPC for role/status updates with same-business and last-owner protection.';
