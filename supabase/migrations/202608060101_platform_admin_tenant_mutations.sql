create or replace function public.platform_admin_create_tenant(
  p_slug text,
  p_status text,
  p_brand_name text,
  p_timezone text,
  p_storage_namespace text
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  created_tenant_id uuid;
begin
  if p_status not in ('active', 'inactive') then
    raise exception 'PLATFORM_TENANT_INVALID_STATUS'
      using errcode = '22023';
  end if;

  if nullif(trim(p_slug), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_SLUG'
      using errcode = '22023';
  end if;

  if nullif(trim(p_brand_name), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_BRAND_NAME'
      using errcode = '22023';
  end if;

  if nullif(trim(p_timezone), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_TIMEZONE'
      using errcode = '22023';
  end if;

  if nullif(trim(p_storage_namespace), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_STORAGE_NAMESPACE'
      using errcode = '22023';
  end if;

  insert into public.tenants (slug, status)
  values (trim(p_slug), p_status)
  returning id into created_tenant_id;

  insert into public.tenant_settings (tenant_id, category, key, value_json)
  values
    (created_tenant_id, 'brand', 'name', to_jsonb(trim(p_brand_name))),
    (created_tenant_id, 'support', 'timezone', to_jsonb(trim(p_timezone))),
    (created_tenant_id, 'runtime', 'storageNamespace', to_jsonb(trim(p_storage_namespace)));

  return created_tenant_id;
end;
$$;

create or replace function public.platform_admin_update_tenant_basic(
  p_tenant_id uuid,
  p_slug text,
  p_brand_name text,
  p_expected_updated_at timestamptz default null
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  existing_updated_at timestamptz;
begin
  if nullif(trim(p_slug), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_SLUG'
      using errcode = '22023';
  end if;

  if nullif(trim(p_brand_name), '') is null then
    raise exception 'PLATFORM_TENANT_INVALID_BRAND_NAME'
      using errcode = '22023';
  end if;

  select tenants.updated_at
    into existing_updated_at
  from public.tenants
  where tenants.id = p_tenant_id
  for update;

  if existing_updated_at is null then
    raise exception 'PLATFORM_TENANT_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if p_expected_updated_at is not null and existing_updated_at is distinct from p_expected_updated_at then
    raise exception 'PLATFORM_TENANT_STALE'
      using errcode = 'P0001';
  end if;

  update public.tenants
  set slug = trim(p_slug)
  where tenants.id = p_tenant_id;

  insert into public.tenant_settings (tenant_id, category, key, value_json)
  values (p_tenant_id, 'brand', 'name', to_jsonb(trim(p_brand_name)))
  on conflict on constraint tenant_settings_tenant_category_key_unique
  do update
    set value_json = excluded.value_json,
        updated_at = now();

  return p_tenant_id;
end;
$$;

revoke all on function public.platform_admin_create_tenant(text, text, text, text, text) from anon;
revoke all on function public.platform_admin_create_tenant(text, text, text, text, text) from authenticated;
grant execute on function public.platform_admin_create_tenant(text, text, text, text, text) to service_role;

revoke all on function public.platform_admin_update_tenant_basic(uuid, text, text, timestamptz) from anon;
revoke all on function public.platform_admin_update_tenant_basic(uuid, text, text, timestamptz) from authenticated;
grant execute on function public.platform_admin_update_tenant_basic(uuid, text, text, timestamptz) to service_role;

comment on function public.platform_admin_create_tenant(text, text, text, text, text) is
  'Platform Admin service-role RPC for atomic tenant creation plus the minimum tenant_settings bootstrap.';

comment on function public.platform_admin_update_tenant_basic(uuid, text, text, timestamptz) is
  'Platform Admin service-role RPC for atomic basic tenant slug and brand.name edits.';
