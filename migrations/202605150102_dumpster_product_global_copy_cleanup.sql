-- Global base-price copy now belongs in pricing_settings.included_services_blurb.
-- Remove the legacy seeded sentence only where it leaked into product-specific fields.
update public.dumpster_product_settings
set short_description = null
where short_description = 'Includes delivery, pickup, and the standard weight allowance.';

update public.dumpster_product_settings
set customer_bullet_points = null
where customer_bullet_points = 'Includes delivery, pickup, and the standard weight allowance.';
