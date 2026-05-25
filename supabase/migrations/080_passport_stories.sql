-- Passport stories: short "Behind the Brand" / "Market Promo" clips on public profiles.

CREATE TABLE IF NOT EXISTS passport_stories (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url         TEXT NOT NULL,
  media_type        TEXT NOT NULL CHECK (media_type IN ('video', 'image')),
  duration_seconds  NUMERIC(6, 2),
  story_kind        TEXT NOT NULL DEFAULT 'story'
    CHECK (story_kind IN ('behind_the_brand', 'market_promo', 'story')),
  caption           TEXT CHECK (caption IS NULL OR char_length(caption) <= 200),
  sort_order        INTEGER NOT NULL DEFAULT 0,
  created_by        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_passport_stories_owner
  ON passport_stories(owner_id, sort_order ASC, created_at ASC);

ALTER TABLE passport_stories ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "passport_stories: public read"
    ON passport_stories FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "passport_stories: owner insert"
    ON passport_stories FOR INSERT
    WITH CHECK (auth.uid() = owner_id AND auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "passport_stories: owner delete"
    ON passport_stories FOR DELETE
    USING (auth.uid() = owner_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Reuse market-feed bucket paths under {userId}/passport-stories/ (bucket created in 078)
