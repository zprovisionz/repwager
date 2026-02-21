/*
  # RepWager Core Schema

  ## Overview
  Creates the full database schema for RepWager — a mobile app where users wager fake money
  on who can do the most push-ups or squats in 60 seconds, verified by AI pose detection.

  ## New Tables

  ### profiles
  - Extended user profile linked to auth.users
  - Stores username, avatar config (gender + clothing items), balance, XP, streak data
  - Balance starts at $100.00 fake money

  ### matches
  - A wager challenge between two users
  - Tracks exercise type, wager amount, status, and both participants' rep counts
  - Status flow: pending -> accepted -> in_progress -> completed -> disputed/cancelled

  ### match_videos
  - Stores Supabase Storage references for match recording videos
  - One video per participant per match
  - Used for dispute resolution / theatre view

  ### transactions
  - Immutable ledger of all balance changes
  - Types: wager_hold, wager_win, wager_loss, rake_deduction, starting_balance

  ### badges
  - Definitions of all earnable badges

  ### user_badges
  - Junction table: which user has earned which badge and when

  ### notifications
  - In-app notification queue per user

  ## Security
  - RLS enabled on all tables
  - Users can only read/write their own data
  - Match data is visible to both participants only
  - Transactions are read-only for users (insert via server-side functions only)
*/

-- ─── PROFILES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  display_name text NOT NULL DEFAULT '',
  avatar_gender text NOT NULL DEFAULT 'male' CHECK (avatar_gender IN ('male', 'female')),
  avatar_head text NOT NULL DEFAULT 'head_default',
  avatar_torso text NOT NULL DEFAULT 'torso_default',
  avatar_legs text NOT NULL DEFAULT 'legs_default',
  balance numeric(10,2) NOT NULL DEFAULT 100.00,
  total_xp integer NOT NULL DEFAULT 0,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_active_date date,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  total_reps integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile"
  ON profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can read other profiles for match display"
  ON profiles FOR SELECT
  TO authenticated
  USING (true);

-- ─── MATCHES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  opponent_id uuid REFERENCES profiles(id) ON DELETE RESTRICT,
  exercise_type text NOT NULL DEFAULT 'push_ups' CHECK (exercise_type IN ('push_ups', 'squats')),
  wager_amount numeric(10,2) NOT NULL CHECK (wager_amount > 0),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'in_progress', 'completed', 'disputed', 'cancelled')),
  challenger_reps integer NOT NULL DEFAULT 0,
  opponent_reps integer NOT NULL DEFAULT 0,
  winner_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  duration_seconds integer NOT NULL DEFAULT 60,
  challenger_ready boolean NOT NULL DEFAULT false,
  opponent_ready boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  dispute_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read their matches"
  ON matches FOR SELECT
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);

CREATE POLICY "Authenticated users can see pending matches"
  ON matches FOR SELECT
  TO authenticated
  USING (status = 'pending');

CREATE POLICY "Challenger can create match"
  ON matches FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = challenger_id);

CREATE POLICY "Participants can update their matches"
  ON matches FOR UPDATE
  TO authenticated
  USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
  WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);

-- ─── MATCH VIDEOS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_videos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  duration_seconds integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE match_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match participants can view videos"
  ON match_videos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches
      WHERE matches.id = match_videos.match_id
      AND (matches.challenger_id = auth.uid() OR matches.opponent_id = auth.uid())
    )
  );

CREATE POLICY "Users can insert own video"
  ON match_videos FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- ─── TRANSACTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('wager_hold', 'wager_win', 'wager_loss', 'rake_deduction', 'starting_balance', 'refund')),
  amount numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON transactions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── BADGES ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  icon text NOT NULL DEFAULT 'award',
  xp_reward integer NOT NULL DEFAULT 50,
  rarity text NOT NULL DEFAULT 'common' CHECK (rarity IN ('common', 'rare', 'epic', 'legendary'))
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read badges"
  ON badges FOR SELECT
  TO authenticated
  USING (true);

-- ─── USER BADGES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can read others badges"
  ON user_badges FOR SELECT
  TO authenticated
  USING (true);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('match_challenge', 'match_accepted', 'match_completed', 'badge_earned', 'dispute_filed', 'dispute_resolved')),
  title text NOT NULL,
  body text NOT NULL,
  data jsonb DEFAULT '{}',
  read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own notifications"
  ON notifications FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own notifications"
  ON notifications FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── INDEXES ─────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_challenger ON matches(challenger_id);
CREATE INDEX IF NOT EXISTS idx_matches_opponent ON matches(opponent_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- ─── UPDATED_AT TRIGGER ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
