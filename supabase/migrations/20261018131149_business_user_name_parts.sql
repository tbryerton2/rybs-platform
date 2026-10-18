begin;
-- Preserve unsplit legacy names; do not guess compound given names or surnames.
alter table public.business_admin_memberships
  add column first_name text check (first_name is null or char_length(btrim(first_name)) between 1 and 120),
  add column last_name text check (last_name is null or char_length(btrim(last_name)) between 1 and 120),
  drop constraint business_admin_memberships_full_name_check,
  add constraint business_admin_memberships_full_name_check check (full_name is null or char_length(btrim(full_name)) between 1 and 241);

create function public.business_admin_manage_user_v2(
  p_actor_auth_user_id uuid,
  p_business_id uuid,
  p_action text,
  p_membership_id uuid default null,
  p_target_auth_user_id uuid default null,
  p_first_name text default null,
  p_last_name text default null,
  p_role text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.business_admin_memberships%rowtype;
  target public.business_admin_memberships%rowtype;
  event_action text;
  old_value text;
  new_value text;
  clean_first text := nullif(btrim(p_first_name), '');
  clean_last text := nullif(btrim(p_last_name), '');
  clean_name text := clean_first || ' ' || clean_last;
begin
  -- Serialize changes within a business (including simultaneous owner changes).
  perform 1 from public.tenants where id = p_business_id and status = 'active' for update;
  if not found then raise exception 'BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND'; end if;

  if p_action not in ('invite', 'accept', 'name', 'role', 'deactivate', 'reactivate', 'sent', 'resent', 'failed') then
    raise exception 'BUSINESS_ADMIN_INVALID_ACTION';
  end if;
  if p_action in ('invite', 'name', 'accept') and (clean_first is null or clean_last is null or char_length(clean_first) > 120 or char_length(clean_last) > 120) then
    raise exception 'BUSINESS_ADMIN_INVALID_NAME';
  end if;
  if p_action in ('invite', 'role') and (p_role is null or p_role not in ('owner', 'admin')) then
    raise exception 'BUSINESS_ADMIN_INVALID_ROLE';
  end if;

  select * into actor from public.business_admin_memberships
  where business_id = p_business_id and auth_user_id = p_actor_auth_user_id
    and status = 'active' and accepted_at is not null;

  if p_action <> 'accept' then
    if actor.id is null then raise exception 'BUSINESS_ADMIN_ACCESS_REQUIRED'; end if;
    if p_action <> 'name' and actor.role <> 'owner' then raise exception 'BUSINESS_ADMIN_OWNER_REQUIRED'; end if;
  end if;

  if p_action = 'invite' then
    if exists (select 1 from public.business_admin_memberships where business_id = p_business_id and auth_user_id = p_target_auth_user_id) then
      raise exception 'BUSINESS_ADMIN_ALREADY_EXISTS';
    end if;
    insert into public.business_admin_memberships (business_id, auth_user_id, role, status, full_name, first_name, last_name, invited_at, accepted_at)
    values (p_business_id, p_target_auth_user_id, p_role, 'active', clean_name, clean_first, clean_last, now(), null)
    returning * into target;
    event_action := 'invited';
    new_value := p_role;
  else
    select * into target from public.business_admin_memberships
    where business_id = p_business_id
      and ((p_action = 'accept' and auth_user_id = p_actor_auth_user_id) or (p_action <> 'accept' and id = p_membership_id))
    for update;
    if target.id is null then raise exception 'BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND'; end if;

    if p_action = 'accept' then
      if target.status <> 'active' then raise exception 'BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND'; end if;
      if target.accepted_at is not null then return target.id; end if;
      if target.invited_at is null then raise exception 'BUSINESS_ADMIN_NOT_PENDING'; end if;
      actor := target;
      if (target.first_name, target.last_name) is distinct from (clean_first, clean_last) then
        insert into public.business_admin_user_events (business_id, membership_id, actor_auth_user_id, actor_name, action, before_value, after_value)
        values (p_business_id, target.id, p_actor_auth_user_id, clean_name, 'name_updated', target.full_name, clean_name);
      end if;
      update public.business_admin_memberships set accepted_at = now(), full_name = clean_name, first_name = clean_first, last_name = clean_last where id = target.id;
      event_action := 'invite_accepted';
    elsif p_action = 'name' then
      if (target.first_name, target.last_name) is not distinct from (clean_first, clean_last) then return target.id; end if;
      old_value := target.full_name; new_value := clean_name;
      update public.business_admin_memberships set full_name = clean_name, first_name = clean_first, last_name = clean_last where id = target.id;
      event_action := 'name_updated';
    elsif p_action in ('role', 'deactivate', 'reactivate') then
      if (p_action = 'role' and target.role = p_role) or (p_action = 'deactivate' and target.status = 'disabled') or (p_action = 'reactivate' and target.status = 'active') then
        return target.id;
      end if;
      if target.auth_user_id = p_actor_auth_user_id then raise exception 'BUSINESS_ADMIN_SELF_UPDATE_BLOCKED'; end if;
      if target.role = 'owner' and target.status = 'active' and target.accepted_at is not null
        and (p_action = 'deactivate' or (p_action = 'role' and p_role <> 'owner'))
        and (select count(*) from public.business_admin_memberships where business_id = p_business_id and role = 'owner' and status = 'active' and accepted_at is not null) <= 1 then
        raise exception 'BUSINESS_ADMIN_LAST_OWNER';
      end if;
      if p_action = 'role' then
        old_value := target.role; new_value := p_role; event_action := 'role_updated';
        update public.business_admin_memberships set role = p_role where id = target.id;
      else
        old_value := target.status;
        new_value := case when p_action = 'deactivate' then 'disabled' else 'active' end;
        event_action := case when p_action = 'deactivate' then 'deactivated' else 'reactivated' end;
        update public.business_admin_memberships set status = new_value where id = target.id;
      end if;
    else
      if target.status <> 'active' or target.accepted_at is not null then raise exception 'BUSINESS_ADMIN_NOT_PENDING'; end if;
      if p_action = 'failed' then
        update public.business_admin_memberships set last_invite_failed_at = now() where id = target.id;
        event_action := 'invitation_failed';
      else
        update public.business_admin_memberships set last_invite_sent_at = now() where id = target.id;
        event_action := case when p_action = 'resent' then 'invitation_resent' else 'invitation_sent' end;
      end if;
    end if;
  end if;

  insert into public.business_admin_user_events (business_id, membership_id, actor_auth_user_id, actor_name, action, before_value, after_value)
  values (p_business_id, target.id, p_actor_auth_user_id, actor.full_name, event_action, old_value, new_value);
  return target.id;
end;
$$;
revoke all on function public.business_admin_manage_user_v2(uuid, uuid, text, uuid, uuid, text, text, text) from public, anon, authenticated;
grant execute on function public.business_admin_manage_user_v2(uuid, uuid, text, uuid, uuid, text, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
