create extension if not exists pgcrypto;

create table if not exists public.tenant_payment_settings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'square'
    check (provider in ('square')),
  mode text not null default 'disabled'
    check (mode in ('disabled', 'sandbox', 'production')),
  updated_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint tenant_payment_settings_business_provider_unique
    unique (business_id, provider)
);

comment on table public.tenant_payment_settings is
  'Server-only payment environment policy for each business and provider. Missing rows resolve to disabled.';

comment on column public.tenant_payment_settings.provider is
  'Payment provider controlled by the policy. Initially restricted to square.';

comment on column public.tenant_payment_settings.mode is
  'Payment mode for the business/provider. production is presented as Live in platform UI.';

comment on column public.tenant_payment_settings.updated_by is
  'Auth user id for the active RYBS platform administrator that last changed this policy.';

create index if not exists tenant_payment_settings_business_id_idx
  on public.tenant_payment_settings (business_id);

create index if not exists tenant_payment_settings_updated_by_idx
  on public.tenant_payment_settings (updated_by)
  where updated_by is not null;

drop trigger if exists tenant_payment_settings_set_updated_at
  on public.tenant_payment_settings;
create trigger tenant_payment_settings_set_updated_at
before update on public.tenant_payment_settings
for each row execute function public.set_updated_at();

alter table public.tenant_payment_settings enable row level security;

revoke all on table public.tenant_payment_settings from public;
revoke all on table public.tenant_payment_settings from anon;
revoke all on table public.tenant_payment_settings from authenticated;
grant all on table public.tenant_payment_settings to service_role;

create table if not exists public.tenant_payment_setting_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null
    check (provider in ('square')),
  previous_mode text not null
    check (previous_mode in ('disabled', 'sandbox', 'production')),
  new_mode text not null
    check (new_mode in ('disabled', 'sandbox', 'production')),
  actor_platform_admin_user_id uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.tenant_payment_setting_events is
  'Append-only server-owned audit history for platform-admin payment mode changes.';

comment on column public.tenant_payment_setting_events.actor_platform_admin_user_id is
  'Auth user id for the active RYBS platform administrator that requested the change.';

create index if not exists tenant_payment_setting_events_business_provider_created_idx
  on public.tenant_payment_setting_events (business_id, provider, created_at desc);

create index if not exists tenant_payment_setting_events_actor_idx
  on public.tenant_payment_setting_events (actor_platform_admin_user_id)
  where actor_platform_admin_user_id is not null;

create or replace function public.prevent_tenant_payment_setting_event_mutation()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  raise exception 'TENANT_PAYMENT_SETTING_EVENT_APPEND_ONLY'
    using errcode = '42501';
end;
$$;

drop trigger if exists tenant_payment_setting_events_append_only_update
  on public.tenant_payment_setting_events;
create trigger tenant_payment_setting_events_append_only_update
before update on public.tenant_payment_setting_events
for each row execute function public.prevent_tenant_payment_setting_event_mutation();

drop trigger if exists tenant_payment_setting_events_append_only_delete
  on public.tenant_payment_setting_events;
create trigger tenant_payment_setting_events_append_only_delete
before delete on public.tenant_payment_setting_events
for each row execute function public.prevent_tenant_payment_setting_event_mutation();

alter table public.tenant_payment_setting_events enable row level security;

revoke all on table public.tenant_payment_setting_events from public;
revoke all on table public.tenant_payment_setting_events from anon;
revoke all on table public.tenant_payment_setting_events from authenticated;
grant all on table public.tenant_payment_setting_events to service_role;

revoke all on function public.prevent_tenant_payment_setting_event_mutation() from public;
revoke all on function public.prevent_tenant_payment_setting_event_mutation() from anon;
revoke all on function public.prevent_tenant_payment_setting_event_mutation() from authenticated;
grant execute on function public.prevent_tenant_payment_setting_event_mutation() to service_role;

create or replace function public.platform_admin_set_tenant_payment_mode(
  p_business_id uuid,
  p_provider text,
  p_mode text,
  p_actor_auth_user_id uuid
)
returns table (
  id uuid,
  business_id uuid,
  provider text,
  mode text,
  updated_by uuid,
  created_at timestamptz,
  updated_at timestamptz,
  changed boolean
)
language plpgsql
security invoker
set search_path = public
as $$
declare
  existing_setting public.tenant_payment_settings%rowtype;
  saved_setting public.tenant_payment_settings%rowtype;
  previous_mode text;
begin
  if p_provider not in ('square') then
    raise exception 'TENANT_PAYMENT_SETTING_INVALID_PROVIDER'
      using errcode = '22023';
  end if;

  if p_mode not in ('disabled', 'sandbox', 'production') then
    raise exception 'TENANT_PAYMENT_SETTING_INVALID_MODE'
      using errcode = '22023';
  end if;

  if p_actor_auth_user_id is null then
    raise exception 'TENANT_PAYMENT_SETTING_ACTOR_REQUIRED'
      using errcode = '22023';
  end if;

  perform 1
  from public.tenants
  where tenants.id = p_business_id;

  if not found then
    raise exception 'TENANT_PAYMENT_SETTING_BUSINESS_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  -- Serialize the first write as well as later updates for this business/provider.
  perform pg_advisory_xact_lock(
    hashtextextended(p_business_id::text || ':' || p_provider, 0)
  );

  select *
    into existing_setting
  from public.tenant_payment_settings
  where tenant_payment_settings.business_id = p_business_id
    and tenant_payment_settings.provider = p_provider
  for update;

  if existing_setting.id is null then
    previous_mode := 'disabled';

    if p_mode = 'disabled' then
      return query
      select
        null::uuid,
        p_business_id,
        p_provider,
        'disabled'::text,
        null::uuid,
        null::timestamptz,
        null::timestamptz,
        false;
      return;
    end if;

    insert into public.tenant_payment_settings (
      business_id,
      provider,
      mode,
      updated_by
    )
    values (
      p_business_id,
      p_provider,
      p_mode,
      p_actor_auth_user_id
    )
    returning * into saved_setting;
  else
    previous_mode := existing_setting.mode;

    if existing_setting.mode = p_mode then
      return query
      select
        existing_setting.id,
        existing_setting.business_id,
        existing_setting.provider,
        existing_setting.mode,
        existing_setting.updated_by,
        existing_setting.created_at,
        existing_setting.updated_at,
        false;
      return;
    end if;

    update public.tenant_payment_settings
    set mode = p_mode,
        updated_by = p_actor_auth_user_id,
        updated_at = now()
    where tenant_payment_settings.id = existing_setting.id
    returning * into saved_setting;
  end if;

  insert into public.tenant_payment_setting_events (
    business_id,
    provider,
    previous_mode,
    new_mode,
    actor_platform_admin_user_id
  )
  values (
    p_business_id,
    p_provider,
    previous_mode,
    p_mode,
    p_actor_auth_user_id
  );

  return query
  select
    saved_setting.id,
    saved_setting.business_id,
    saved_setting.provider,
    saved_setting.mode,
    saved_setting.updated_by,
    saved_setting.created_at,
    saved_setting.updated_at,
    true;
end;
$$;

revoke all on function public.platform_admin_set_tenant_payment_mode(uuid, text, text, uuid) from public;
revoke all on function public.platform_admin_set_tenant_payment_mode(uuid, text, text, uuid) from anon;
revoke all on function public.platform_admin_set_tenant_payment_mode(uuid, text, text, uuid) from authenticated;
grant execute on function public.platform_admin_set_tenant_payment_mode(uuid, text, text, uuid) to service_role;

comment on function public.platform_admin_set_tenant_payment_mode(uuid, text, text, uuid) is
  'Platform Admin service-role RPC for atomic tenant payment mode changes plus append-only audit history.';
