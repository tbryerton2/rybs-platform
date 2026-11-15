begin;

create table if not exists public.pricing_page_settings (
  business_id uuid primary key references public.tenants(id),
  headline text not null default 'Dumpster Pricing',
  introduction text not null default 'Review available dumpster sizes and rental details.',
  included_heading text not null default '',
  included_items jsonb not null default '[]' check (jsonb_typeof(included_items) = 'array'),
  bottom_note text not null default '',
  show_size_guide boolean not null default true,
  size_guide_button_text text not null default 'Not sure which size? →',
  size_guide_title text not null default 'Which size is right for me?',
  -- Retained migration snapshot. Application writes intentionally omit both archive columns.
  archived_cms jsonb not null default '[]',
  draft_differences jsonb not null default '[]'
);
alter table public.pricing_page_settings enable row level security;
revoke all on public.pricing_page_settings from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.pricing_page_settings to service_role;
comment on table public.pricing_page_settings is
  'Live Pricing page copy. Sole admin editor: /admin/settings/pricing. archived_cms retains original published/draft records, including unmatched guide rows, for rollback.';
comment on column public.tenant_content_entries.value_json is
  'Content by tenant/key/status. DEPRECATED: all content.pricing.* records; Pricing reads pricing_page_settings and dumpster_product_settings. Retained for rollback, not editable in CMS.';

create or replace function pg_temp.pricing_differences(published jsonb, draft jsonb)
returns jsonb language sql immutable set search_path = pg_catalog, pg_temp as $$
  with fields as (
    select key, value from jsonb_each(coalesce(published, '{}')) where key <> 'sizeGuide'
    union all select 'sizeGuide.' || key, value from jsonb_each(coalesce(published->'sizeGuide', '{}'))
  ), draft_fields as (
    select key, value from jsonb_each(coalesce(draft, '{}')) where key <> 'sizeGuide'
    union all select 'sizeGuide.' || key, value from jsonb_each(coalesce(draft->'sizeGuide', '{}'))
  )
  select coalesce(jsonb_agg(coalesce(p.key,d.key) order by coalesce(p.key,d.key)), '[]')
  from fields p full join draft_fields d on p.key=d.key where p.value is distinct from d.value;
$$;

do $$
declare
  tenant record;
  source jsonb;
  intro jsonb;
  archive jsonb;
  differences jsonb;
begin
  lock table public.tenant_content_entries, public.pricing_page_settings in share row exclusive mode;
  for tenant in select id from public.tenants order by id loop
    if exists (select 1 from public.pricing_page_settings where business_id=tenant.id) then
      raise notice 'Pricing page tenant %: already migrated; settings and archives preserved', tenant.id;
      continue;
    end if;
    select value_json into source from public.tenant_content_entries
      where tenant_id=tenant.id and key='content.pricing.product_content' and status='published';
    select value_json into intro from public.tenant_content_entries
      where tenant_id=tenant.id and key='content.pricing.intro' and status='published';
    select coalesce(jsonb_agg(jsonb_build_object('key',key,'status',status,'value',value_json,'updated_at',updated_at) order by key,status),'[]')
      into archive from public.tenant_content_entries where tenant_id=tenant.id and key like 'content.pricing.%';
    select coalesce(jsonb_agg(jsonb_build_object('key',d.key,'fields',pg_temp.pricing_differences(p.value_json,d.value_json)) order by d.key),'[]')
      into differences from public.tenant_content_entries d
      left join public.tenant_content_entries p on p.tenant_id=d.tenant_id and p.key=d.key and p.status='published'
      where d.tenant_id=tenant.id and d.key like 'content.pricing.%' and d.status='draft'
        and d.value_json is distinct from p.value_json;
    insert into public.pricing_page_settings (
      business_id, headline, introduction, included_heading, included_items, bottom_note,
      show_size_guide, size_guide_button_text, size_guide_title, archived_cms, draft_differences
    ) values (
      tenant.id,
      coalesce(nullif(btrim(intro->>'headline'),''),'Dumpster Pricing'),
      coalesce(nullif(btrim(intro->>'defaultBody'),''),'Review available dumpster sizes and rental details.'),
      coalesce(btrim(source->>'includedHeading'),''),
      case when jsonb_typeof(source->'includedItems')='array' then source->'includedItems' else '[]'::jsonb end,
      coalesce(btrim(coalesce(source->>'bottomNote',source->>'footnote')),''),
      case when jsonb_typeof(source#>'{sizeGuide,enabled}')='boolean' then (source#>>'{sizeGuide,enabled}')::boolean else true end,
      coalesce(nullif(btrim(source#>>'{sizeGuide,buttonText}'),''),'Not sure which size? →'),
      coalesce(nullif(btrim(source#>>'{sizeGuide,title}'),''),'Which size is right for me?'),
      archive, differences
    ) on conflict (business_id) do nothing;
    raise notice 'Pricing page tenant %: migrated published content; differing drafts %', tenant.id, differences;
  end loop;
end $$;
notify pgrst, 'reload schema';
commit;
