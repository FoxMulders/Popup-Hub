-- Revocable opaque tokens for native home-screen widgets (WidgetKit / Glance).
-- Raw tokens are never stored — only SHA-256 hashes.

CREATE TABLE IF NOT EXISTS widget_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  label text NOT NULL DEFAULT 'native-widget',
  last_used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (token_hash)
);

ALTER TABLE widget_tokens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "widget_tokens: owner all" ON widget_tokens;
CREATE POLICY "widget_tokens: owner all" ON widget_tokens
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_widget_tokens_user
  ON widget_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_widget_tokens_active
  ON widget_tokens(user_id)
  WHERE revoked_at IS NULL;
