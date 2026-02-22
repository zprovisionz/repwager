/*
  # RepWager League Tournament System (Madden-Style)

  ## New/Extended Tables
  - leagues (EXTENDED): Add photo, focus_type, privacy, invite_code, season dates
  - league_members (EXTENDED): Add role, league-specific stats
  - league_chats: League-wide realtime chat
  - league_match_chats: Per-match private chats
  - league_matches: League vs League tournament matches
  - league_settings: Admin config per league

  ## Key Features
  - Public + Private leagues with invite codes
  - Owner/Admin/Member roles with RLS enforcement
  - Realtime league chat + match chat
  - League vs League matchmaking with auto 1v1 splitting
  - Weekly season with auto-reset
  - Points, wins/losses, badges, rewards
*/

-- ───────────────────────────────────────────────────────────────────────────
-- ALTER EXISTING LEAGUES TABLE
-- ───────────────────────────────────────────────────────────────────────────

-- Add new columns to existing leagues table (if it exists, otherwise create full table)
ALTER TABLE IF EXISTS leagues ADD COLUMN photo_url text;
ALTER TABLE IF EXISTS leagues ADD COLUMN focus_type text CHECK (focus_type IN ('casual', 'fitness', 'competitive')) DEFAULT 'fitness';
ALTER TABLE IF EXISTS leagues ADD COLUMN privacy text CHECK (privacy IN ('public', 'private')) DEFAULT 'public';
ALTER TABLE IF EXISTS leagues ADD COLUMN invite_code text UNIQUE;
ALTER TABLE IF EXISTS leagues ADD COLUMN owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE IF EXISTS leagues ADD COLUMN max_members integer DEFAULT 32;
ALTER TABLE IF EXISTS leagues ADD COLUMN entry_fee numeric(10,2) DEFAULT 0;
ALTER TABLE IF EXISTS leagues ADD COLUMN season_start timestamptz DEFAULT now();
ALTER TABLE IF EXISTS leagues ADD COLUMN season_end timestamptz DEFAULT (now() + interval '7 days');

-- If table doesn't exist, create it with all columns:
CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  photo_url text,
  focus_type text NOT NULL CHECK (focus_type IN ('casual', 'fitness', 'competitive')) DEFAULT 'fitness',
  type text CHECK (type IN ('PUBLIC', 'PRIVATE')) DEFAULT 'PUBLIC', -- legacy compatibility
  privacy text CHECK (privacy IN ('public', 'private')) DEFAULT 'public',
  invite_code text UNIQUE,
  season text NOT NULL DEFAULT 'Season 1: Elite',
  owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  max_members integer DEFAULT 32,
  entry_fee numeric(10,2) DEFAULT 0,
  season_start timestamptz DEFAULT now(),
  season_end timestamptz DEFAULT (now() + interval '7 days'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ───────────────────────────────────────────────────────────────────────────
-- ALTER EXISTING LEAGUE_MEMBERS TABLE
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE IF EXISTS league_members ADD COLUMN role text CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member';
ALTER TABLE IF EXISTS league_members ADD COLUMN wins integer DEFAULT 0;
ALTER TABLE IF EXISTS league_members ADD COLUMN losses integer DEFAULT 0;
ALTER TABLE IF EXISTS league_members ADD COLUMN ties integer DEFAULT 0;

-- If table doesn't exist, create it:
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
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

-- ───────────────────────────────────────────────────────────────────────────
-- LEAGUE CHATS (Realtime league-wide messaging)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS league_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read league chats if member"
  ON league_chats FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert league chats if member"
  ON league_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    league_id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- LEAGUE MATCH CHATS (Per-match private chats)
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS league_match_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_match_id uuid NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_match_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read league match chats if in match"
  ON league_match_chats FOR SELECT
  TO authenticated
  USING (
    league_match_id IN (
      SELECT id FROM league_matches
      WHERE (winner_league_id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      ) OR opponent_league_id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      ))
    )
  );

CREATE POLICY "Users can insert league match chats if in match"
  ON league_match_chats FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = auth.uid() AND
    league_match_id IN (
      SELECT id FROM league_matches
      WHERE (winner_league_id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      ) OR opponent_league_id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      ))
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- LEAGUE MATCHES (League vs League tournament matches)
-- ───────────────────────────────────────────────────────────────────────────

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

ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read league matches if in league"
  ON league_matches FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()) OR
    opponent_league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- ───────────────────────────────────────────────────────────────────────────
-- LEAGUE SETTINGS (Admin configuration per league)
-- ───────────────────────────────────────────────────────────────────────────

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

ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read settings of their leagues"
  ON league_settings FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

-- ───────────────────────────────────────────────────────────────────────────
-- INDEXES FOR PERFORMANCE
-- ───────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_leagues_owner_id ON leagues(owner_id);
CREATE INDEX IF NOT EXISTS idx_leagues_privacy_focus ON leagues(privacy, focus_type);
CREATE INDEX IF NOT EXISTS idx_league_members_league_id ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_role ON league_members(league_id, role);
CREATE INDEX IF NOT EXISTS idx_league_chats_league_id_created ON league_chats(league_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_league_matches_league_id ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_opponent ON league_matches(opponent_league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status ON league_matches(league_id, status);
CREATE INDEX IF NOT EXISTS idx_league_matches_scheduled ON league_matches(scheduled_at);

-- ───────────────────────────────────────────────────────────────────────────
-- RLS POLICIES FOR LEAGUES TABLE
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read public leagues"
  ON leagues FOR SELECT
  TO authenticated
  USING (privacy = 'public' OR type = 'PUBLIC');

CREATE POLICY "Users can read private leagues they're in"
  ON leagues FOR SELECT
  TO authenticated
  USING (
    (privacy = 'private' OR type = 'PRIVATE') AND id IN (
      SELECT league_id FROM league_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Owners can update their leagues"
  ON leagues FOR UPDATE
  TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners can delete their leagues"
  ON leagues FOR DELETE
  TO authenticated
  USING (owner_id = auth.uid());

-- ───────────────────────────────────────────────────────────────────────────
-- RLS POLICIES FOR LEAGUE_MEMBERS
-- ───────────────────────────────────────────────────────────────────────────

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can see members of public leagues they're in"
  ON league_members FOR SELECT
  TO authenticated
  USING (
    league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Members can see public league rosters"
  ON league_members FOR SELECT
  TO authenticated
  USING (
    league_id IN (
      SELECT id FROM leagues WHERE privacy = 'public'
    )
  );

CREATE POLICY "Admins can update members"
  ON league_members FOR UPDATE
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE POLICY "Admins can remove members"
  ON league_members FOR DELETE
  TO authenticated
  USING (
    league_id IN (
      SELECT league_id FROM league_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ───────────────────────────────────────────────────────────────────────────
-- SEEDING DATA
-- ───────────────────────────────────────────────────────────────────────────

-- Ensure default public league exists with all fields
INSERT INTO leagues (name, photo_url, focus_type, privacy, season, max_members, entry_fee)
VALUES ('Season 1: Elite', NULL, 'competitive', 'public', 'Season 1: Elite', 999, 0)
ON CONFLICT DO NOTHING;

-- Create default settings for default league
INSERT INTO league_settings (league_id)
SELECT id FROM leagues WHERE name = 'Season 1: Elite'
ON CONFLICT DO NOTHING;
