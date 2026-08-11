create or replace function public.platform_admin_set_primary_tenant_domain(
  p_tenant_id uuid,
  p_domain_id uuid
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  target_status text;
begin
  select tenant_domains.status
    into target_status
  from public.tenant_domains
  where tenant_domains.id = p_domain_id
    and tenant_domains.tenant_id = p_tenant_id
  for update;

  if target_status is null then
    raise exception 'PLATFORM_TENANT_DOMAIN_NOT_FOUND'
      using errcode = 'P0002';
  end if;

  if target_status <> 'active' then
    raise exception 'PLATFORM_TENANT_DOMAIN_PRIMARY_REQUIRES_ACTIVE'
      using errcode = '22023';
  end if;

  update public.tenant_domains
  set is_primary = false
  where tenant_domains.tenant_id = p_tenant_id
    and tenant_domains.id <> p_domain_id
    and tenant_domains.is_primary = true;

  update public.tenant_domains
  set is_primary = true
  where tenant_domains.id = p_domain_id
    and tenant_domains.tenant_id = p_tenant_id;

  return p_domain_id;
end;
$$;

revoke all on function public.platform_admin_set_primary_tenant_domain(uuid, uuid) from anon;
revoke all on function public.platform_admin_set_primary_tenant_domain(uuid, uuid) from authenticated;
grant execute on function public.platform_admin_set_primary_tenant_domain(uuid, uuid) to service_role;

comment on function public.platform_admin_set_primary_tenant_domain(uuid, uuid) is
  'Platform Admin service-role RPC for atomically making one active tenant_domains row primary for its tenant.';
