-- Final customer uniqueness cleanup for Phase 1 SaaS readiness.
--
-- The business-scoped customer unique indexes were added in the intermediate
-- migration. This migration verifies those indexes exist, then removes the
-- legacy global customer uniqueness so the same customer email/auth user can
-- exist under different businesses while remaining unique within each business.
--
-- This intentionally does not change normalized_phone and does not drop the
-- non-unique customers_business_id_normalized_email_idx helper index.

do $$
begin
  if to_regclass('public.customers_business_id_normalized_email_key') is null then
    raise exception
      'Cannot drop global customer email uniqueness: customers_business_id_normalized_email_key is missing.';
  end if;

  if to_regclass('public.customers_business_id_auth_user_id_key') is null then
    raise exception
      'Cannot drop global customer auth uniqueness: customers_business_id_auth_user_id_key is missing.';
  end if;
end $$;

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_auth_user_id_key'
  ) then
    alter table public.customers
      drop constraint customers_auth_user_id_key;
  else
    raise notice 'customers_auth_user_id_key constraint was not found; checking for an index with the same name.';
  end if;

  if exists (
    select 1
    from pg_class indexes
    join pg_namespace namespaces on namespaces.oid = indexes.relnamespace
    where namespaces.nspname = 'public'
      and indexes.relname = 'customers_auth_user_id_key'
      and indexes.relkind = 'i'
  ) then
    drop index public.customers_auth_user_id_key;
  else
    raise notice 'customers_auth_user_id_key index was not found or was already removed with the constraint.';
  end if;

  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.customers'::regclass
      and conname = 'customers_normalized_email_key'
  ) then
    alter table public.customers
      drop constraint customers_normalized_email_key;
  else
    raise notice 'customers_normalized_email_key constraint was not found; checking for an index with the same name.';
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
  else
    raise notice 'customers_normalized_email_key index was not found or was already removed with the constraint.';
  end if;
end $$;
