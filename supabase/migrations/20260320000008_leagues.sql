-- ========================================================
-- LEAGUES
-- ========================================================

CREATE TABLE IF NOT EXISTS leagues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  photo_url text,
  focus text NOT NULL DEFAULT 'mixed' CHECK (focus IN ('push_ups', 'squats', 'mixed')),
  privacy text NOT NULL DEFAULT 'public' CHECK (privacy IN ('public', 'private', 'invite_only')),
  creation_fee integer NOT NULL DEFAULT 100,
  admin_id uuid NOT NULL REFERENCES profiles(id),
  member_count integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  league_elo integer NOT NULL DEFAULT 1000,
  wins integer NOT NULL DEFAULT 0,
  losses integer NOT NULL DEFAULT 0,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (league_id, user_id)
);

CREATE TABLE IF NOT EXISTS league_seasons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_number integer NOT NULL DEFAULT 1,
  started_at timestamptz,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'active', 'playoff', 'completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  season_id uuid REFERENCES league_seasons(id),
  match_id uuid REFERENCES matches(id),
  player1_id uuid NOT NULL REFERENCES profiles(id),
  player2_id uuid NOT NULL REFERENCES profiles(id),
  scheduled_at timestamptz,
  round text,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'active', 'completed', 'cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS league_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id),
  message text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_league_members_league ON league_members (league_id);
CREATE INDEX IF NOT EXISTS idx_league_members_user ON league_members (user_id);
CREATE INDEX IF NOT EXISTS idx_league_matches_league ON league_matches (league_id);
CREATE INDEX IF NOT EXISTS idx_league_chat_league ON league_chat_messages (league_id);

-- Enable Realtime on chat
ALTER TABLE league_chat_messages REPLICA IDENTITY FULL;

-- ========================================================
-- RPCs
-- ========================================================

CREATE OR REPLACE FUNCTION create_league(
  p_user_id uuid,
  p_name text,
  p_description text DEFAULT NULL,
  p_focus text DEFAULT 'mixed',
  p_privacy text DEFAULT 'public'
)
RETURNS leagues
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_league leagues%ROWTYPE;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Profile not found'; END IF;

  IF v_profile.repcoins < 100 THEN
    RAISE EXCEPTION 'Insufficient RepCoins. League creation costs 100 RC.';
  END IF;

  INSERT INTO leagues (name, description, focus, privacy, admin_id)
  VALUES (p_name, p_description, p_focus, p_privacy, p_user_id)
  RETURNING * INTO v_league;

  -- Deduct creation fee
  UPDATE profiles SET repcoins = repcoins - 100, updated_at = now() WHERE id = p_user_id;

  -- Auto-join admin
  INSERT INTO league_members (league_id, user_id)
  VALUES (v_league.id, p_user_id);

  RETURN v_league;
END;
$$;

CREATE OR REPLACE FUNCTION join_league(
  p_user_id uuid,
  p_league_id uuid
)
RETURNS league_members
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_league leagues%ROWTYPE;
  v_member league_members%ROWTYPE;
BEGIN
  SELECT * INTO v_league FROM leagues WHERE id = p_league_id;

  IF NOT FOUND THEN RAISE EXCEPTION 'League not found'; END IF;
  IF v_league.privacy = 'invite_only' THEN
    RAISE EXCEPTION 'This league is invite-only';
  END IF;

  INSERT INTO league_members (league_id, user_id)
  VALUES (p_league_id, p_user_id)
  ON CONFLICT (league_id, user_id) DO NOTHING
  RETURNING * INTO v_member;

  IF v_member.id IS NOT NULL THEN
    UPDATE leagues SET member_count = member_count + 1, updated_at = now()
    WHERE id = p_league_id;
  END IF;

  SELECT * INTO v_member FROM league_members
  WHERE league_id = p_league_id AND user_id = p_user_id;

  RETURN v_member;
END;
$$;

CREATE OR REPLACE FUNCTION schedule_league_match(
  p_league_id uuid,
  p_player1_id uuid,
  p_player2_id uuid,
  p_season_id uuid DEFAULT NULL,
  p_round text DEFAULT 'regular',
  p_scheduled_at timestamptz DEFAULT NULL
)
RETURNS league_matches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lm league_matches%ROWTYPE;
BEGIN
  INSERT INTO league_matches (
    league_id, season_id, player1_id, player2_id,
    round, scheduled_at, status
  ) VALUES (
    p_league_id, p_season_id, p_player1_id, p_player2_id,
    p_round, COALESCE(p_scheduled_at, now() + interval '1 day'), 'scheduled'
  )
  RETURNING * INTO v_lm;

  RETURN v_lm;
END;
$$;

CREATE OR REPLACE FUNCTION auto_pair_league_match(p_league_id uuid, p_season_id uuid DEFAULT NULL)
RETURNS SETOF league_matches
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_members uuid[];
  i integer;
BEGIN
  -- Fetch members sorted by league_elo desc for top-vs-top pairing
  SELECT array_agg(user_id ORDER BY league_elo DESC)
  INTO v_members
  FROM league_members
  WHERE league_id = p_league_id;

  IF v_members IS NULL OR array_length(v_members, 1) < 2 THEN
    RETURN;
  END IF;

  -- Pair top vs second, third vs fourth, etc.
  i := 1;
  WHILE i < array_length(v_members, 1) LOOP
    RETURN QUERY SELECT * FROM schedule_league_match(
      p_league_id,
      v_members[i],
      v_members[i + 1],
      p_season_id,
      'regular',
      now() + interval '1 day'
    );
    i := i + 2;
  END LOOP;

  RETURN;
END;
$$;

-- Permissions
GRANT EXECUTE ON FUNCTION create_league(uuid, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION join_league(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION schedule_league_match(uuid, uuid, uuid, uuid, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION auto_pair_league_match(uuid, uuid) TO authenticated;

-- Row Level Security
ALTER TABLE leagues ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_seasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE league_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public leagues visible to all" ON leagues FOR SELECT USING (privacy = 'public');
CREATE POLICY "League members see their leagues" ON leagues FOR SELECT USING (
  id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);
CREATE POLICY "Admins manage leagues" ON leagues FOR ALL USING (admin_id = auth.uid());

CREATE POLICY "Members see league_members" ON league_members FOR SELECT USING (
  league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);
CREATE POLICY "Users manage own membership" ON league_members FOR ALL USING (user_id = auth.uid());

CREATE POLICY "Members see seasons" ON league_seasons FOR SELECT USING (
  league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);

CREATE POLICY "Members see league matches" ON league_matches FOR SELECT USING (
  league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);

CREATE POLICY "Members see chat" ON league_chat_messages FOR SELECT USING (
  league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);
CREATE POLICY "Members send chat" ON league_chat_messages FOR INSERT WITH CHECK (
  user_id = auth.uid() AND
  league_id IN (SELECT league_id FROM league_members WHERE user_id = auth.uid())
);
