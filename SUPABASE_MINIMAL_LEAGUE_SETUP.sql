-- ============================================================================
-- MINIMAL LEAGUE SYSTEM SETUP FOR SUPABASE
-- ============================================================================
-- Run this in Supabase SQL Editor if the full migrations fail
-- This creates the absolute minimum tables needed for league system to work
-- ============================================================================

-- 1. CREATE LEAGUES TABLE
CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  focus_type text CHECK (focus_type IN ('casual', 'fitness', 'competitive')) DEFAULT 'fitness',
  privacy text CHECK (privacy IN ('public', 'private')) DEFAULT 'public',
  invite_code text UNIQUE,
  season text NOT NULL DEFAULT 'Season 1: Elite',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_members integer DEFAULT 32,
  entry_fee numeric(10,2) DEFAULT 0,
  season_start timestamptz DEFAULT now(),
  season_end timestamptz DEFAULT (now() + interval '7 days'),
  playoff_enabled boolean DEFAULT true,
  playoff_size integer DEFAULT 8 CHECK (playoff_size IN (4, 8, 16)),
  playoff_start_at timestamptz,
  playoff_winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. CREATE LEAGUE_MEMBERS TABLE
CREATE TABLE IF NOT EXISTS league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  points integer NOT NULL DEFAULT 0,
  rank integer,
  wins integer DEFAULT 0,
  losses integer DEFAULT 0,
  ties integer DEFAULT 0,
  league_level integer DEFAULT 1,
  league_title text,
  league_xp integer DEFAULT 0,
  is_playoff_champion boolean DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

-- 3. CREATE LEAGUE_MATCHES TABLE
CREATE TABLE IF NOT EXISTS league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  opponent_league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('pending', 'ongoing', 'completed', 'cancelled')) DEFAULT 'pending',
  scheduled_at timestamptz NOT NULL,
  winner_league_id uuid REFERENCES leagues(id) ON DELETE SET NULL,
  league_a_points integer DEFAULT 0,
  league_b_points integer DEFAULT 0,
  exercise_type text NOT NULL DEFAULT 'push_ups',
  wager_amount numeric(10,2) NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 4. CREATE LEAGUE_CHATS TABLE
CREATE TABLE IF NOT EXISTS league_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. CREATE LEAGUE_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS league_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  allow_member_invites boolean DEFAULT true,
  require_approval boolean DEFAULT false,
  auto_kick_inactive_days integer DEFAULT 14,
  weekly_reset_day text DEFAULT 'SUNDAY',
  min_members_for_match integer DEFAULT 4,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. CREATE PLAYOFF_MATCHES TABLE
CREATE TABLE IF NOT EXISTS playoff_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  round_name text NOT NULL,
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL,
  seed_a integer NOT NULL,
  seed_b integer NOT NULL,
  winner_seed integer,
  status text NOT NULL CHECK (status IN ('pending', 'ongoing', 'completed')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 7. CREATE USER_LEAGUE_BADGES TABLE
CREATE TABLE IF NOT EXISTS user_league_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  badge_id text NOT NULL,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, league_id, badge_id)
);

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE playoff_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_league_badges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================================

-- LEAGUES: Anyone can read public leagues
CREATE POLICY IF NOT EXISTS "Anyone can read public leagues"
  ON leagues FOR SELECT
  TO authenticated
  USING (privacy = 'public');

-- LEAGUES: Users can read private leagues they're in
CREATE POLICY IF NOT EXISTS "Users can read private leagues they are in"
  ON leagues FOR SELECT
  TO authenticated
  USING (
    privacy = 'private' AND id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- LEAGUES: Owners can update their leagues
CREATE POLICY IF NOT EXISTS "Owners can update their leagues"
  ON leagues FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

-- LEAGUE_MEMBERS: Members can see members of leagues they're in
CREATE POLICY IF NOT EXISTS "Members can see league members"
  ON league_members FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- LEAGUE_CHATS: Members can read league chats
CREATE POLICY IF NOT EXISTS "Members can read league chats"
  ON league_chats FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- LEAGUE_CHATS: Members can insert league chats
CREATE POLICY IF NOT EXISTS "Members can insert league chats"
  ON league_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- LEAGUE_MATCHES: Members can read matches
CREATE POLICY IF NOT EXISTS "Members can read league matches"
  ON league_matches FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()) OR
    opponent_league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- PLAYOFF_MATCHES: Members can read playoff matches
CREATE POLICY IF NOT EXISTS "Members can read playoff matches"
  ON playoff_matches FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- ============================================================================
-- CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_leagues_owner_id ON leagues(owner_id);
CREATE INDEX IF NOT EXISTS idx_leagues_privacy_focus ON leagues(privacy, focus_type);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_level ON league_members(league_id, league_level DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_xp ON league_members(league_id, league_xp DESC);
CREATE INDEX IF NOT EXISTS idx_league_chats_league_id_created ON league_chats(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_league_matches_league_id ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_opponent ON league_matches(opponent_league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON league_matches(league_id, status);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_league_round ON playoff_matches(league_id, round_number);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_status ON playoff_matches(league_id, status);

-- ============================================================================
-- SEED DEFAULT LEAGUE
-- ============================================================================

INSERT INTO leagues (name, photo_url, focus_type, privacy, season, max_members, entry_fee)
VALUES ('Season 1: Elite', NULL, 'competitive', 'public', 'Season 1: Elite', 999, 0)
ON CONFLICT DO NOTHING;

-- Create default settings for default league
INSERT INTO league_settings (league_id)
SELECT id FROM leagues WHERE name = 'Season 1: Elite'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- DONE!
-- ============================================================================
-- All tables created with minimal setup
-- The league system is now ready to use
