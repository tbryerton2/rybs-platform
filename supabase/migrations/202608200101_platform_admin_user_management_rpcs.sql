create or replace function public.platform_admin_grant_membership(
  p_actor_auth_user_id uuid,
  p_target_auth_user_id uuid,
  p_role text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  membership_id uuid;
begin
  if p_role not in ('owner', 'admin') then
    raise exception 'PLATFORM_ADMIN_INVALID_ROLE'
      using errcode = '22023';
  end if;

  lock table public.platform_admin_memberships in share row exclusive mode;

  perform 1
  from public.platform_admin_memberships
  where auth_user_id = p_actor_auth_user_id
    and role = 'owner'
    and status = 'active'
  for update;

  if not found then
    raise exception 'PLATFORM_ADMIN_OWNER_REQUIRED'
      using errcode = '42501';
  end if;

  insert into public.platform_admin_memberships (auth_user_id, role, status)
  values (p_target_auth_user_id, p_role, 'active')
  on conflict on constraint platform_admin_memberships_auth_user_id_key
  do update
    set role = excluded.role,
        status = 'active',
        updated_at = now()
  returning id into membership_id;

  return membership_id;
end;
$$;

create or replace function public.platform_admin_update_membership(
  p_actor_auth_user_id uuid,
  p_membership_id uuid,
  p_role text default null,
  p_status text default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  current_membership public.platform_admin_memberships%rowtype;
  next_role text;
  next_status text;
  active_owner_count integer;
begin
  if p_role is not null and p_role not in ('owner', 'admin') then
    raise exception 'PLATFORM_ADMIN_INVALID_ROLE'
      using errcode = '22023';
  end if;

  if p_status is not null and p_status not in ('active', 'disabled') then
    raise exception 'PLATFORM_ADMIN_INVALID_STATUS'
      using errcode = '22023';
  end if;

  lock table public.platform_admin_memberships in share row exclusive mode;

  perform 1
  from public.platform_admin_memberships
  where auth_user_id = p_actor_auth_user_id
    and role = 'owner'
    and status = 'active'
  for update;

  if not found then
    raise exception 'PLATFORM_ADMIN_OWNER_REQUIRED'
      using errcode = '42501';
  end if;

  select *
    into current_membership
  from public.platform_admin_memberships
  where id = p_membership_id
  for update;

  if current_membership.id is null then
    raise exception 'PLATFORM_ADMIN_MEMBERSHIP_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  next_role := coalesce(p_role, current_membership.role);
  next_status := coalesce(p_status, current_membership.status);

  if current_membership.auth_user_id = p_actor_auth_user_id
    and (next_role is distinct from current_membership.role
      or next_status is distinct from current_membership.status) then
    raise exception 'PLATFORM_ADMIN_SELF_UPDATE_BLOCKED'
      using errcode = '42501';
  end if;

  if current_membership.role = 'owner'
    and current_membership.status = 'active'
    and (next_role <> 'owner' or next_status <> 'active') then
    select count(*)
      into active_owner_count
    from public.platform_admin_memberships
    where role = 'owner'
      and status = 'active';

    if active_owner_count <= 1 then
      raise exception 'PLATFORM_ADMIN_LAST_OWNER'
        using errcode = 'P0001';
    end if;
  end if;

  update public.platform_admin_memberships
  set role = next_role,
      status = next_status,
      updated_at = now()
  where id = p_membership_id;

  return p_membership_id;
end;
$$;

revoke all on function public.platform_admin_grant_membership(uuid, uuid, text) from public;
revoke all on function public.platform_admin_grant_membership(uuid, uuid, text) from anon;
revoke all on function public.platform_admin_grant_membership(uuid, uuid, text) from authenticated;
grant execute on function public.platform_admin_grant_membership(uuid, uuid, text) to service_role;

revoke all on function public.platform_admin_update_membership(uuid, uuid, text, text) from public;
revoke all on function public.platform_admin_update_membership(uuid, uuid, text, text) from anon;
revoke all on function public.platform_admin_update_membership(uuid, uuid, text, text) from authenticated;
grant execute on function public.platform_admin_update_membership(uuid, uuid, text, text) to service_role;

comment on function public.platform_admin_grant_membership(uuid, uuid, text) is
  'Owner-only service-role RPC for granting or reactivating Platform Admin membership.';

comment on function public.platform_admin_update_membership(uuid, uuid, text, text) is
  'Owner-only service-role RPC for role/status updates with concurrency-safe last-owner protection.';
