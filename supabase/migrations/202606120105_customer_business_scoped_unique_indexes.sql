-- Intermediate SaaS/customer uniqueness migration.
--
-- Customers are now business-scoped and customers.business_id is NOT NULL.
-- This migration adds business-scoped unique indexes for customer identity so a
-- later migration can safely drop the legacy global uniqueness on auth_user_id
-- and normalized_email.
--
-- This intentionally does not drop:
-- - customers_auth_user_id_key
-- - customers_normalized_email_key
--
-- normalized_phone remains non-unique because phone numbers can be shared by
-- households, offices, dispatch lines, and property managers.

do $$
declare
  null_business_count bigint;
  duplicate_email_count bigint;
  duplicate_auth_user_count bigint;
begin
  select count(*)
  into null_business_count
  from public.customers
  where business_id is null;

  if null_business_count > 0 then
    raise exception
      'Cannot add business-scoped customer uniqueness: % customers still have null business_id.',
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
      'Cannot add customers_business_id_normalized_email_key: % duplicate business_id + normalized_email groups exist.',
      duplicate_email_count;
  end if;

  select count(*)
  into duplicate_auth_user_count
  from (
    select business_id, auth_user_id
    from public.customers
    where auth_user_id is not null
    group by business_id, auth_user_id
    having count(*) > 1
  ) duplicates;

  if duplicate_auth_user_count > 0 then
    raise exception
      'Cannot add customers_business_id_auth_user_id_key: % duplicate business_id + auth_user_id groups exist.',
      duplicate_auth_user_count;
  end if;
end $$;

create unique index if not exists customers_business_id_normalized_email_key
  on public.customers (business_id, normalized_email)
  where normalized_email is not null;

create unique index if not exists customers_business_id_auth_user_id_key
  on public.customers (business_id, auth_user_id)
  where auth_user_id is not null;

comment on index public.customers_business_id_normalized_email_key is
  'Intermediate Phase 1 SaaS readiness: customer email uniqueness is scoped to a business before legacy global email uniqueness is dropped.';

comment on index public.customers_business_id_auth_user_id_key is
  'Intermediate Phase 1 SaaS readiness: portal auth user uniqueness is scoped to a business before legacy global auth_user_id uniqueness is dropped.';
