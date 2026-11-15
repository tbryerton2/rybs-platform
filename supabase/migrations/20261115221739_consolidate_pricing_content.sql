begin;

alter table public.dumpster_product_settings
  add column if not exists truck_load_estimate text,
  add column if not exists size_guide_examples text;

comment on column public.dumpster_product_settings.truck_load_estimate is
  'Optional customer-facing truck-load estimate in the retail pricing size guide.';
comment on column public.dumpster_product_settings.size_guide_examples is
  'Optional customer-facing examples in the retail pricing size guide.';
comment on column public.pricing_settings.included_services_blurb is
  'DEPRECATED: Pricing page included copy now lives in tenant_content_entries content.pricing.product_content. Retained for rollback.';
comment on column public.tenant_content_entries.value_json is
  'Content by tenant, key and status. DEPRECATED within pricing content: description/productBody, featureBullets/featureList and sizeGuide.rows. Retained for rollback; dumpster_product_settings owns product copy and guide details.';

-- An append-only receipt prevents a re-run from restoring content subsequently cleared by a user.
create table if not exists public.pricing_content_migration_audit (
  tenant_id uuid primary key references public.tenants(id),
  report jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.pricing_content_migration_audit enable row level security;
revoke all on public.pricing_content_migration_audit from public, anon, authenticated, service_role;
grant select, insert on public.pricing_content_migration_audit to service_role;
comment on table public.pricing_content_migration_audit is
  'Append-only per-tenant receipt for consolidate_pricing_content; contains preserved source copy and manual-review outcomes.';

-- Transaction-local helper: normalize size units and separators, never fuzzy-match names or arbitrary numbers.
create or replace function pg_temp.pricing_size_key(label text) returns text
language sql immutable set search_path = pg_catalog, pg_temp as $$
  select regexp_replace(
    regexp_replace(lower(btrim(coalesce(label, ''))), '[[:space:]_-]+', '', 'g'),
    '^(\d+(\.\d+)?)(cubic)?(yards?|yds?)(dumpster)?$', '\1'
  );
$$;

do $$
declare
  tenant record;
  entry record;
  item record;
  product record;
  content jsonb;
  original_content jsonb;
  guide_rows jsonb;
  row_data jsonb;
  report jsonb;
  row_reports jsonb;
  included_reports jsonb;
  retired_reports jsonb;
  candidates uuid[];
  duplicate_count integer;
  status_name text;
  outcome text;
  blurb text;
  estimate text;
  examples text;
  matched integer;
  unmatched integer;
  skipped integer;
  cleaned integer;
  entry_exists boolean;
begin
  -- Lock source/target relations so concurrent admin saves cannot race this one-time copy.
  lock table public.dumpster_product_settings, public.tenant_content_entries,
    public.pricing_settings, public.pricing_content_migration_audit in share row exclusive mode;
  for tenant in select id from public.tenants order by id loop
    if exists (select 1 from public.pricing_content_migration_audit where tenant_id = tenant.id) then
      raise notice 'Pricing content tenant %: already migrated (receipt retained)', tenant.id;
      continue;
    end if;
    row_reports := '[]'; included_reports := '[]'; retired_reports := '[]';
    matched := 0; unmatched := 0; skipped := 0;

    -- Inventory all stored retired fields, including legacy aliases and draft values.
    for entry in select key, status, value_json from public.tenant_content_entries
      where tenant_id = tenant.id and key in ('content.pricing.product_content', 'content.pricing.promises')
      order by key, status loop
      if nullif(btrim(coalesce(entry.value_json->>'description', '')), '') is not null
        or nullif(btrim(coalesce(entry.value_json->>'productBody', '')), '') is not null
        or exists (select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(entry.value_json->'featureBullets') = 'array' then entry.value_json->'featureBullets' else '[]' end) v where btrim(v) <> '')
        or exists (select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(entry.value_json->'featureList') = 'array' then entry.value_json->'featureList' else '[]' end) v where btrim(v) <> '') then
        retired_reports := retired_reports || jsonb_build_array(jsonb_build_object(
          'key', entry.key, 'status', entry.status, 'description', entry.value_json->'description',
          'productBody', entry.value_json->'productBody', 'featureBullets', entry.value_json->'featureBullets',
          'featureList', entry.value_json->'featureList'));
      end if;
    end loop;

    -- Only published canonical rows become live product data. Draft and legacy rows are audited separately.
    for entry in select key, status, value_json from public.tenant_content_entries
      where tenant_id = tenant.id and key in ('content.pricing.product_content', 'content.pricing.promises')
      order by key, status loop
      guide_rows := case when jsonb_typeof(entry.value_json #> '{sizeGuide,rows}') = 'array'
        then entry.value_json #> '{sizeGuide,rows}' else '[]'::jsonb end;
      for item in select value, ordinality from jsonb_array_elements(guide_rows) with ordinality loop
        row_data := item.value;
        candidates := array(select id from public.dumpster_product_settings
          where business_id = tenant.id
            and pg_temp.pricing_size_key(dumpster_size) = pg_temp.pricing_size_key(row_data->>'sizeLabel')
            and nullif(btrim(row_data->>'sizeLabel'), '') is not null);
        estimate := nullif(btrim(row_data->>'truckLoadEstimate'), '');
        examples := nullif(btrim(row_data->>'description'), '');
        select count(*) into duplicate_count from jsonb_array_elements(guide_rows) r
          where pg_temp.pricing_size_key(r->>'sizeLabel') = pg_temp.pricing_size_key(row_data->>'sizeLabel');
        if entry.status <> 'published' then outcome := 'skipped_draft';
        elsif entry.key <> 'content.pricing.product_content' then outcome := 'skipped_legacy_source';
        elsif row_data->>'active' = 'false' then outcome := 'skipped_inactive';
        elsif cardinality(candidates) = 0 then outcome := 'unmatched';
        elsif cardinality(candidates) > 1 then outcome := 'ambiguous_products';
        elsif duplicate_count > 1 then outcome := 'ambiguous_rows';
        elsif estimate is null and examples is null then outcome := 'skipped_empty';
        else
          select * into product from public.dumpster_product_settings where id = candidates[1] and business_id = tenant.id;
          if (nullif(btrim(product.truck_load_estimate), '') is not null and estimate is not null and product.truck_load_estimate <> estimate)
            or (nullif(btrim(product.size_guide_examples), '') is not null and examples is not null and product.size_guide_examples <> examples) then
            outcome := 'skipped_existing_product_data';
          else
            update public.dumpster_product_settings set
              truck_load_estimate = coalesce(nullif(btrim(truck_load_estimate), ''), estimate),
              size_guide_examples = coalesce(nullif(btrim(size_guide_examples), ''), examples)
              where id = candidates[1] and business_id = tenant.id;
            outcome := 'matched';
          end if;
        end if;
        if outcome = 'matched' then matched := matched + 1;
        elsif outcome = 'unmatched' then unmatched := unmatched + 1;
        else skipped := skipped + 1; end if;
        row_reports := row_reports || jsonb_build_array(jsonb_build_object(
          'key', entry.key, 'status', entry.status, 'row', item.ordinality,
          'source', row_data, 'candidateProductIds', to_jsonb(candidates), 'outcome', outcome));
      end loop;
    end loop;

    select included_services_blurb into blurb from public.pricing_settings where business_id = tenant.id;
    for status_name in select unnest(array['published', 'draft']) loop
      select value_json into content from public.tenant_content_entries
        where tenant_id = tenant.id and key = 'content.pricing.product_content' and status = status_name;
      entry_exists := found;
      if not entry_exists then
        select value_json into content from public.tenant_content_entries
          where tenant_id = tenant.id and key = 'content.pricing.promises' and status = status_name;
        -- A missing draft should inherit published page copy, never replace it with a partial document.
        if not found and status_name = 'draft' then continue; end if;
      end if;
      original_content := coalesce(content, '{}'::jsonb);
      content := original_content;
      if nullif(btrim(blurb), '') is not null then
        if not exists (select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(content->'includedItems') = 'array' then content->'includedItems' else '[]' end) v where btrim(v) <> '') then
          content := jsonb_set(content, '{includedItems}', jsonb_build_array(blurb));
          outcome := 'copied';
        else
          outcome := 'kept_cms_discarded_global';
        end if;
        if nullif(btrim(content->>'includedHeading'), '') is null then
          content := jsonb_set(content, '{includedHeading}', to_jsonb('What’s included in your rental'::text));
        end if;
        included_reports := included_reports || jsonb_build_array(jsonb_build_object(
          'status', status_name, 'outcome', outcome, 'globalText', blurb));
      end if;
      if (not entry_exists and content <> '{}'::jsonb) or content <> original_content then
        insert into public.tenant_content_entries(tenant_id, key, status, value_json)
          values (tenant.id, 'content.pricing.product_content', status_name, content)
          on conflict (tenant_id, key, status) do update set value_json = excluded.value_json;
      end if;
    end loop;

    update public.dumpster_product_settings set short_description = null
      where business_id = tenant.id
        and short_description = 'Draft defaults based on the current global pricing fallback.';
    get diagnostics cleaned = row_count;
    report := jsonb_build_object('matched', matched, 'unmatched', unmatched, 'skipped', skipped,
      'rows', row_reports, 'includedCopy', included_reports, 'retiredCmsCopy', retired_reports,
      'seededDescriptionsCleared', cleaned);
    insert into public.pricing_content_migration_audit(tenant_id, report) values (tenant.id, report);
    raise notice 'Pricing content tenant %: %', tenant.id, report;
  end loop;
end $$;

notify pgrst, 'reload schema';
commit;
