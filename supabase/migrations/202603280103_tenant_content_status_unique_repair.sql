alter table public.tenant_content_entries
  drop constraint if exists tenant_content_entries_tenant_key_unique;

drop index if exists public.tenant_content_entries_tenant_key_status_idx;

create unique index if not exists tenant_content_entries_tenant_key_status_unique_idx
  on public.tenant_content_entries (tenant_id, key, status);

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'tenant_content_entries_tenant_key_status_unique'
      and conrelid = 'public.tenant_content_entries'::regclass
  ) then
    alter table public.tenant_content_entries
      add constraint tenant_content_entries_tenant_key_status_unique
        unique using index tenant_content_entries_tenant_key_status_unique_idx;
  end if;
end
$$;
