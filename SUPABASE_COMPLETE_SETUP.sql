-- ============================================================================
-- REPWAGER: COMPLETE SUPABASE DATABASE SETUP
-- ============================================================================
-- Consolidates ALL migrations into one clean, idempotent script.
-- Run this in the Supabase SQL Editor on a fresh project.
-- Safe to re-run: uses IF NOT EXISTS + ON CONFLICT DO NOTHING throughout.
-- ============================================================================

-- ============================================================================
-- 0. EXTENSIONS
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pg_net";      -- HTTP calls from triggers
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";   -- UUID generation

-- ============================================================================
-- 1. UTILITY FUNCTIONS (needed before tables & triggers)
-- ============================================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_level(p_xp integer)
RETURNS integer AS $$
BEGIN
  RETURN CASE
    WHEN p_xp >= 500000 THEN 10
    WHEN p_xp >= 240000 THEN 9
    WHEN p_xp >= 120000 THEN 8
    WHEN p_xp >= 60000  THEN 7
    WHEN p_xp >= 30000  THEN 6
    WHEN p_xp >= 15000  THEN 5
    WHEN p_xp >= 7000   THEN 4
    WHEN p_xp >= 3000   THEN 3
    WHEN p_xp >= 1000   THEN 2
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ============================================================================
-- 2. CORE TABLES
-- ============================================================================

-- ─── PROFILES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username            text        UNIQUE NOT NULL,
  display_name        text        NOT NULL DEFAULT '',
  avatar_gender       text        NOT NULL DEFAULT 'male'         CHECK (avatar_gender IN ('male', 'female')),
  avatar_head         text        NOT NULL DEFAULT 'head_default',
  avatar_torso        text        NOT NULL DEFAULT 'torso_default',
  avatar_legs         text        NOT NULL DEFAULT 'legs_default',
  balance             numeric(10,2) NOT NULL DEFAULT 100.00,
  total_xp            integer     NOT NULL DEFAULT 0,
  current_level       integer     NOT NULL DEFAULT 1,
  current_streak      integer     NOT NULL DEFAULT 0,
  longest_streak      integer     NOT NULL DEFAULT 0,
  last_active_date    date,
  wins                integer     NOT NULL DEFAULT 0,
  losses              integer     NOT NULL DEFAULT 0,
  total_reps          integer     NOT NULL DEFAULT 0,
  casual_match_count  integer     NOT NULL DEFAULT 0,
  onboarding_shown    boolean     NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── MATCHES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matches (
  id                       uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id            uuid          NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
  opponent_id              uuid          REFERENCES profiles(id) ON DELETE RESTRICT,
  exercise_type            text          NOT NULL DEFAULT 'push_ups' CHECK (exercise_type IN ('push_ups', 'squats')),
  wager_amount             numeric(10,2) NOT NULL DEFAULT 0,
  status                   text          NOT NULL DEFAULT 'pending'
                                         CHECK (status IN ('pending','accepted','in_progress','completed','disputed','cancelled')),
  mode                     text          NOT NULL DEFAULT 'competitive' CHECK (mode IN ('competitive', 'casual')),
  challenger_reps          integer       NOT NULL DEFAULT 0,
  opponent_reps            integer       NOT NULL DEFAULT 0,
  winner_id                uuid          REFERENCES profiles(id) ON DELETE SET NULL,
  duration_seconds         integer       NOT NULL DEFAULT 60,
  challenger_ready         boolean       NOT NULL DEFAULT false,
  opponent_ready           boolean       NOT NULL DEFAULT false,
  started_at               timestamptz,
  completed_at             timestamptz,
  expires_at               timestamptz   NOT NULL DEFAULT (now() + interval '24 hours'),
  submission_deadline      timestamptz,
  challenger_submitted_at  timestamptz,
  opponent_submitted_at    timestamptz,
  dispute_reason           text,
  created_at               timestamptz   NOT NULL DEFAULT now(),
  updated_at               timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS matches_updated_at ON matches;
CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── MATCH VIDEOS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS match_videos (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id         uuid        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  storage_path     text        NOT NULL,
  duration_seconds integer,
  created_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE match_videos ENABLE ROW LEVEL SECURITY;

-- ─── TRANSACTIONS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS transactions (
  id           uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  match_id     uuid          REFERENCES matches(id) ON DELETE SET NULL,
  type         text          NOT NULL
               CHECK (type IN ('wager_hold','wager_win','wager_loss','rake_deduction','starting_balance','refund')),
  amount       numeric(10,2) NOT NULL,
  balance_after numeric(10,2) NOT NULL,
  description  text          NOT NULL DEFAULT '',
  created_at   timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- ─── BADGES ──────────────────────────────────────────────────────────────────
-- Combined schema from both migrations (regular + league badges)
CREATE TABLE IF NOT EXISTS badges (
  id              text    PRIMARY KEY,
  name            text    NOT NULL,
  description     text    NOT NULL DEFAULT '',
  icon            text    NOT NULL DEFAULT 'award',
  xp_reward       integer NOT NULL DEFAULT 50,
  rarity          text    NOT NULL DEFAULT 'common' CHECK (rarity IN ('common','rare','epic','legendary')),
  unlock_xp       integer,
  is_league_badge boolean DEFAULT false
);

ALTER TABLE badges ENABLE ROW LEVEL SECURITY;

-- ─── USER BADGES ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_badges (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  badge_id  text        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id)
);

ALTER TABLE user_badges ENABLE ROW LEVEL SECURITY;

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
-- Expanded type list covers all notification types used across the app
CREATE TABLE IF NOT EXISTS notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  type       text        NOT NULL
             CHECK (type IN (
               'match_challenge','match_accepted','match_completed',
               'badge_earned','dispute_filed','dispute_resolved',
               'opponent_submitted','new_challenge',
               'inactivity_nudge','streak_reminder'
             )),
  title      text        NOT NULL,
  body       text        NOT NULL,
  data       jsonb       DEFAULT '{}',
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- ─── PUSH TOKENS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_tokens (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token      text        NOT NULL,
  platform   text        NOT NULL DEFAULT 'unknown',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_id, token)
);

ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;

-- ─── PRACTICE SESSIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS practice_sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  exercise_type    text        NOT NULL CHECK (exercise_type IN ('push_ups', 'squats')),
  reps             integer     NOT NULL CHECK (reps >= 0),
  duration_seconds integer     NOT NULL DEFAULT 60,
  notes            text        DEFAULT '',
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS practice_sessions_updated_at ON practice_sessions;
CREATE TRIGGER practice_sessions_updated_at
  BEFORE UPDATE ON practice_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── THEATRE NOTES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS theatre_notes (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id   uuid        NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  notes      text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id, user_id)
);

ALTER TABLE theatre_notes ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS theatre_notes_updated_at ON theatre_notes;
CREATE TRIGGER theatre_notes_updated_at
  BEFORE UPDATE ON theatre_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================================
-- 3. LEAGUE TABLES
-- ============================================================================

-- ─── LEAGUES ─────────────────────────────────────────────────────────────────
-- Full combined schema from all league migrations
CREATE TABLE IF NOT EXISTS leagues (
  id               uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  name             text          NOT NULL,
  photo_url        text,
  focus_type       text          CHECK (focus_type IN ('casual','fitness','competitive')) DEFAULT 'fitness',
  type             text          CHECK (type IN ('PUBLIC','PRIVATE')) DEFAULT 'PUBLIC',  -- legacy
  privacy          text          CHECK (privacy IN ('public','private')) DEFAULT 'public',
  invite_code      text          UNIQUE,
  season           text          NOT NULL DEFAULT 'Season 1: Elite',
  owner_id         uuid          REFERENCES auth.users(id) ON DELETE SET NULL,
  max_members      integer       DEFAULT 32,
  entry_fee        numeric(10,2) DEFAULT 0,
  season_start     timestamptz   DEFAULT now(),
  season_end       timestamptz   DEFAULT (now() + interval '7 days'),
  playoff_enabled  boolean       DEFAULT true,
  playoff_size     integer       DEFAULT 8 CHECK (playoff_size IN (4, 8, 16)),
  playoff_start_at timestamptz,
  playoff_winner_id uuid         REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at       timestamptz   NOT NULL DEFAULT now(),
  updated_at       timestamptz   NOT NULL DEFAULT now()
);

ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;

DROP TRIGGER IF EXISTS leagues_updated_at ON leagues;
CREATE TRIGGER leagues_updated_at
  BEFORE UPDATE ON leagues
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ─── LEAGUE MEMBERS ───────────────────────────────────────────────────────────
-- Full combined schema from all league migrations
CREATE TABLE IF NOT EXISTS league_members (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id           uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id             uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role                text        CHECK (role IN ('owner','admin','member')) DEFAULT 'member',
  points              integer     NOT NULL DEFAULT 0,
  rank                integer,
  wins                integer     DEFAULT 0,
  losses              integer     DEFAULT 0,
  ties                integer     DEFAULT 0,
  league_level        integer     DEFAULT 1,
  league_title        text,
  league_xp           integer     DEFAULT 0,
  is_playoff_champion boolean     DEFAULT false,
  joined_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(league_id, user_id)
);

ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- ─── LEAGUE SETTINGS ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_settings (
  id                       uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id                uuid        NOT NULL UNIQUE REFERENCES leagues(id) ON DELETE CASCADE,
  allow_member_invites     boolean     DEFAULT true,
  require_approval         boolean     DEFAULT false,
  auto_kick_inactive_days  integer     DEFAULT 14,
  weekly_reset_day         text        DEFAULT 'SUNDAY',
  min_members_for_match    integer     DEFAULT 4,
  created_at               timestamptz NOT NULL DEFAULT now(),
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_settings ENABLE ROW LEVEL SECURITY;

-- ─── LEAGUE MATCHES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_matches (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id          uuid          NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  opponent_league_id uuid          NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  status             text          NOT NULL DEFAULT 'pending'
                                   CHECK (status IN ('pending','ongoing','completed','cancelled')),
  scheduled_at       timestamptz   NOT NULL,
  winner_league_id   uuid          REFERENCES leagues(id) ON DELETE SET NULL,
  league_a_points    integer       DEFAULT 0,
  league_b_points    integer       DEFAULT 0,
  exercise_type      text          NOT NULL DEFAULT 'push_ups',
  wager_amount       numeric(10,2) NOT NULL DEFAULT 0,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  completed_at       timestamptz
);

ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;

-- ─── LEAGUE CHATS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_chats (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id  uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message    text        NOT NULL CHECK (char_length(message) <= 500),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_chats ENABLE ROW LEVEL SECURITY;

-- ─── LEAGUE MATCH CHATS ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS league_match_chats (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_match_id  uuid        NOT NULL REFERENCES league_matches(id) ON DELETE CASCADE,
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  message          text        NOT NULL,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE league_match_chats ENABLE ROW LEVEL SECURITY;

-- ─── PLAYOFF MATCHES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS playoff_matches (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id    uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  round_number integer     NOT NULL CHECK (round_number >= 1),
  round_name   text        NOT NULL,   -- "Quarterfinals" | "Semifinals" | "Finals"
  match_id     uuid        REFERENCES matches(id) ON DELETE SET NULL,
  seed_a       integer     NOT NULL,
  seed_b       integer     NOT NULL,
  winner_seed  integer,
  status       text        NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending','ongoing','completed')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

ALTER TABLE playoff_matches ENABLE ROW LEVEL SECURITY;

-- ─── USER LEAGUE BADGES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_league_badges (
  id        uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  league_id uuid        NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  badge_id  text        NOT NULL REFERENCES badges(id) ON DELETE CASCADE,
  earned_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, league_id, badge_id)
);

ALTER TABLE user_league_badges ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 4. INDEXES
-- ============================================================================

-- profiles
CREATE INDEX IF NOT EXISTS idx_profiles_level             ON profiles(current_level);

-- matches
CREATE INDEX IF NOT EXISTS idx_matches_challenger          ON matches(challenger_id);
CREATE INDEX IF NOT EXISTS idx_matches_opponent            ON matches(opponent_id);
CREATE INDEX IF NOT EXISTS idx_matches_status              ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_mode                ON matches(mode);
CREATE INDEX IF NOT EXISTS idx_matches_submission_deadline ON matches(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_matches_challenger_submitted ON matches(challenger_submitted_at);
CREATE INDEX IF NOT EXISTS idx_matches_opponent_submitted   ON matches(opponent_submitted_at);

-- transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions(user_id);

-- notifications
CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, read);

-- badges / user_badges
CREATE INDEX IF NOT EXISTS idx_user_badges_user ON user_badges(user_id);

-- push_tokens
CREATE INDEX IF NOT EXISTS idx_push_tokens_user_id ON push_tokens(user_id);

-- practice_sessions
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user     ON practice_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_date      ON practice_sessions(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_exercise  ON practice_sessions(user_id, exercise_type);

-- leagues
CREATE INDEX IF NOT EXISTS idx_leagues_owner_id            ON leagues(owner_id);
CREATE INDEX IF NOT EXISTS idx_leagues_privacy_focus       ON leagues(privacy, focus_type);

-- league_members
CREATE INDEX IF NOT EXISTS idx_league_members_league_id    ON league_members(league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user_id      ON league_members(user_id);
CREATE INDEX IF NOT EXISTS idx_league_members_role         ON league_members(league_id, role);
CREATE INDEX IF NOT EXISTS idx_league_members_rank         ON league_members(league_id, rank);
CREATE INDEX IF NOT EXISTS idx_league_members_points       ON league_members(league_id, points DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_level        ON league_members(league_id, league_level DESC);
CREATE INDEX IF NOT EXISTS idx_league_members_xp           ON league_members(league_id, league_xp DESC);

-- league_chats
CREATE INDEX IF NOT EXISTS idx_league_chats_league_created ON league_chats(league_id, created_at DESC);

-- league_matches
CREATE INDEX IF NOT EXISTS idx_league_matches_league_id    ON league_matches(league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_opponent     ON league_matches(opponent_league_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_status       ON league_matches(league_id, status);
CREATE INDEX IF NOT EXISTS idx_league_matches_scheduled    ON league_matches(scheduled_at);

-- playoff_matches
CREATE INDEX IF NOT EXISTS idx_playoff_matches_league_round ON playoff_matches(league_id, round_number);
CREATE INDEX IF NOT EXISTS idx_playoff_matches_status       ON playoff_matches(league_id, status);

-- ============================================================================
-- 5. ROW LEVEL SECURITY POLICIES
-- ============================================================================
-- Uses DO blocks with EXCEPTION to be idempotent (safe to re-run)

-- ─── profiles ────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own profile"
    ON profiles FOR SELECT TO authenticated USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read other profiles for match display"
    ON profiles FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE TO authenticated
    USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── matches ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Participants can read their matches"
    ON matches FOR SELECT TO authenticated
    USING (auth.uid() = challenger_id OR auth.uid() = opponent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can see pending matches"
    ON matches FOR SELECT TO authenticated USING (status = 'pending');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Challenger can create match"
    ON matches FOR INSERT TO authenticated WITH CHECK (auth.uid() = challenger_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can update their matches"
    ON matches FOR UPDATE TO authenticated
    USING (auth.uid() = challenger_id OR auth.uid() = opponent_id)
    WITH CHECK (auth.uid() = challenger_id OR auth.uid() = opponent_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── match_videos ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Match participants can view videos"
    ON match_videos FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM matches
        WHERE matches.id = match_videos.match_id
        AND (matches.challenger_id = auth.uid() OR matches.opponent_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own video"
    ON match_videos FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── transactions ────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own transactions"
    ON transactions FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── badges ──────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Anyone can read badges"
    ON badges FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── user_badges ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own badges"
    ON user_badges FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read others badges"
    ON user_badges FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── notifications ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own notifications"
    ON notifications FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own notifications"
    ON notifications FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── push_tokens ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can view own push tokens"
    ON push_tokens FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own push tokens"
    ON push_tokens FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own push tokens"
    ON push_tokens FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── practice_sessions ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own practice sessions"
    ON practice_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert own practice sessions"
    ON practice_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can update own practice sessions"
    ON practice_sessions FOR UPDATE TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can delete own practice sessions"
    ON practice_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── theatre_notes ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can manage own theatre notes"
    ON theatre_notes FOR ALL TO authenticated
    USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── leagues ─────────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Anyone can read public leagues"
    ON leagues FOR SELECT TO authenticated
    USING (privacy = 'public' OR type = 'PUBLIC');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can read private leagues they are in"
    ON leagues FOR SELECT TO authenticated
    USING (
      (privacy = 'private' OR type = 'PRIVATE') AND id IN (
        SELECT league_id FROM league_members WHERE user_id = auth.uid()
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can update their leagues"
    ON leagues FOR UPDATE TO authenticated
    USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Owners can delete their leagues"
    ON leagues FOR DELETE TO authenticated USING (owner_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert leagues"
    ON leagues FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── league_members ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Members can see members of public leagues"
    ON league_members FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT id FROM leagues WHERE privacy = 'public' OR type = 'PUBLIC')
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Members can see members of leagues they are in"
    ON league_members FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can join leagues"
    ON league_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can update members"
    ON league_members FOR UPDATE TO authenticated
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
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Admins can remove members"
    ON league_members FOR DELETE TO authenticated
    USING (
      user_id = auth.uid() OR  -- users can leave
      league_id IN (
        SELECT league_id FROM league_members
        WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── league_settings ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read settings of their leagues"
    ON league_settings FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── league_matches ───────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read league matches if in league"
    ON league_matches FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid()) OR
      opponent_league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── league_chats ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read league chats if member"
    ON league_chats FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert league chats if member"
    ON league_chats FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid() AND
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── league_match_chats ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read league match chats if in league"
    ON league_match_chats FOR SELECT TO authenticated
    USING (
      league_match_id IN (
        SELECT id FROM league_matches
        WHERE league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
           OR opponent_league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Users can insert league match chats if in league"
    ON league_match_chats FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid() AND
      league_match_id IN (
        SELECT id FROM league_matches
        WHERE league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
           OR opponent_league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── playoff_matches ─────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Members can read playoff matches in their league"
    ON playoff_matches FOR SELECT TO authenticated
    USING (
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── user_league_badges ───────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE POLICY "Users can read own or league member badges"
    ON user_league_badges FOR SELECT TO authenticated
    USING (
      user_id = auth.uid() OR
      league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- 6. BUSINESS LOGIC FUNCTIONS
-- ============================================================================

-- ─── new_user_profile ────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION new_user_profile(
  p_user_id      uuid,
  p_username     text,
  p_display_name text,
  p_avatar_gender text DEFAULT 'male'
)
RETURNS profiles AS $$
DECLARE v_profile profiles;
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_gender, balance)
  VALUES (p_user_id, p_username, p_display_name, p_avatar_gender, 100.00)
  RETURNING * INTO v_profile;

  INSERT INTO transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'starting_balance', 100.00, 100.00, 'Welcome bonus — starting balance');

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── accept_match ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION accept_match(
  p_match_id   uuid,
  p_opponent_id uuid
)
RETURNS matches AS $$
DECLARE
  v_match     matches;
  v_opponent  profiles;
  v_challenger profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status != 'pending' THEN RAISE EXCEPTION 'Match is not pending'; END IF;
  IF v_match.challenger_id = p_opponent_id THEN RAISE EXCEPTION 'Cannot accept your own challenge'; END IF;

  SELECT * INTO v_opponent  FROM profiles WHERE id = p_opponent_id       FOR UPDATE;
  SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;

  IF v_opponent.balance  < v_match.wager_amount THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
  IF v_challenger.balance < v_match.wager_amount THEN RAISE EXCEPTION 'Challenger has insufficient balance'; END IF;

  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = p_opponent_id;
  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = v_match.challenger_id;

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
    (p_opponent_id,       p_match_id, 'wager_hold', -v_match.wager_amount,
     v_opponent.balance  - v_match.wager_amount, 'Wager held for match'),
    (v_match.challenger_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     v_challenger.balance - v_match.wager_amount, 'Wager held for match');

  UPDATE matches SET
    status = 'accepted',
    opponent_id = p_opponent_id,
    submission_deadline = now() + interval '2 hours',
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data) VALUES
    (v_match.challenger_id, 'match_accepted', 'Challenge Accepted!',
     v_opponent.username || ' accepted your challenge. Record your reps within 2 hours!',
     jsonb_build_object('match_id', p_match_id));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── submit_match_score ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_match_score(
  p_match_id uuid,
  p_user_id  uuid,
  p_reps     integer
)
RETURNS matches AS $$
DECLARE
  v_match          matches;
  v_is_challenger  boolean;
  v_winner_id      uuid;
  v_loser_id       uuid;
  v_gross_pot      numeric(10,2);
  v_rake           numeric(10,2);
  v_net_win        numeric(10,2);
  v_xp_win         integer := 100;
  v_xp_loss        integer := 25;
  v_xp_multiplier  numeric := 1.0;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status != 'accepted' THEN RAISE EXCEPTION 'Match is not in accepted state (status: %)', v_match.status; END IF;
  IF v_match.submission_deadline IS NULL OR now() > v_match.submission_deadline THEN
    RAISE EXCEPTION 'Submission deadline has passed';
  END IF;

  v_is_challenger := p_user_id = v_match.challenger_id;
  IF NOT v_is_challenger AND p_user_id != v_match.opponent_id THEN
    RAISE EXCEPTION 'User is not a participant in this match';
  END IF;

  IF v_is_challenger AND v_match.challenger_ready THEN RAISE EXCEPTION 'Challenger has already submitted'; END IF;
  IF NOT v_is_challenger AND v_match.opponent_ready THEN RAISE EXCEPTION 'Opponent has already submitted'; END IF;

  IF v_is_challenger THEN
    UPDATE matches SET challenger_reps = p_reps, challenger_ready = true, challenger_submitted_at = now()
    WHERE id = p_match_id;
  ELSE
    UPDATE matches SET opponent_reps = p_reps, opponent_ready = true, opponent_submitted_at = now()
    WHERE id = p_match_id;
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  -- Auto-resolve when both submitted
  IF v_match.challenger_ready AND v_match.opponent_ready THEN
    v_winner_id := CASE
      WHEN v_match.challenger_reps >= v_match.opponent_reps THEN v_match.challenger_id
      ELSE v_match.opponent_id
    END;
    v_loser_id := CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;

    v_xp_multiplier := CASE WHEN v_match.mode = 'competitive' THEN 1.5 ELSE 1.0 END;
    v_xp_win  := ROUND(v_xp_win  * v_xp_multiplier)::integer;
    v_xp_loss := ROUND(v_xp_loss * v_xp_multiplier)::integer;

    v_gross_pot := v_match.wager_amount * 2;
    v_rake      := ROUND(v_gross_pot * 0.10, 2);
    v_net_win   := v_gross_pot - v_rake;

    UPDATE profiles SET
      balance = balance + v_net_win,
      wins = wins + 1,
      total_xp = total_xp + v_xp_win,
      current_level = calculate_level(total_xp + v_xp_win),
      total_reps = total_reps + CASE WHEN v_match.challenger_id = v_winner_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END
    WHERE id = v_winner_id;

    UPDATE profiles SET
      losses = losses + 1,
      total_xp = total_xp + v_xp_loss,
      current_level = calculate_level(total_xp + v_xp_loss),
      total_reps = total_reps + CASE WHEN v_match.challenger_id = v_loser_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END
    WHERE id = v_loser_id;

    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
      (v_winner_id, p_match_id, 'wager_win', v_net_win,
       (SELECT balance FROM profiles WHERE id = v_winner_id), 'Won async match — net prize after 10% rake'),
      (v_winner_id, p_match_id, 'rake_deduction', -v_rake,
       (SELECT balance FROM profiles WHERE id = v_winner_id), 'Platform rake (10%)'),
      (v_loser_id, p_match_id, 'wager_loss', 0,
       (SELECT balance FROM profiles WHERE id = v_loser_id), 'Lost async match — wager forfeited');

    UPDATE matches SET status = 'completed', winner_id = v_winner_id, completed_at = now(), updated_at = now()
    WHERE id = p_match_id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES
      (v_winner_id, 'match_completed', 'You Won!',
       'You got ' || (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || ' reps. Won $' || v_net_win::text || '! +' || v_xp_win::text || ' XP',
       jsonb_build_object('match_id', p_match_id, 'won', true, 'xp_gained', v_xp_win)),
      (v_loser_id, 'match_completed', 'Match Over',
       'Better luck next time! +' || v_xp_loss::text || ' XP',
       jsonb_build_object('match_id', p_match_id, 'won', false, 'xp_gained', v_xp_loss));
  END IF;

  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── complete_match ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION complete_match(
  p_match_id        uuid,
  p_winner_id       uuid,
  p_challenger_reps integer,
  p_opponent_reps   integer
)
RETURNS matches AS $$
DECLARE
  v_match          matches;
  v_winner         profiles;
  v_loser          profiles;
  v_loser_id       uuid;
  v_gross_pot      numeric(10,2);
  v_rake           numeric(10,2);
  v_net_win        numeric(10,2);
  v_xp_win         integer := 100;
  v_xp_loss        integer := 25;
  v_xp_multiplier  numeric := 1.0;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status NOT IN ('accepted', 'in_progress') THEN
    RAISE EXCEPTION 'Match cannot be completed in status: %', v_match.status;
  END IF;

  v_xp_multiplier := CASE WHEN v_match.mode = 'competitive' THEN 1.5 ELSE 1.0 END;
  v_xp_win  := ROUND(v_xp_win  * v_xp_multiplier)::integer;
  v_xp_loss := ROUND(v_xp_loss * v_xp_multiplier)::integer;

  v_loser_id := CASE WHEN p_winner_id = v_match.challenger_id THEN v_match.opponent_id ELSE v_match.challenger_id END;

  v_gross_pot := v_match.wager_amount * 2;
  v_rake      := ROUND(v_gross_pot * 0.10, 2);
  v_net_win   := v_gross_pot - v_rake;

  SELECT * INTO v_winner FROM profiles WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO v_loser  FROM profiles WHERE id = v_loser_id  FOR UPDATE;

  UPDATE profiles SET
    balance = balance + v_net_win,
    wins = wins + 1,
    total_xp = total_xp + v_xp_win,
    current_level = calculate_level(total_xp + v_xp_win),
    total_reps = total_reps + CASE WHEN id = v_match.challenger_id THEN p_challenger_reps ELSE p_opponent_reps END
  WHERE id = p_winner_id;

  UPDATE profiles SET
    losses = losses + 1,
    total_xp = total_xp + v_xp_loss,
    current_level = calculate_level(total_xp + v_xp_loss),
    total_reps = total_reps + CASE WHEN id = v_match.challenger_id THEN p_challenger_reps ELSE p_opponent_reps END
  WHERE id = v_loser_id;

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
    (p_winner_id, p_match_id, 'wager_win',      v_net_win,  v_winner.balance + v_net_win, 'Won match — net prize after 10% rake'),
    (p_winner_id, p_match_id, 'rake_deduction', -v_rake,    v_winner.balance + v_net_win, 'Platform rake (10%)'),
    (v_loser_id,  p_match_id, 'wager_loss',     0,          v_loser.balance,              'Lost match — wager forfeited');

  UPDATE matches SET
    status = 'completed', winner_id = p_winner_id,
    challenger_reps = p_challenger_reps, opponent_reps = p_opponent_reps,
    completed_at = now(), updated_at = now()
  WHERE id = p_match_id RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data) VALUES
    (p_winner_id, 'match_completed', 'You Won!',
     'You won the match and earned $' || v_net_win::text || '! +' || v_xp_win::text || ' XP',
     jsonb_build_object('match_id', p_match_id, 'won', true,  'xp_gained', v_xp_win)),
    (v_loser_id,  'match_completed', 'Match Over',
     'You lost this one. Better luck next time! +' || v_xp_loss::text || ' XP',
     jsonb_build_object('match_id', p_match_id, 'won', false, 'xp_gained', v_xp_loss));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── cancel_match ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_match(p_match_id uuid)
RETURNS matches AS $$
DECLARE
  v_match      matches;
  v_challenger profiles;
  v_opponent   profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status IN ('completed', 'cancelled') THEN
    RAISE EXCEPTION 'Cannot cancel a % match', v_match.status;
  END IF;

  IF v_match.status IN ('accepted', 'in_progress') THEN
    SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;
    UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.challenger_id;
    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
      (v_match.challenger_id, p_match_id, 'refund', v_match.wager_amount,
       v_challenger.balance + v_match.wager_amount, 'Match cancelled — wager refunded');

    IF v_match.opponent_id IS NOT NULL THEN
      SELECT * INTO v_opponent FROM profiles WHERE id = v_match.opponent_id FOR UPDATE;
      UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.opponent_id;
      INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
        (v_match.opponent_id, p_match_id, 'refund', v_match.wager_amount,
         v_opponent.balance + v_match.wager_amount, 'Match cancelled — wager refunded');
    END IF;
  END IF;

  UPDATE matches SET status = 'cancelled', updated_at = now()
  WHERE id = p_match_id RETURNING * INTO v_match;

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── handle_expired_matches ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION handle_expired_matches()
RETURNS void AS $$
DECLARE v_match matches%ROWTYPE;
BEGIN
  FOR v_match IN
    SELECT * FROM matches
    WHERE status = 'accepted'
      AND submission_deadline < now()
      AND NOT (challenger_ready AND opponent_ready)
  LOOP
    UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.challenger_id;
    UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.opponent_id;

    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description) VALUES
      (v_match.challenger_id, v_match.id, 'refund', v_match.wager_amount,
       (SELECT balance FROM profiles WHERE id = v_match.challenger_id), 'Match expired — full refund'),
      (v_match.opponent_id, v_match.id, 'refund', v_match.wager_amount,
       (SELECT balance FROM profiles WHERE id = v_match.opponent_id), 'Match expired — full refund');

    UPDATE matches SET status = 'cancelled', updated_at = now() WHERE id = v_match.id;

    INSERT INTO notifications (user_id, type, title, body, data) VALUES
      (v_match.challenger_id, 'match_completed', 'Match Expired',
       'Opponent did not submit in time. Wager refunded.',
       jsonb_build_object('match_id', v_match.id, 'expired', true)),
      (v_match.opponent_id, 'match_completed', 'Match Expired',
       'You did not submit in time. Wager refunded.',
       jsonb_build_object('match_id', v_match.id, 'expired', true));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── record_practice_session ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_practice_session(
  p_user_id      uuid,
  p_exercise_type text,
  p_reps         integer,
  p_notes        text DEFAULT ''
)
RETURNS practice_sessions AS $$
DECLARE
  v_session  practice_sessions;
  v_xp_gain  integer;
BEGIN
  v_xp_gain := p_reps;  -- 1 XP per rep

  INSERT INTO practice_sessions (user_id, exercise_type, reps, notes)
  VALUES (p_user_id, p_exercise_type, p_reps, p_notes)
  RETURNING * INTO v_session;

  UPDATE profiles SET
    total_xp = total_xp + v_xp_gain,
    current_level = calculate_level(total_xp + v_xp_gain),
    total_reps = total_reps + p_reps
  WHERE id = p_user_id;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 7. LEADERBOARD FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION get_competitive_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  rank         integer,
  user_id      uuid,
  username     text,
  display_name text,
  current_level integer,
  total_xp     integer,
  wins         integer,
  losses       integer,
  total_reps   integer,
  avatar_gender text,
  avatar_head   text,
  avatar_torso  text,
  avatar_legs   text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_xp DESC, p.created_at ASC)::integer,
    p.id, p.username, p.display_name, p.current_level,
    p.total_xp, p.wins, p.losses, p.total_reps,
    p.avatar_gender, p.avatar_head, p.avatar_torso, p.avatar_legs
  FROM profiles p
  ORDER BY p.total_xp DESC, p.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_casual_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  rank            integer,
  user_id         uuid,
  username        text,
  display_name    text,
  current_level   integer,
  total_xp        integer,
  wins            integer,
  losses          integer,
  total_reps      integer,
  avatar_gender   text,
  avatar_head     text,
  avatar_torso    text,
  avatar_legs     text,
  recent_activity timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(MAX(m.completed_at), p.updated_at) DESC, p.total_xp DESC)::integer,
    p.id, p.username, p.display_name, p.current_level,
    p.total_xp, p.wins, p.losses, p.total_reps,
    p.avatar_gender, p.avatar_head, p.avatar_torso, p.avatar_legs,
    COALESCE(MAX(m.completed_at), p.updated_at)
  FROM profiles p
  LEFT JOIN matches m ON (p.id = m.challenger_id OR p.id = m.opponent_id)
    AND m.mode = 'casual' AND m.status = 'completed'
  GROUP BY p.id, p.username, p.display_name, p.current_level, p.total_xp,
           p.wins, p.losses, p.total_reps,
           p.avatar_gender, p.avatar_head, p.avatar_torso, p.avatar_legs, p.updated_at
  ORDER BY COALESCE(MAX(m.completed_at), p.updated_at) DESC, p.total_xp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS TABLE(
  level              integer,
  current_xp         integer,
  next_level_xp      integer,
  xp_progress        numeric,
  wins               integer,
  losses             integer,
  win_rate           numeric,
  total_reps         integer,
  practice_count     integer,
  best_practice_reps integer,
  matches_completed  integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.current_level,
    p.total_xp,
    CASE p.current_level
      WHEN 9 THEN 500000 WHEN 8 THEN 240000 WHEN 7 THEN 120000
      WHEN 6 THEN 60000  WHEN 5 THEN 30000  WHEN 4 THEN 15000
      WHEN 3 THEN 7000   WHEN 2 THEN 3000   WHEN 1 THEN 1000
      ELSE 500000
    END,
    CASE WHEN p.current_level < 10 THEN
      ROUND(
        (p.total_xp - CASE p.current_level
          WHEN 9 THEN 240000 WHEN 8 THEN 120000 WHEN 7 THEN 60000
          WHEN 6 THEN 30000  WHEN 5 THEN 15000  WHEN 4 THEN 7000
          WHEN 3 THEN 3000   WHEN 2 THEN 1000   ELSE 0
        END)::numeric /
        NULLIF(CASE p.current_level
          WHEN 9 THEN 260000 WHEN 8 THEN 120000 WHEN 7 THEN 60000
          WHEN 6 THEN 30000  WHEN 5 THEN 15000  WHEN 4 THEN 7000
          WHEN 3 THEN 3000   WHEN 2 THEN 1000   ELSE 1000
        END, 0), 2)
    ELSE 1.0
    END,
    p.wins,
    p.losses,
    ROUND(p.wins::numeric / NULLIF(p.wins + p.losses, 0) * 100, 1),
    p.total_reps,
    (SELECT COUNT(*)::integer FROM practice_sessions WHERE user_id = p_user_id),
    COALESCE((SELECT MAX(reps) FROM practice_sessions WHERE user_id = p_user_id), 0),
    (SELECT COUNT(*)::integer FROM matches
     WHERE (challenger_id = p_user_id OR opponent_id = p_user_id) AND status = 'completed')
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. PUSH NOTIFICATION TRIGGER
-- ============================================================================
-- Requires pg_net extension and app.supabase_url / app.supabase_anon_key set.
-- Set these via: ALTER DATABASE postgres SET app.supabase_url = 'https://...';
--                ALTER DATABASE postgres SET app.supabase_anon_key = 'ey...';
-- Fails gracefully if pg_net or settings are unavailable.

CREATE OR REPLACE FUNCTION notify_push_on_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_url      text;
  v_anon_key text;
BEGIN
  BEGIN
    v_url      := current_setting('app.supabase_url',      true);
    v_anon_key := current_setting('app.supabase_anon_key', true);
  EXCEPTION WHEN OTHERS THEN RETURN NEW;
  END;

  IF v_url IS NULL OR v_anon_key IS NULL THEN RETURN NEW; END IF;

  BEGIN
    PERFORM net.http_post(
      url     := v_url || '/functions/v1/send-push-notification',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || v_anon_key
      ),
      body    := jsonb_build_object(
        'user_id', NEW.user_id,
        'title',   NEW.title,
        'body',    NEW.body,
        'data',    NEW.data
      )
    );
  EXCEPTION WHEN OTHERS THEN NULL;
  END;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_push ON notifications;
CREATE TRIGGER trg_notify_push
  AFTER INSERT ON notifications
  FOR EACH ROW EXECUTE FUNCTION notify_push_on_insert();

-- ============================================================================
-- 9. SEED DATA
-- ============================================================================

-- ─── Standard Badges ─────────────────────────────────────────────────────────
INSERT INTO badges (id, name, description, icon, xp_reward, rarity) VALUES
  ('first_pushup',  'First Blood',    'Complete your first push-up match',            'zap',          50,  'common'),
  ('first_squat',   'Leg Day',        'Complete your first squat match',              'zap',          50,  'common'),
  ('first_win',     'First Victory',  'Win your first match',                         'trophy',       75,  'common'),
  ('pushup_centurion', 'Centurion',   'Score 100 push-ups in a single match',         'shield',       200, 'rare'),
  ('squat_master',  'Squat Master',   'Score 100 squats in a single match',           'shield',       200, 'rare'),
  ('hot_streak',    'Hot Streak',     'Win 3 matches in a row',                       'flame',        150, 'rare'),
  ('unstoppable',   'Unstoppable',    'Win 10 matches in a row',                      'crown',        500, 'epic'),
  ('high_roller',   'High Roller',    'Wager $50 or more in a single match',          'dollar-sign',  100, 'rare'),
  ('big_winner',    'Big Winner',     'Accumulate $500 in total winnings',            'trophy',       300, 'epic'),
  ('rep_legend',    'Rep Legend',     'Complete 1,000 total reps across all matches', 'award',        400, 'epic'),
  ('veteran',       'Veteran',        'Complete 50 total matches',                    'star',         300, 'rare'),
  ('flawless',      'Flawless',       'Win a match with double your opponent''s reps','crown',        250, 'epic')
ON CONFLICT (id) DO NOTHING;

-- ─── League Badges ───────────────────────────────────────────────────────────
INSERT INTO badges (id, name, description, icon, xp_reward, rarity, is_league_badge) VALUES
  ('league_mvp',              'League MVP',         'Most points in league this week',  '🏆', 300, 'epic',      true),
  ('league_undefeated',       'Undefeated Week',    'Won all matches this league week',  '🔥', 300, 'epic',      true),
  ('league_playoff_champion', 'Playoff Champion',   'Won the playoff bracket',           '👑', 500, 'legendary', true),
  ('league_veteran',          'League Veteran',     'Reached level 3 in your league',   '⭐', 150, 'rare',      true),
  ('league_legend',           'League Legend',      'Reached level 5 in your league',   '✨', 400, 'epic',      true)
ON CONFLICT (id) DO NOTHING;

-- ─── Default Season League ────────────────────────────────────────────────────
INSERT INTO leagues (name, photo_url, focus_type, type, privacy, season, max_members, entry_fee)
VALUES ('Season 1: Elite', NULL, 'competitive', 'PUBLIC', 'public', 'Season 1: Elite', 999, 0)
ON CONFLICT DO NOTHING;

INSERT INTO league_settings (league_id)
SELECT id FROM leagues WHERE name = 'Season 1: Elite'
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 10. STORAGE BUCKET
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'match-videos',
  'match-videos',
  false,
  524288000,  -- 500 MB
  ARRAY['video/mp4', 'video/quicktime', 'video/webm']
) ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "Participants can upload match videos"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'match-videos' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "Participants can read match videos"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'match-videos' AND
      auth.uid()::text = (storage.foldername(name))[1]
    );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================================
-- DONE! All tables, functions, policies, indexes, and seed data are applied.
-- ============================================================================
