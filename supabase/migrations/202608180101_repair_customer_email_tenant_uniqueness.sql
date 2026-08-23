-- Repair customer email uniqueness for tenant-backed checkout.
--
-- Older hosted databases can still have the legacy global
-- customers_normalized_email_key index/constraint from the original customer
-- portal schema. Customers are now business-scoped, so normalized email must be
-- unique per business rather than globally unique across all tenants.

do $$
declare
  null_business_count bigint;
  duplicate_email_count bigint;
begin
  select count(*)
  into null_business_count
  from public.customers
  where business_id is null;

  if null_business_count > 0 then
    raise exception
      'Cannot repair customer email uniqueness: % customers still have null business_id.',
      null_business_count;
  end if;

  select count(*)
  into duplicate_email_count
  from (
    select business_id, normalized_email
    from public.customers
    where normalized_email is not null
    group by business_id, normalized_email
    having count(*) > 1
  ) duplicates;

  if duplicate_email_count > 0 then
    raise exception
      'Cannot repair customer email uniqueness: % duplicate business_id + normalized_email groups exist.',
      duplicate_email_count;
  end if;
end $$;

create unique index if not exists customers_business_id_normalized_email_key
  on public.customers (business_id, normalized_email)
  where normalized_email is not null;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_normalized_email_key'
  ) then
    alter table public.customers
      drop constraint customers_normalized_email_key;
  end if;

  if exists (
    select 1
    from pg_class indexes
    join pg_namespace namespaces on namespaces.oid = indexes.relnamespace
    where namespaces.nspname = 'public'
      and indexes.relname = 'customers_normalized_email_key'
      and indexes.relkind = 'i'
  ) then
    drop index public.customers_normalized_email_key;
  end if;
end $$;

comment on index public.customers_business_id_normalized_email_key is
  'Customer normalized email uniqueness is scoped to a business so the same email can belong to multiple tenants.';
