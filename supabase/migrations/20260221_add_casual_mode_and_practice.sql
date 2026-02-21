/*
  # Phase 1 & 2: Casual Mode, Leveling, and Practice Sessions

  ## Changes:
  1. Add `mode` enum column to matches (competitive | casual)
  2. Add `current_level` integer column to profiles
  3. Create `practice_sessions` table for tracking solo practice reps
  4. Add indexes for performance on new columns
*/

-- ─── ADD MODE FIELD TO MATCHES ──────────────────────────────────────────────
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS mode text NOT NULL DEFAULT 'competitive'
CHECK (mode IN ('competitive', 'casual'));

CREATE INDEX IF NOT EXISTS idx_matches_mode ON matches(mode);

-- ─── ADD CURRENT_LEVEL TO PROFILES ──────────────────────────────────────────
ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS current_level integer NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(current_level);

-- ─── PRACTICE SESSIONS TABLE ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_type text NOT NULL CHECK (exercise_type IN ('push_ups', 'squats')),
  reps integer NOT NULL CHECK (reps >= 0),
  duration_seconds integer NOT NULL DEFAULT 60,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own practice sessions"
  ON practice_sessions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own practice sessions"
  ON practice_sessions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own practice sessions"
  ON practice_sessions FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own practice sessions"
  ON practice_sessions FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── INDEXES ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date ON practice_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_exercise ON practice_sessions(user_id, exercise_type);

-- ─── UPDATED_AT TRIGGER FOR PRACTICE_SESSIONS ───────────────────────────────
CREATE TRIGGER practice_sessions_updated_at
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
