insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
select
  'retail-site-assets',
  'retail-site-assets',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
where not exists (
  select 1 from storage.buckets where id = 'retail-site-assets'
);
