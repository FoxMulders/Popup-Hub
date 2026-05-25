-- Meet the Maker: event-wide live feed for checked-in patrons.

CREATE TABLE IF NOT EXISTS market_feed_posts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id        UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id       UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url       TEXT NOT NULL,
  media_type      TEXT NOT NULL CHECK (media_type IN ('image', 'video')),
  caption         TEXT NOT NULL CHECK (char_length(caption) BETWEEN 1 AND 1000),
  likes_count     INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0),
  comments_count  INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_feed_posts_event
  ON market_feed_posts(event_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_market_feed_posts_vendor
  ON market_feed_posts(vendor_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_feed_post_likes (
  post_id     UUID NOT NULL REFERENCES market_feed_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (post_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_market_feed_post_likes_user
  ON market_feed_post_likes(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS market_feed_post_comments (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id     UUID NOT NULL REFERENCES market_feed_posts(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_market_feed_post_comments_post
  ON market_feed_post_comments(post_id, created_at ASC);

ALTER TABLE market_feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_feed_post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_feed_post_comments ENABLE ROW LEVEL SECURITY;

-- Sync denormalized like count
CREATE OR REPLACE FUNCTION sync_market_feed_post_likes_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE market_feed_posts
      SET likes_count = likes_count + 1, updated_at = NOW()
      WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE market_feed_posts
      SET likes_count = GREATEST(0, likes_count - 1), updated_at = NOW()
      WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_feed_post_likes_count ON market_feed_post_likes;
CREATE TRIGGER trg_market_feed_post_likes_count
  AFTER INSERT OR DELETE ON market_feed_post_likes
  FOR EACH ROW EXECUTE FUNCTION sync_market_feed_post_likes_count();

CREATE OR REPLACE FUNCTION sync_market_feed_post_comments_count()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE market_feed_posts
      SET comments_count = comments_count + 1, updated_at = NOW()
      WHERE id = NEW.post_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE market_feed_posts
      SET comments_count = GREATEST(0, comments_count - 1), updated_at = NOW()
      WHERE id = OLD.post_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_market_feed_post_comments_count ON market_feed_post_comments;
CREATE TRIGGER trg_market_feed_post_comments_count
  AFTER INSERT OR DELETE ON market_feed_post_comments
  FOR EACH ROW EXECUTE FUNCTION sync_market_feed_post_comments_count();

-- RLS: posts readable by checked-in patrons, post vendors, and coordinators
DO $$ BEGIN
  CREATE POLICY "market_feed_posts: feed read"
    ON market_feed_posts FOR SELECT
    USING (
      EXISTS (
        SELECT 1 FROM market_patron_check_ins mpci
        WHERE mpci.event_id = market_feed_posts.event_id
          AND mpci.user_id = auth.uid()
      )
      OR vendor_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM events e
        WHERE e.id = market_feed_posts.event_id
          AND e.coordinator_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_posts: vendor insert"
    ON market_feed_posts FOR INSERT
    WITH CHECK (
      vendor_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM booth_applications ba
        WHERE ba.event_id = market_feed_posts.event_id
          AND ba.vendor_id = auth.uid()
          AND ba.status = 'approved'
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_posts: vendor delete own"
    ON market_feed_posts FOR DELETE
    USING (vendor_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_post_likes: read"
    ON market_feed_post_likes FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_post_likes: checked-in insert"
    ON market_feed_post_likes FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM market_feed_posts p
        JOIN market_patron_check_ins mpci
          ON mpci.event_id = p.event_id AND mpci.user_id = auth.uid()
        WHERE p.id = market_feed_post_likes.post_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_post_likes: delete own"
    ON market_feed_post_likes FOR DELETE
    USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_post_comments: read"
    ON market_feed_post_comments FOR SELECT
    USING (TRUE);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "market_feed_post_comments: checked-in insert"
    ON market_feed_post_comments FOR INSERT
    WITH CHECK (
      auth.uid() = user_id
      AND EXISTS (
        SELECT 1 FROM market_feed_posts p
        JOIN market_patron_check_ins mpci
          ON mpci.event_id = p.event_id AND mpci.user_id = auth.uid()
        WHERE p.id = market_feed_post_comments.post_id
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Public media bucket for feed clips and spotlights (max ~15 MB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'market-feed',
  'market-feed',
  true,
  15728640,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'video/mp4', 'video/webm']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "market-feed: public read" ON storage.objects;
CREATE POLICY "market-feed: public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'market-feed');

DROP POLICY IF EXISTS "market-feed: vendor insert own folder" ON storage.objects;
CREATE POLICY "market-feed: vendor insert own folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'market-feed'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "market-feed: vendor delete own folder" ON storage.objects;
CREATE POLICY "market-feed: vendor delete own folder"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'market-feed'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
