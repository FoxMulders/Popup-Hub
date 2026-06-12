-- Digital booth contracts: platform defaults + coordinator customization

ALTER TABLE events
  ADD COLUMN IF NOT EXISTS booth_contract_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS booth_contract_clauses JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS booth_contract_pdf_url TEXT,
  ADD COLUMN IF NOT EXISTS booth_contract_updated_at TIMESTAMPTZ;

COMMENT ON COLUMN events.booth_contract_enabled IS
  'When true, vendors must acknowledge the digital booth contract when applying.';
COMMENT ON COLUMN events.booth_contract_clauses IS
  'Ordered booth contract clauses (platform + custom) with enabled flags.';
COMMENT ON COLUMN events.booth_contract_pdf_url IS
  'Optional coordinator-uploaded PDF supplement to the digital booth contract.';
COMMENT ON COLUMN events.booth_contract_updated_at IS
  'Last time the coordinator saved booth contract settings.';

ALTER TABLE booth_applications
  ADD COLUMN IF NOT EXISTS booth_contract_acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS booth_contract_snapshot JSONB;

COMMENT ON COLUMN booth_applications.booth_contract_acknowledged_at IS
  'Timestamp when the vendor accepted the digital booth contract at application submit.';
COMMENT ON COLUMN booth_applications.booth_contract_snapshot IS
  'Frozen copy of clauses and PDF the vendor accepted (audit trail).';

-- Event assets bucket for covers and booth contract PDFs
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'event-assets',
  'event-assets',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "event-assets: public read" ON storage.objects;
CREATE POLICY "event-assets: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'event-assets');

DROP POLICY IF EXISTS "event-assets: coordinator insert own folder" ON storage.objects;
CREATE POLICY "event-assets: coordinator insert own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-assets'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "event-assets: coordinator update own folder" ON storage.objects;
CREATE POLICY "event-assets: coordinator update own folder"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'event-assets'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "event-assets: coordinator delete own folder" ON storage.objects;
CREATE POLICY "event-assets: coordinator delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'event-assets'
    AND (storage.foldername(name))[1] = 'events'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
