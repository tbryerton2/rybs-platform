begin;

alter table public.business_admin_memberships enable row level security;
revoke all on public.business_admin_memberships from anon, authenticated;

alter table public.business_admin_memberships
  add column full_name text check (full_name is null or char_length(btrim(full_name)) between 1 and 120),
  add column invited_at timestamptz,
  add column accepted_at timestamptz default now(),
  add column last_invite_sent_at timestamptz,
  add column last_invite_failed_at timestamptz;

-- Preserve existing access; only unconfirmed legacy invitations remain pending.
update public.business_admin_memberships m
set full_name = left(coalesce(nullif(btrim(u.raw_user_meta_data->>'full_name'), ''), nullif(btrim(u.raw_user_meta_data->>'name'), '')), 120),
    invited_at = u.invited_at,
    accepted_at = case when u.invited_at is not null and u.email_confirmed_at is null then null else m.created_at end
from auth.users u where u.id = m.auth_user_id;

create table public.business_admin_user_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants(id),
  membership_id uuid not null references public.business_admin_memberships(id),
  actor_auth_user_id uuid not null,
  actor_name text,
  action text not null check (action in ('invited', 'invitation_sent', 'invitation_resent', 'invitation_failed', 'invite_accepted', 'name_updated', 'role_updated', 'deactivated', 'reactivated')),
  before_value text,
  after_value text,
  created_at timestamptz not null default now()
);
create index business_admin_user_events_membership_idx
  on public.business_admin_user_events (business_id, membership_id, created_at desc, id desc);
create index business_admin_user_events_membership_fk_idx on public.business_admin_user_events (membership_id);
alter table public.business_admin_user_events enable row level security;
revoke all on public.business_admin_user_events from public, anon, authenticated, service_role;
grant select, insert on public.business_admin_user_events to service_role;
comment on table public.business_admin_user_events is 'Server-owned, append-only business user management history. No tokens or passwords.';
comment on column public.business_admin_memberships.full_name is 'Business-specific display name. Editing this does not change the shared Auth identity.';

create function public.business_admin_preserve_user_history()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  raise exception 'BUSINESS_ADMIN_HISTORY_IMMUTABLE';
end;
$$;
revoke all on function public.business_admin_preserve_user_history() from public, anon, authenticated;
create trigger business_admin_user_events_immutable before update or delete
on public.business_admin_user_events for each row execute function public.business_admin_preserve_user_history();

-- Only the server can call this function. The actor is taken from a verified session,
-- never from form input. Membership checks and history writes share one transaction.
create function public.business_admin_manage_user(
  p_actor_auth_user_id uuid,
  p_business_id uuid,
  p_action text,
  p_membership_id uuid default null,
  p_target_auth_user_id uuid default null,
  p_name text default null,
  p_role text default null
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  actor public.business_admin_memberships%rowtype;
  target public.business_admin_memberships%rowtype;
  event_action text;
  old_value text;
  new_value text;
  clean_name text := nullif(btrim(p_name), '');
begin
  -- Serialize changes within a business (including simultaneous owner changes).
  perform 1 from public.tenants where id = p_business_id and status = 'active' for update;
  if not found then raise exception 'BUSINESS_ADMIN_MEMBERSHIP_NOT_FOUND'; end if;

  if p_action not in ('invite', 'accept', 'name', 'role', 'deactivate', 'reactivate', 'sent', 'resent', 'failed') then
    raise exception 'BUSINESS_ADMIN_INVALID_ACTION';
  end if;
  if p_action in ('invite', 'name', 'accept') and (clean_name is null or char_length(clean_name) > 120) then
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
    insert into public.business_admin_memberships (business_id, auth_user_id, role, status, full_name, invited_at, accepted_at)
    values (p_business_id, p_target_auth_user_id, p_role, 'active', clean_name, now(), null)
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
      if target.full_name is distinct from clean_name then
        insert into public.business_admin_user_events (business_id, membership_id, actor_auth_user_id, actor_name, action, before_value, after_value)
        values (p_business_id, target.id, p_actor_auth_user_id, clean_name, 'name_updated', target.full_name, clean_name);
      end if;
      update public.business_admin_memberships set accepted_at = now(), full_name = clean_name where id = target.id;
      event_action := 'invite_accepted';
    elsif p_action = 'name' then
      if target.full_name is not distinct from clean_name then return target.id; end if;
      old_value := target.full_name; new_value := clean_name;
      update public.business_admin_memberships set full_name = clean_name where id = target.id;
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
revoke all on function public.business_admin_manage_user(uuid, uuid, text, uuid, uuid, text, text) from public, anon, authenticated;
grant execute on function public.business_admin_manage_user(uuid, uuid, text, uuid, uuid, text, text) to service_role;

notify pgrst, 'reload schema';
commit;
