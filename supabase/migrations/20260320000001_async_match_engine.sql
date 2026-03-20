-- ─── PHASE 1: ASYNC MATCH ENGINE ─────────────────────────────────────────────
--
-- Changes:
--   1. Add async submission columns to matches
--   2. Replace status constraint with 5-phase async states
--   3. Add rep_events JSONB column (stores per-rep angle data for Theatre markers)
--   4. Add profile search support (pg_trgm index on username)
--   5. Add hasCompletedOnboarding, repcoins, elo, etc. to profiles
--   6. New RPC: submit_reps — atomic submission, hidden scores, auto-reveal
--   7. New RPC: expire_matches — refunds both parties on deadline miss
--   8. New RPC: search_profiles — username search for direct challenge
--   9. Update accept_match to set submission_deadline + use repcoins

-- ─── 1. PROFILES: new columns ─────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS has_completed_onboarding boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS casual_matches_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS elo integer NOT NULL DEFAULT 1000,
  ADD COLUMN IF NOT EXISTS rank_tier text NOT NULL DEFAULT 'Rookie',
  ADD COLUMN IF NOT EXISTS provisional_matches_remaining integer NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS freeze_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS repcoins integer NOT NULL DEFAULT 100;

-- ─── 2. MATCHES: async submission columns ────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS submission_deadline timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS opponent_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS scores_revealed_at timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_video_path text,
  ADD COLUMN IF NOT EXISTS opponent_video_path text,
  ADD COLUMN IF NOT EXISTS challenger_rep_events jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS opponent_rep_events jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS match_mode text NOT NULL DEFAULT 'wager'
    CHECK (match_mode IN ('wager', 'casual')),
  ADD COLUMN IF NOT EXISTS rematch_of uuid REFERENCES matches(id) ON DELETE SET NULL;

-- ─── 3. MATCHES: replace status constraint ───────────────────────────────────
-- Migrate any in_progress matches to accepted (async model)
UPDATE matches SET status = 'accepted', submission_deadline = COALESCE(started_at, now()) + interval '2 hours'
  WHERE status = 'in_progress';

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_status_check;
ALTER TABLE matches
  ADD CONSTRAINT matches_status_check
    CHECK (status IN (
      'pending',
      'accepted',
      'challenger_submitted',
      'opponent_submitted',
      'completed',
      'expired',
      'disputed',
      'cancelled'
    ));

-- ─── 4. INDEXES ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matches_submission_deadline
  ON matches (submission_deadline)
  WHERE status IN ('accepted', 'challenger_submitted', 'opponent_submitted');

-- ─── 5. UPDATE accept_match: set submission_deadline + use repcoins ──────────
CREATE OR REPLACE FUNCTION accept_match(
  p_match_id uuid,
  p_opponent_id uuid
)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_opponent profiles;
  v_challenger profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;
  IF v_match.status != 'pending' THEN RAISE EXCEPTION 'Match is not pending'; END IF;
  IF v_match.challenger_id = p_opponent_id THEN RAISE EXCEPTION 'Cannot accept your own challenge'; END IF;

  SELECT * INTO v_opponent FROM profiles WHERE id = p_opponent_id FOR UPDATE;
  SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;

  IF COALESCE(v_opponent.repcoins, 100) < v_match.wager_amount THEN
    RAISE EXCEPTION 'Insufficient RepCoins';
  END IF;
  IF COALESCE(v_challenger.repcoins, 100) < v_match.wager_amount THEN
    RAISE EXCEPTION 'Challenger has insufficient RepCoins';
  END IF;

  UPDATE profiles SET repcoins = COALESCE(repcoins, 100) - v_match.wager_amount WHERE id = p_opponent_id;
  UPDATE profiles SET repcoins = COALESCE(repcoins, 100) - v_match.wager_amount WHERE id = v_match.challenger_id;

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
  VALUES
    (p_opponent_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     COALESCE(v_opponent.repcoins, 100) - v_match.wager_amount, 'Wager held for match'),
    (v_match.challenger_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     COALESCE(v_challenger.repcoins, 100) - v_match.wager_amount, 'Wager held for match');

  UPDATE matches SET
    status = 'accepted',
    opponent_id = p_opponent_id,
    submission_deadline = now() + interval '2 hours',
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (v_match.challenger_id, 'match_accepted',
    'Challenge Accepted!',
    v_opponent.display_name || ' accepted your challenge. Record your set!',
    jsonb_build_object('match_id', p_match_id));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 6. NEW RPC: submit_reps ──────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_reps(
  p_match_id uuid,
  p_user_id uuid,
  p_reps integer,
  p_rep_events jsonb DEFAULT '[]'::jsonb
)
RETURNS jsonb AS $$
DECLARE
  v_match matches;
  v_is_challenger boolean;
  v_both_submitted boolean := false;
  v_winner_id uuid;
  v_loser_id uuid;
  v_gross_pot integer;
  v_rake integer;
  v_net_win integer;
  v_challenger_profile profiles;
  v_opponent_profile profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF v_match.status NOT IN ('accepted', 'challenger_submitted', 'opponent_submitted') THEN
    RAISE EXCEPTION 'Match cannot accept submissions in status: %', v_match.status;
  END IF;

  IF v_match.submission_deadline < now() THEN
    RAISE EXCEPTION 'Submission window has expired';
  END IF;

  IF v_match.challenger_id != p_user_id AND v_match.opponent_id != p_user_id THEN
    RAISE EXCEPTION 'User is not a participant in this match';
  END IF;

  v_is_challenger := (v_match.challenger_id = p_user_id);

  IF v_is_challenger AND v_match.challenger_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Challenger already submitted';
  END IF;
  IF NOT v_is_challenger AND v_match.opponent_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Opponent already submitted';
  END IF;

  IF v_is_challenger THEN
    UPDATE matches SET
      challenger_reps = p_reps,
      challenger_rep_events = p_rep_events,
      challenger_submitted_at = now(),
      status = CASE
        WHEN opponent_submitted_at IS NOT NULL THEN 'completed'
        ELSE 'challenger_submitted'
      END,
      updated_at = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_match.opponent_id, 'match_accepted',
      'Opponent Submitted!',
      'Your opponent has locked in their reps. Record your set before time runs out!',
      jsonb_build_object('match_id', p_match_id));
  ELSE
    UPDATE matches SET
      opponent_reps = p_reps,
      opponent_rep_events = p_rep_events,
      opponent_submitted_at = now(),
      status = CASE
        WHEN challenger_submitted_at IS NOT NULL THEN 'completed'
        ELSE 'opponent_submitted'
      END,
      updated_at = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_match.challenger_id, 'match_accepted',
      'Opponent Submitted!',
      'Your opponent has locked in their reps. Record your set before time runs out!',
      jsonb_build_object('match_id', p_match_id));
  END IF;

  v_both_submitted := (v_match.challenger_submitted_at IS NOT NULL
    AND v_match.opponent_submitted_at IS NOT NULL);

  IF v_both_submitted THEN
    IF v_match.challenger_reps >= v_match.opponent_reps THEN
      v_winner_id := v_match.challenger_id;
      v_loser_id := v_match.opponent_id;
    ELSE
      v_winner_id := v_match.opponent_id;
      v_loser_id := v_match.challenger_id;
    END IF;

    v_gross_pot := v_match.wager_amount * 2;
    v_rake := ROUND(v_gross_pot * 0.10);
    v_net_win := v_gross_pot - v_rake;

    SELECT * INTO v_challenger_profile FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;
    SELECT * INTO v_opponent_profile FROM profiles WHERE id = v_match.opponent_id FOR UPDATE;

    UPDATE profiles SET
      repcoins = COALESCE(repcoins, 100) + v_net_win,
      wins = wins + 1,
      total_xp = total_xp + 100,
      total_reps = total_reps + CASE
        WHEN id = v_match.challenger_id THEN v_match.challenger_reps
        ELSE v_match.opponent_reps
      END
    WHERE id = v_winner_id;

    UPDATE profiles SET
      losses = losses + 1,
      total_xp = total_xp + 15,
      total_reps = total_reps + CASE
        WHEN id = v_match.challenger_id THEN v_match.challenger_reps
        ELSE v_match.opponent_reps
      END
    WHERE id = v_loser_id;

    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES
      (v_winner_id, p_match_id, 'wager_win', v_net_win,
       (SELECT COALESCE(repcoins, 100) FROM profiles WHERE id = v_winner_id),
       'Won match — net prize after 10% rake'),
      (v_winner_id, p_match_id, 'rake_deduction', -v_rake,
       (SELECT COALESCE(repcoins, 100) FROM profiles WHERE id = v_winner_id),
       'Platform rake (10%)'),
      (v_loser_id, p_match_id, 'wager_loss', 0,
       (SELECT COALESCE(repcoins, 100) FROM profiles WHERE id = v_loser_id),
       'Lost match — wager forfeited');

    UPDATE matches SET
      winner_id = v_winner_id,
      scores_revealed_at = now(),
      completed_at = now(),
      updated_at = now()
    WHERE id = p_match_id
    RETURNING * INTO v_match;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES
      (v_winner_id, 'match_completed',
       'You Won! 🏆',
       'Both scores are in. Check your Theatre replay.',
       jsonb_build_object('match_id', p_match_id, 'won', true,
         'my_reps', CASE WHEN v_winner_id = v_match.challenger_id
           THEN v_match.challenger_reps ELSE v_match.opponent_reps END,
         'opponent_reps', CASE WHEN v_winner_id = v_match.challenger_id
           THEN v_match.opponent_reps ELSE v_match.challenger_reps END)),
      (v_loser_id, 'match_completed',
       'Match Over',
       'Both scores are in. Check your Theatre replay.',
       jsonb_build_object('match_id', p_match_id, 'won', false,
         'my_reps', CASE WHEN v_loser_id = v_match.challenger_id
           THEN v_match.challenger_reps ELSE v_match.opponent_reps END,
         'opponent_reps', CASE WHEN v_loser_id = v_match.challenger_id
           THEN v_match.opponent_reps ELSE v_match.challenger_reps END));
  END IF;

  RETURN jsonb_build_object(
    'match_id', p_match_id,
    'status', v_match.status,
    'revealed', v_both_submitted,
    'my_reps', p_reps,
    'opponent_reps', CASE WHEN v_both_submitted THEN
      CASE WHEN v_is_challenger
        THEN v_match.opponent_reps
        ELSE v_match.challenger_reps
      END
    ELSE NULL END,
    'winner_id', CASE WHEN v_both_submitted THEN v_match.winner_id ELSE NULL END,
    'scores_revealed_at', v_match.scores_revealed_at
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 7. NEW RPC: expire_matches ───────────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_matches()
RETURNS integer AS $$
DECLARE
  v_match matches;
  v_count integer := 0;
  v_challenger profiles;
  v_opponent profiles;
BEGIN
  FOR v_match IN
    SELECT * FROM matches
    WHERE status IN ('accepted', 'challenger_submitted', 'opponent_submitted')
      AND submission_deadline < now()
    FOR UPDATE SKIP LOCKED
  LOOP
    SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;
    UPDATE profiles SET repcoins = COALESCE(repcoins, 100) + v_match.wager_amount
      WHERE id = v_match.challenger_id;
    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES (v_match.challenger_id, v_match.id, 'refund', v_match.wager_amount,
      COALESCE(v_challenger.repcoins, 100) + v_match.wager_amount, 'Match expired — wager refunded');

    IF v_match.opponent_id IS NOT NULL THEN
      SELECT * INTO v_opponent FROM profiles WHERE id = v_match.opponent_id FOR UPDATE;
      UPDATE profiles SET repcoins = COALESCE(repcoins, 100) + v_match.wager_amount
        WHERE id = v_match.opponent_id;
      INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
      VALUES (v_match.opponent_id, v_match.id, 'refund', v_match.wager_amount,
        COALESCE(v_opponent.repcoins, 100) + v_match.wager_amount, 'Match expired — wager refunded');
    END IF;

    UPDATE matches SET status = 'expired', updated_at = now()
      WHERE id = v_match.id;

    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_match.challenger_id, 'match_completed',
      'Match Expired',
      'The submission window closed. Your RepCoins have been refunded.',
      jsonb_build_object('match_id', v_match.id, 'expired', true));

    IF v_match.opponent_id IS NOT NULL THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (v_match.opponent_id, 'match_completed',
        'Match Expired',
        'The submission window closed. Your RepCoins have been refunded.',
        jsonb_build_object('match_id', v_match.id, 'expired', true));
    END IF;

    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 8. NEW RPC: search_profiles ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION search_profiles(
  p_query text,
  p_limit integer DEFAULT 10,
  p_exclude_user_id uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  username text,
  display_name text,
  avatar_gender text,
  avatar_head text,
  avatar_torso text,
  avatar_legs text,
  wins integer,
  losses integer,
  total_xp integer,
  elo integer,
  rank_tier text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id, p.username, p.display_name,
    p.avatar_gender, p.avatar_head, p.avatar_torso, p.avatar_legs,
    p.wins, p.losses, p.total_xp,
    COALESCE(p.elo, 1000)::integer,
    COALESCE(p.rank_tier, 'Rookie')
  FROM profiles p
  WHERE
    (p.username ILIKE '%' || p_query || '%'
      OR p.display_name ILIKE '%' || p_query || '%')
    AND (p_exclude_user_id IS NULL OR p.id != p_exclude_user_id)
  ORDER BY
    CASE WHEN p.username ILIKE p_query || '%' THEN 0 ELSE 1 END,
    p.total_xp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 9. UPDATE cancel_match to use repcoins ──────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_match(p_match_id uuid)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_challenger profiles;
  v_opponent profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN RAISE EXCEPTION 'Match not found'; END IF;

  IF v_match.status = 'completed' OR v_match.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel a % match', v_match.status;
  END IF;

  IF v_match.status IN ('accepted', 'challenger_submitted', 'opponent_submitted') THEN
    SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;

    UPDATE profiles SET repcoins = COALESCE(repcoins, 100) + v_match.wager_amount
      WHERE id = v_match.challenger_id;

    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES (v_match.challenger_id, p_match_id, 'refund', v_match.wager_amount,
      COALESCE(v_challenger.repcoins, 100) + v_match.wager_amount, 'Match cancelled — wager refunded');

    IF v_match.opponent_id IS NOT NULL THEN
      SELECT * INTO v_opponent FROM profiles WHERE id = v_match.opponent_id FOR UPDATE;
      UPDATE profiles SET repcoins = COALESCE(repcoins, 100) + v_match.wager_amount
        WHERE id = v_match.opponent_id;
      INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
      VALUES (v_match.opponent_id, p_match_id, 'refund', v_match.wager_amount,
        COALESCE(v_opponent.repcoins, 100) + v_match.wager_amount, 'Match cancelled — wager refunded');
    END IF;
  END IF;

  UPDATE matches SET status = 'cancelled', updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── 10. SEED: repcoins for existing users ───────────────────────────────────
UPDATE profiles SET repcoins = 100 WHERE repcoins IS NULL OR repcoins = 0;
