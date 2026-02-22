/*
  # League Playoffs & Prestige System

  ## New Features
  1. Multi-round playoff bracket (single-elimination)
     - Auto-generated after season reset
     - Quarterfinals → Semifinals → Finals
     - Top 8 or 16 members qualify (configurable)

  2. League-specific progression
     - league_level: 1-5+ (tracks prestige)
     - league_title: Veteran, Legend, etc.
     - Separate XP track (league_xp)
     - League-only badges: MVP, Undefeated, Champion

  ## New Columns
  - league_members: league_level, league_title, league_xp, is_playoff_champion
  - leagues: playoff_enabled, playoff_size (8 or 16)

  ## New Tables
  - playoff_matches: Bracket structure (round, seed, winner)
*/

-- ────────────────────────────────────────────────────────────────────────────
-- LEAGUE MEMBERS: ADD PROGRESSION COLUMNS
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE league_members ADD COLUMN IF NOT EXISTS league_level integer DEFAULT 1;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS league_title text;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS league_xp integer DEFAULT 0;
ALTER TABLE league_members ADD COLUMN IF NOT EXISTS is_playoff_champion boolean DEFAULT false;

-- ────────────────────────────────────────────────────────────────────────────
-- LEAGUES: ADD PLAYOFF CONFIG
-- ────────────────────────────────────────────────────────────────────────────

ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_enabled boolean DEFAULT true;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_size integer DEFAULT 8 CHECK (playoff_size IN (4, 8, 16));
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_start_at timestamptz;
ALTER TABLE leagues ADD COLUMN IF NOT EXISTS playoff_winner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- PLAYOFF MATCHES: Track bracket progress
-- ────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS playoff_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round_number integer NOT NULL CHECK (round_number >= 1),
  round_name text NOT NULL, -- "Quarterfinals", "Semifinals", "Finals"
  match_id uuid REFERENCES matches(id) ON DELETE SET NULL, -- Links to actual async match
  seed_a integer NOT NULL, -- Seeding (1-8 or 1-16)
  seed_b integer NOT NULL,
  winner_seed integer, -- Which seed won (a or b)
  status text NOT NULL CHECK (status IN ('pending', 'ongoing', 'completed')) DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE playoff_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can read playoff matches in their league"
  ON playoff_matches FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- ────────────────────────────────────────────────────────────────────────────
-- LEAGUE BADGES: New badge types (league-specific)
-- ────────────────────────────────────────────────────────────────────────────

-- Add to existing badges table (assumes badges table exists)
-- If not, create it:
CREATE TABLE IF NOT EXISTS badges (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text,
  icon text,
  unlock_xp integer DEFAULT 0,
  is_league_badge boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Insert league badge types
INSERT INTO badges (id, name, description, icon, is_league_badge) VALUES
  ('league_mvp', 'League MVP', 'Most points in league this week', '🏆', true),
  ('league_undefeated', 'Undefeated Week', 'Won all matches this league week', '🔥', true),
  ('league_playoff_champion', 'Playoff Champion', 'Won playoff bracket', '👑', true),
  ('league_veteran', 'League Veteran', 'Reached level 3 in league', '⭐', true),
  ('league_legend', 'League Legend', 'Reached level 5 in league', '✨', true)
ON CONFLICT DO NOTHING;

-- ────────────────────────────────────────────────────────────────────────────
-- LINK USER BADGES TO LEAGUES (optional: for league-specific badge tracking)
-- ────────────────────────────────────────────────────────────────────────────

-- If you want to track which league a badge was earned in:
CREATE TABLE IF NOT EXISTS user_league_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  badge_id text NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, league_id, badge_id)
);

ALTER TABLE user_league_badges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own league badges"
  ON user_league_badges FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR league_id IN (
    SELECT league_id FROM league_members WHERE user_id = auth.uid()
  ));

-- ────────────────────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_playoff_matches_league_round ON playoff_matches(league_id, round_number);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_status ON playoff_matches(league_id, status);
CREATE INDEX IF NOT EXISTS idx_league_members_level ON league_members(league_id, league_level DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_xp ON league_members(league_id, league_xp DESC);
