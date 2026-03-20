ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expo_push_token text;
-- Add expo push token to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS push_enabled boolean NOT NULL DEFAULT true;

-- Index for fast lookup when sending pushes
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON profiles (expo_push_token)
  WHERE expo_push_token IS NOT NULL;
