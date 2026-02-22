/*
  # Leagues System

  ## Overview
  Adds support for seasonal leagues and leaderboards where users compete for points.

  ## New Tables

  ### leagues
  - Represents a seasonal league (e.g., Season 1: Elite)
  - Contains league metadata like name, type (PUBLIC/PRIVATE), season info
  - Type: PUBLIC for global leaderboards, PRIVATE for group challenges

  ### league_members
  - Junction table linking users to leagues
  - Tracks points earned, rank within league, and join date
  - Points calculated as: 10 * (1 + opponent_level * 0.5)

  ## Security
  - RLS enabled on all tables
  - Users can read public leagues and their own league data
  - League writes restricted to backend functions only
*/

-- ─── LEAGUES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('PUBLIC', 'PRIVATE')),
  season text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public leagues"
  ON leagues FOR SELECT
  TO authenticated
  USING (type = 'PUBLIC');

CREATE POLICY "Users can read their private leagues"
  ON leagues FOR SELECT
  TO authenticated
  USING (
    type = 'PRIVATE' AND id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ─── LEAGUE MEMBERS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  points integer NOT NULL DEFAULT 0,
  rank integer,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read league members for public leagues"
  ON league_members FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE type = 'PUBLIC'
    )
  );

CREATE POLICY "Users can read their league members"
  ON league_members FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Backend can insert/update/delete league members"
  ON league_members
  TO service_role
  USING (true);

-- ─── INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX idx_league_members_league_id ON league_members(league_id);
CREATE INDEX idx_league_members_user_id ON league_members(user_id);
CREATE INDEX idx_league_members_rank ON league_members(league_id, rank);
CREATE INDEX idx_league_members_points ON league_members(league_id, points DESC);

-- ─── SEED DATA ────────────────────────────────────────────────────────────
-- Insert the default public league for Season 1
INSERT INTO leagues (name, type, season)
VALUES ('Season 1: Elite', 'PUBLIC', 'Season 1: Elite')
ON CONFLICT DO NOTHING;
