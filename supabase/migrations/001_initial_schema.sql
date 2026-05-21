-- ============================================================
-- Popup Hub — Initial Schema
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- ── Enums ────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('shopper', 'vendor', 'coordinator');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE booking_mode AS ENUM ('instant', 'juried');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE event_status AS ENUM ('draft', 'published', 'active', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE application_status AS ENUM ('pending', 'approved', 'rejected', 'waitlisted', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE payment_status AS ENUM ('unpaid', 'paid', 'refunded');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE auction_status AS ENUM ('upcoming', 'active', 'ended', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE transaction_type AS ENUM ('deposit', 'withdrawal', 'quarter_drop', 'auction_win', 'refund');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE notification_type AS ENUM (
    'waitlist_triggered',
    'application_approved',
    'application_rejected',
    'auction_won',
    'auction_starting',
    'payment_received'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── profiles ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role        user_role NOT NULL DEFAULT 'shopper',
  full_name   TEXT NOT NULL DEFAULT '',
  email       TEXT NOT NULL DEFAULT '',
  phone       TEXT,
  avatar_url  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles: users read own" ON profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles: users update own" ON profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "profiles: public limited read" ON profiles
  FOR SELECT USING (true);

-- ── categories ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS categories (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name      TEXT NOT NULL UNIQUE,
  icon_url  TEXT
);

ALTER TABLE categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "categories: public read" ON categories
  FOR SELECT USING (true);

CREATE POLICY "categories: admin insert" ON categories
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- ── vendor_passports ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendor_passports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  business_name        TEXT NOT NULL DEFAULT '',
  primary_category_id  UUID REFERENCES categories(id),
  bio                  TEXT NOT NULL DEFAULT '',
  tax_id_encrypted     TEXT,
  logo_url             TEXT,
  item_image_urls      TEXT[] NOT NULL DEFAULT '{}',
  is_verified          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id)
);

ALTER TABLE vendor_passports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "passports: owner full access" ON vendor_passports
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "passports: coordinator read" ON vendor_passports
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

CREATE POLICY "passports: public read verified" ON vendor_passports
  FOR SELECT USING (is_verified = TRUE);

-- ── events ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS events (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coordinator_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  description       TEXT,
  location_name     TEXT NOT NULL DEFAULT '',
  address           TEXT NOT NULL DEFAULT '',
  latitude          DOUBLE PRECISION NOT NULL DEFAULT 0,
  longitude         DOUBLE PRECISION NOT NULL DEFAULT 0,
  start_at          TIMESTAMPTZ NOT NULL,
  end_at            TIMESTAMPTZ NOT NULL,
  booking_mode      booking_mode NOT NULL DEFAULT 'juried',
  status            event_status NOT NULL DEFAULT 'draft',
  cover_image_url   TEXT,
  square_merchant_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT events_dates_check CHECK (end_at > start_at)
);

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events: public read published" ON events
  FOR SELECT USING (status IN ('published', 'active', 'completed'));

CREATE POLICY "events: coordinator full access own" ON events
  FOR ALL USING (
    auth.uid() = coordinator_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'coordinator')
  );

-- ── event_category_limits ────────────────────────────────────
CREATE TABLE IF NOT EXISTS event_category_limits (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id         UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  category_id      UUID NOT NULL REFERENCES categories(id),
  max_slots        INTEGER NOT NULL DEFAULT 0 CHECK (max_slots >= 0),
  price_per_booth  INTEGER NOT NULL DEFAULT 0 CHECK (price_per_booth >= 0),
  UNIQUE (event_id, category_id)
);

ALTER TABLE event_category_limits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ecl: public read" ON event_category_limits
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_category_limits.event_id
        AND events.status IN ('published', 'active')
    )
  );

CREATE POLICY "ecl: coordinator manage own event" ON event_category_limits
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = event_category_limits.event_id
        AND events.coordinator_id = auth.uid()
    )
  );

-- ── booth_applications ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS booth_applications (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id            UUID NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  vendor_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  category_id         UUID NOT NULL REFERENCES categories(id),
  status              application_status NOT NULL DEFAULT 'pending',
  booth_number        INTEGER,
  square_payment_id   TEXT,
  payment_status      payment_status NOT NULL DEFAULT 'unpaid',
  waitlist_position   INTEGER,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at         TIMESTAMPTZ,
  UNIQUE (event_id, vendor_id)
);

ALTER TABLE booth_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "applications: vendor see own" ON booth_applications
  FOR SELECT USING (auth.uid() = vendor_id);

CREATE POLICY "applications: vendor insert own" ON booth_applications
  FOR INSERT WITH CHECK (
    auth.uid() = vendor_id
    AND EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'vendor')
  );

CREATE POLICY "applications: vendor cancel own" ON booth_applications
  FOR UPDATE USING (
    auth.uid() = vendor_id AND status IN ('pending', 'waitlisted')
  );

CREATE POLICY "applications: coordinator manage own event" ON booth_applications
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM events
      WHERE events.id = booth_applications.event_id
        AND events.coordinator_id = auth.uid()
    )
  );

-- ── wallets ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallets (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE UNIQUE,
  balance           INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  paddle_id         TEXT NOT NULL UNIQUE DEFAULT 'P-' || upper(substr(gen_random_uuid()::text, 1, 8)),
  square_customer_id TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wallets: owner full access" ON wallets
  FOR ALL USING (auth.uid() = user_id);

-- ── wallet_transactions ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id         UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type              transaction_type NOT NULL,
  amount            INTEGER NOT NULL,
  square_payment_id TEXT,
  metadata          JSONB NOT NULL DEFAULT '{}',
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wtx: owner read via wallet" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets WHERE wallets.id = wallet_transactions.wallet_id AND wallets.user_id = auth.uid())
  );

-- ── auctions ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auctions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id              UUID REFERENCES events(id) ON DELETE SET NULL,
  coordinator_id        UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                 TEXT NOT NULL,
  item_name             TEXT NOT NULL,
  item_image_url        TEXT,
  status                auction_status NOT NULL DEFAULT 'upcoming',
  timer_duration_seconds INTEGER NOT NULL DEFAULT 60 CHECK (timer_duration_seconds > 0),
  timer_ends_at         TIMESTAMPTZ,
  pot_amount            INTEGER NOT NULL DEFAULT 0 CHECK (pot_amount >= 0),
  min_drop_amount       INTEGER NOT NULL DEFAULT 25 CHECK (min_drop_amount > 0),
  max_drop_amount       INTEGER NOT NULL DEFAULT 100 CHECK (max_drop_amount >= min_drop_amount),
  winning_paddle_id     TEXT,
  winner_user_id        UUID REFERENCES profiles(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auctions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auctions: public read" ON auctions
  FOR SELECT USING (status IN ('upcoming', 'active', 'ended'));

CREATE POLICY "auctions: coordinator manage own" ON auctions
  FOR ALL USING (auth.uid() = coordinator_id);

-- ── auction_drops ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS auction_drops (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auction_id  UUID NOT NULL REFERENCES auctions(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  paddle_id   TEXT NOT NULL,
  amount      INTEGER NOT NULL CHECK (amount > 0),
  dropped_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE auction_drops ENABLE ROW LEVEL SECURITY;

CREATE POLICY "drops: owner read own" ON auction_drops
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "drops: authenticated insert" ON auction_drops
  FOR INSERT WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM auctions WHERE auctions.id = auction_drops.auction_id AND auctions.status = 'active'
    )
  );

CREATE POLICY "drops: public count read" ON auction_drops
  FOR SELECT USING (true);

-- ── notifications ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type        notification_type NOT NULL,
  message     TEXT NOT NULL,
  is_read     BOOLEAN NOT NULL DEFAULT FALSE,
  metadata    JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notifications: owner full access" ON notifications
  FOR ALL USING (auth.uid() = user_id);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_events_status ON events(status);
CREATE INDEX IF NOT EXISTS idx_events_start_at ON events(start_at);
CREATE INDEX IF NOT EXISTS idx_events_coordinator ON events(coordinator_id);
CREATE INDEX IF NOT EXISTS idx_booth_applications_event ON booth_applications(event_id);
CREATE INDEX IF NOT EXISTS idx_booth_applications_vendor ON booth_applications(vendor_id);
CREATE INDEX IF NOT EXISTS idx_booth_applications_status ON booth_applications(status);
CREATE INDEX IF NOT EXISTS idx_auction_drops_auction ON auction_drops(auction_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read);

-- ── Function: get_available_slots ────────────────────────────
-- Returns available slot count per category for an event.
-- Uses advisory lock to prevent race conditions.
CREATE OR REPLACE FUNCTION get_available_slots(p_event_id UUID, p_category_id UUID)
RETURNS TABLE (
  category_id     UUID,
  max_slots       INTEGER,
  approved_count  INTEGER,
  available       INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    ecl.category_id,
    ecl.max_slots,
    COALESCE(approved.cnt, 0)::INTEGER AS approved_count,
    GREATEST(0, ecl.max_slots - COALESCE(approved.cnt, 0))::INTEGER AS available
  FROM event_category_limits ecl
  LEFT JOIN (
    SELECT ba.category_id, COUNT(*)::INTEGER AS cnt
    FROM booth_applications ba
    WHERE ba.event_id = p_event_id
      AND ba.status IN ('approved', 'pending')
    GROUP BY ba.category_id
  ) approved ON approved.category_id = ecl.category_id
  WHERE ecl.event_id = p_event_id
    AND ecl.category_id = p_category_id;
END;
$$;

-- ── Function: handle_new_user ─────────────────────────────────
-- Creates a profile row and wallet when a new auth user signs up.
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role user_role;
BEGIN
  v_role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::user_role,
    'shopper'
  );

  INSERT INTO profiles (id, role, full_name, email)
  VALUES (
    NEW.id,
    v_role,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO wallets (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ── Function: promote_waitlist ────────────────────────────────
-- Auto-promotes the next waitlisted vendor when an approved application is cancelled.
CREATE OR REPLACE FUNCTION promote_waitlist()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_application booth_applications%ROWTYPE;
BEGIN
  IF OLD.status = 'approved' AND NEW.status = 'cancelled' THEN
    SELECT * INTO v_next_application
    FROM booth_applications
    WHERE event_id = NEW.event_id
      AND category_id = NEW.category_id
      AND status = 'waitlisted'
    ORDER BY waitlist_position ASC
    LIMIT 1;

    IF FOUND THEN
      UPDATE booth_applications
      SET status = 'pending', waitlist_position = NULL
      WHERE id = v_next_application.id;

      INSERT INTO notifications (user_id, type, message, metadata)
      VALUES (
        v_next_application.vendor_id,
        'waitlist_triggered',
        'A spot opened up! You''ve been moved from the waitlist — your application is now under review.',
        jsonb_build_object(
          'event_id', NEW.event_id,
          'application_id', v_next_application.id
        )
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_application_cancelled ON booth_applications;
CREATE TRIGGER on_application_cancelled
  AFTER UPDATE OF status ON booth_applications
  FOR EACH ROW EXECUTE FUNCTION promote_waitlist();

-- ── Realtime: enable for live features ───────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE auctions;
ALTER PUBLICATION supabase_realtime ADD TABLE auction_drops;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE booth_applications;
