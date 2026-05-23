-- Vendor logo and product photo storage (public read, authenticated write in own folder)

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendor-assets',
  'vendor-assets',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "vendor-assets: public read" ON storage.objects;
CREATE POLICY "vendor-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'vendor-assets');

DROP POLICY IF EXISTS "vendor-assets: user insert own folder" ON storage.objects;
CREATE POLICY "vendor-assets: user insert own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vendor-assets: user update own folder" ON storage.objects;
CREATE POLICY "vendor-assets: user update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "vendor-assets: user delete own folder" ON storage.objects;
CREATE POLICY "vendor-assets: user delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'vendor-assets'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
