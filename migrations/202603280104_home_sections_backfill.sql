with resolved_tenant as (
  select id
  from public.tenants
  where slug = 'tan-can-man'
  limit 1
),
legacy_statuses as (
  select distinct status
  from public.tenant_content_entries
  where tenant_id = (select id from resolved_tenant)
    and key in ('content.home.value_props', 'content.home.how_it_works')
),
value_props as (
  select status, value_json
  from public.tenant_content_entries
  where tenant_id = (select id from resolved_tenant)
    and key = 'content.home.value_props'
),
how_it_works as (
  select status, value_json
  from public.tenant_content_entries
  where tenant_id = (select id from resolved_tenant)
    and key = 'content.home.how_it_works'
)
insert into public.tenant_content_entries (tenant_id, key, status, value_json)
select
  resolved_tenant.id,
  'content.home.sections',
  legacy_statuses.status,
  jsonb_strip_nulls(
    jsonb_build_array(
      case
        when value_props.value_json is not null then
          jsonb_build_object(
            'id', 'why-choose-us',
            'type', 'card_grid',
            'sectionTitle', coalesce(value_props.value_json->>'sectionTitle', ''),
            'intro', coalesce(value_props.value_json->>'intro', ''),
            'items', coalesce(value_props.value_json->'items', '[]'::jsonb)
          )
        else null
      end,
      case
        when how_it_works.value_json is not null then
          jsonb_build_object(
            'id', 'how-it-works',
            'type', 'steps',
            'sectionTitle', coalesce(how_it_works.value_json->>'sectionTitle', ''),
            'intro', coalesce(how_it_works.value_json->>'intro', ''),
            'items', coalesce(
              (
                select jsonb_agg(
                  jsonb_build_object(
                    'label', coalesce(item->>'label', item->>'stepLabel', ''),
                    'title', coalesce(item->>'title', ''),
                    'body', coalesce(item->>'body', '')
                  )
                )
                from jsonb_array_elements(coalesce(how_it_works.value_json->'items', '[]'::jsonb)) as item
              ),
              '[]'::jsonb
            ),
            'footnote', coalesce(how_it_works.value_json->>'footnote', '')
          )
        else null
      end
    )
  )
from resolved_tenant
join legacy_statuses on true
left join value_props on value_props.status = legacy_statuses.status
left join how_it_works on how_it_works.status = legacy_statuses.status
where not exists (
  select 1
  from public.tenant_content_entries existing
  where existing.tenant_id = resolved_tenant.id
    and existing.key = 'content.home.sections'
    and existing.status = legacy_statuses.status
)
  and (value_props.value_json is not null or how_it_works.value_json is not null);
