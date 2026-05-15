-- Product-specific customer-facing bullets rendered on public pricing and booking cards.
alter table public.dumpster_product_settings
  add column if not exists customer_bullet_points text;
