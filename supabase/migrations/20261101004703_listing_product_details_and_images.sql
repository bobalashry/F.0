/*
# Product details and listing images

1. Listings: new columns
- `product_name` (optional, 2-120 characters): the specific product being sold.
- `specs` (optional, up to 2000 characters): product specifications.
- `image_paths` (list of up to 8 image file paths, default empty): images stored in the listing-images bucket.

2. Storage: new public bucket `listing-images`
- Images are JPEG, PNG or WEBP, up to 5 MB each.
- Anyone can view images, since listings are public.
- Only the signed-in owner can upload, replace or delete files, and only inside their own folder (named after their user id).

3. Notes
- Existing listings keep working; the new fields start empty.
- Nothing is dropped or changed on existing columns.
*/

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS product_name text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS specs text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS image_paths text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_product_name_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_product_name_check
  CHECK (product_name IS NULL OR char_length(product_name) BETWEEN 2 AND 120);

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_specs_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_specs_check
  CHECK (specs IS NULL OR char_length(specs) <= 2000);

ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_image_paths_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_image_paths_check
  CHECK (cardinality(image_paths) <= 8);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-images',
  'listing-images',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "listing_images_public_read" ON storage.objects;
CREATE POLICY "listing_images_public_read" ON storage.objects
  FOR SELECT TO anon, authenticated
  USING (bucket_id = 'listing-images');

DROP POLICY IF EXISTS "listing_images_owner_insert" ON storage.objects;
CREATE POLICY "listing_images_owner_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "listing_images_owner_update" ON storage.objects;
CREATE POLICY "listing_images_owner_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "listing_images_owner_delete" ON storage.objects;
CREATE POLICY "listing_images_owner_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);
