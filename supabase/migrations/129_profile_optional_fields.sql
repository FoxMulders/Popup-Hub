-- Optional private profile fields (distinct from public passport).

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS city TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS province TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS bio_short TEXT;

COMMENT ON COLUMN profiles.preferred_name IS 'Optional display name for private account context.';
COMMENT ON COLUMN profiles.city IS 'Optional home city for alerts and personalization.';
COMMENT ON COLUMN profiles.province IS 'Optional province/state code or name.';
COMMENT ON COLUMN profiles.bio_short IS 'Optional private note — not shown on public passport.';
