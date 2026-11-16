begin;
-- Run scripts/migrate-product-positions.ts after this schema migration and before deploying.
-- JavaScript's localeCompare (the old retail comparator) cannot be replaced by SQL collation.
alter table public.dumpster_product_settings add column if not exists position integer check (position > 0);
comment on column public.dumpster_product_settings.sort_order is 'DEPRECATED: retained for rollback and one-time Node backfill only. Application ordering uses position.';
comment on column public.dumpster_product_settings.position is 'Tenant-wide 1-based order; null only until the Node backfill completes.';
create unique index if not exists dumpster_product_position_unique on public.dumpster_product_settings(business_id, position) where position is not null;

create table if not exists public.dumpster_product_order_migrations (
 business_id uuid primary key references public.tenants(id),
 snapshot jsonb not null,
 created_at timestamptz not null default now()
);
alter table public.dumpster_product_order_migrations enable row level security;
revoke all on public.dumpster_product_order_migrations from public, anon, authenticated, service_role;
grant select, insert on public.dumpster_product_order_migrations to service_role;

create or replace function public.append_dumpster_product_position() returns trigger
language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
 perform 1 from public.tenants where id=new.business_id for update;
 select coalesce(max(position),0)+1 into new.position from public.dumpster_product_settings where business_id=new.business_id;
 return new;
end $$;
revoke all on function public.append_dumpster_product_position() from public, anon, authenticated;
grant execute on function public.append_dumpster_product_position() to service_role;
drop trigger if exists append_dumpster_product_position on public.dumpster_product_settings;
create trigger append_dumpster_product_position before insert on public.dumpster_product_settings for each row execute function public.append_dumpster_product_position();

create or replace function public.ensure_dumpster_product_positions(p_business_id uuid, p_products jsonb) returns void
language plpgsql set search_path = pg_catalog, public, pg_temp as $$
declare item jsonb;
begin
 perform 1 from public.tenants where id=p_business_id for update;
 if not found then raise exception 'Unknown business'; end if;
 for item in select value from jsonb_array_elements(p_products) loop
  -- Candidates come from active inventory on the server. Never update an existing product's visibility or content.
  if exists (select 1 from public.dumpster_product_settings p where p.business_id=p_business_id and (
    lower(regexp_replace(btrim(p.dumpster_size),'\s+',' ','g'))=lower(regexp_replace(btrim(item->>'dumpster_size'),'\s+',' ','g')) or
    (nullif(substring(btrim(p.dumpster_size) from '^(\d+)')::numeric,0) = nullif(substring(btrim(item->>'dumpster_size') from '^(\d+)')::numeric,0))
  )) then continue; end if;
  insert into public.dumpster_product_settings(id,business_id,dumpster_size,dumpster_product_id,display_name,is_public,
   base_price,extra_day_price,included_weight_tons,included_rental_days)
  values(coalesce((item->>'id')::uuid,gen_random_uuid()),p_business_id,item->>'dumpster_size',item->>'dumpster_product_id',item->>'display_name',true,
   (item->>'base_price')::numeric,(item->>'extra_day_price')::numeric,(item->>'included_weight_tons')::numeric,(item->>'included_rental_days')::integer)
  on conflict (business_id,dumpster_size) do nothing;
 end loop;
end $$;
revoke all on function public.ensure_dumpster_product_positions(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.ensure_dumpster_product_positions(uuid,jsonb) to service_role;

create or replace function public.reorder_dumpster_products(p_business_id uuid, p_ids uuid[]) returns void
language plpgsql set search_path = pg_catalog, public, pg_temp as $$
declare total integer;
begin
 perform 1 from public.tenants where id=p_business_id for update;
 if not found then raise exception 'Unknown business'; end if;
 select count(*) into total from public.dumpster_product_settings where business_id=p_business_id;
 if p_ids is null or cardinality(p_ids)<>total or
    (select count(distinct id) from unnest(p_ids) id)<>total or
    (select count(*) from public.dumpster_product_settings where business_id=p_business_id and id=any(p_ids))<>total then
  raise exception 'Product list changed or contains invalid IDs. Refresh and try again.';
 end if;
 -- Release unique positions inside this transaction; concurrent readers see only the committed order.
 update public.dumpster_product_settings set position=null where business_id=p_business_id;
 update public.dumpster_product_settings p set position=ordered.ordinality
 from unnest(p_ids) with ordinality ordered(id,ordinality)
 where p.business_id=p_business_id and p.id=ordered.id;
end $$;
revoke all on function public.reorder_dumpster_products(uuid,uuid[]) from public, anon, authenticated;
grant execute on function public.reorder_dumpster_products(uuid,uuid[]) to service_role;

create or replace function public.initialize_dumpster_product_positions(p_business_id uuid,p_ids uuid[],p_snapshot jsonb,p_products jsonb default '[]') returns void
language plpgsql set search_path = pg_catalog, public, pg_temp as $$
begin
 perform 1 from public.tenants where id=p_business_id for update;
 if exists(select 1 from public.dumpster_product_order_migrations where business_id=p_business_id) then return; end if;
 perform public.ensure_dumpster_product_positions(p_business_id,p_products);
 perform public.reorder_dumpster_products(p_business_id,p_ids);
 insert into public.dumpster_product_order_migrations(business_id,snapshot) values(p_business_id,p_snapshot);
end $$;
revoke all on function public.initialize_dumpster_product_positions(uuid,uuid[],jsonb,jsonb) from public, anon, authenticated;
grant execute on function public.initialize_dumpster_product_positions(uuid,uuid[],jsonb,jsonb) to service_role;
notify pgrst,'reload schema';
commit;
