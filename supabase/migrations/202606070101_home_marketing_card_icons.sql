update public.tenant_content_entries as entry
set value_json = (
  select jsonb_agg(
    case
      when section->>'type' in ('card_grid', 'steps') then
        jsonb_set(
          section,
          '{items}',
          coalesce(
            (
              select jsonb_agg(
                case
                  when item ? 'icon' and coalesce(item->>'icon', '') <> '' then item
                  else item || jsonb_build_object(
                    'icon',
                    case
                      when section->>'type' = 'steps' then
                        case item_ord
                          when 1 then 'calendar'
                          when 2 then 'mapPin'
                          when 3 then 'checkCircle'
                          else 'star'
                        end
                      else
                        case item_ord
                          when 1 then 'tag'
                          when 2 then 'truck'
                          when 3 then 'home'
                          else 'star'
                        end
                    end
                  )
                end
                order by item_ord
              )
              from jsonb_array_elements(coalesce(section->'items', '[]'::jsonb))
                with ordinality as items(item, item_ord)
            ),
            '[]'::jsonb
          ),
          true
        )
      else section
    end
    order by section_ord
  )
  from jsonb_array_elements(entry.value_json) with ordinality as sections(section, section_ord)
)
where entry.key = 'content.home.sections'
  and jsonb_typeof(entry.value_json) = 'array';

update public.tenant_content_entries as entry
set value_json = jsonb_set(
  entry.value_json,
  '{items}',
  coalesce(
    (
      select jsonb_agg(
        case
          when item ? 'icon' and coalesce(item->>'icon', '') <> '' then item
          else item || jsonb_build_object(
            'icon',
            case item_ord
              when 1 then 'tag'
              when 2 then 'truck'
              when 3 then 'home'
              else 'star'
            end
          )
        end
        order by item_ord
      )
      from jsonb_array_elements(coalesce(entry.value_json->'items', '[]'::jsonb))
        with ordinality as items(item, item_ord)
    ),
    '[]'::jsonb
  ),
  true
)
where entry.key = 'content.home.value_props'
  and jsonb_typeof(entry.value_json) = 'object';

update public.tenant_content_entries as entry
set value_json = jsonb_set(
  entry.value_json,
  '{items}',
  coalesce(
    (
      select jsonb_agg(
        case
          when item ? 'icon' and coalesce(item->>'icon', '') <> '' then item
          else item || jsonb_build_object(
            'icon',
            case item_ord
              when 1 then 'calendar'
              when 2 then 'mapPin'
              when 3 then 'checkCircle'
              else 'star'
            end
          )
        end
        order by item_ord
      )
      from jsonb_array_elements(coalesce(entry.value_json->'items', '[]'::jsonb))
        with ordinality as items(item, item_ord)
    ),
    '[]'::jsonb
  ),
  true
)
where entry.key = 'content.home.how_it_works'
  and jsonb_typeof(entry.value_json) = 'object';
