/*
  # Phase 3 & 4: Casual Mode and Leveling System

  ## Overview
  1. Update complete_match RPC to apply XP multipliers based on match.mode
     - competitive: 1.5x XP multiplier
     - casual: 1.0x XP multiplier (no wager)
  2. Add automatic level calculation based on XP thresholds
  3. Add helper functions for separate leaderboards (competitive vs casual)

  ## Changes:
  - Modify complete_match function to handle XP multipliers
  - Add calculate_level() function to determine level from XP
  - Add functions for competitive and casual leaderboards
  - Add practice_session tracking function
*/

-- ─── CALCULATE LEVEL FROM XP ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION calculate_level(p_xp integer)
RETURNS integer AS $$
BEGIN
  RETURN CASE
    WHEN p_xp >= 500000 THEN 10
    WHEN p_xp >= 240000 THEN 9
    WHEN p_xp >= 120000 THEN 8
    WHEN p_xp >= 60000 THEN 7
    WHEN p_xp >= 30000 THEN 6
    WHEN p_xp >= 15000 THEN 5
    WHEN p_xp >= 7000 THEN 4
    WHEN p_xp >= 3000 THEN 3
    WHEN p_xp >= 1000 THEN 2
    ELSE 1
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ─── UPDATE COMPLETE MATCH WITH XP MULTIPLIERS ───────────────────────────────
CREATE OR REPLACE FUNCTION complete_match(
  p_match_id uuid,
  p_winner_id uuid,
  p_challenger_reps integer,
  p_opponent_reps integer
)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_winner profiles;
  v_loser profiles;
  v_loser_id uuid;
  v_gross_pot numeric(10,2);
  v_rake numeric(10,2);
  v_net_win numeric(10,2);
  v_xp_win integer := 100;
  v_xp_loss integer := 25;
  v_xp_multiplier numeric := 1.0;
  v_winner_new_level integer;
  v_loser_new_level integer;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status NOT IN ('accepted', 'in_progress') THEN
    RAISE EXCEPTION 'Match cannot be completed in status: %', v_match.status;
  END IF;

  -- Determine XP multiplier based on match mode
  v_xp_multiplier := CASE
    WHEN v_match.mode = 'competitive' THEN 1.5
    ELSE 1.0  -- casual mode
  END;

  v_xp_win := ROUND(v_xp_win * v_xp_multiplier)::integer;
  v_xp_loss := ROUND(v_xp_loss * v_xp_multiplier)::integer;

  v_loser_id := CASE
    WHEN p_winner_id = v_match.challenger_id THEN v_match.opponent_id
    ELSE v_match.challenger_id
  END;

  v_gross_pot := v_match.wager_amount * 2;
  v_rake := ROUND(v_gross_pot * 0.10, 2);
  v_net_win := v_gross_pot - v_rake;

  SELECT * INTO v_winner FROM profiles WHERE id = p_winner_id FOR UPDATE;
  SELECT * INTO v_loser FROM profiles WHERE id = v_loser_id FOR UPDATE;

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

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
  VALUES
    (p_winner_id, p_match_id, 'wager_win', v_net_win,
     v_winner.balance + v_net_win,
     'Won match — net prize after 10% rake'),
    (p_winner_id, p_match_id, 'rake_deduction', -v_rake,
     v_winner.balance + v_net_win,
     'Platform rake (10%)'),
    (v_loser_id, p_match_id, 'wager_loss', 0,
     v_loser.balance,
     'Lost match — wager forfeited');

  UPDATE matches SET
    status = 'completed',
    winner_id = p_winner_id,
    challenger_reps = p_challenger_reps,
    opponent_reps = p_opponent_reps,
    completed_at = now(),
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES
    (p_winner_id, 'match_completed', 'You Won!',
     'You won the match and earned $' || v_net_win::text || '! +' || v_xp_win::text || ' XP',
     jsonb_build_object('match_id', p_match_id, 'won', true, 'xp_gained', v_xp_win)),
    (v_loser_id, 'match_completed', 'Match Over',
     'You lost this one. Better luck next time! +' || v_xp_loss::text || ' XP',
     jsonb_build_object('match_id', p_match_id, 'won', false, 'xp_gained', v_xp_loss));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── RECORD PRACTICE SESSION ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION record_practice_session(
  p_user_id uuid,
  p_exercise_type text,
  p_reps integer,
  p_notes text DEFAULT ''
)
RETURNS practice_sessions AS $$
DECLARE
  v_session practice_sessions;
  v_xp_gain integer;
BEGIN
  -- Award 1 XP per rep for practice sessions
  v_xp_gain := p_reps;

  INSERT INTO practice_sessions (user_id, exercise_type, reps, notes)
  VALUES (p_user_id, p_exercise_type, p_reps, p_notes)
  RETURNING * INTO v_session;

  -- Update profile with XP and level
  UPDATE profiles SET
    total_xp = total_xp + v_xp_gain,
    current_level = calculate_level(total_xp + v_xp_gain),
    total_reps = total_reps + p_reps
  WHERE id = p_user_id;

  RETURN v_session;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── COMPETITIVE LEADERBOARD (XP-based, all time) ───────────────────────────
CREATE OR REPLACE FUNCTION get_competitive_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  display_name text,
  current_level integer,
  total_xp integer,
  wins integer,
  losses integer,
  total_reps integer,
  avatar_gender text,
  avatar_head text,
  avatar_torso text,
  avatar_legs text
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY p.total_xp DESC) AS rank,
    p.id,
    p.username,
    p.display_name,
    p.current_level,
    p.total_xp,
    p.wins,
    p.losses,
    p.total_reps,
    p.avatar_gender,
    p.avatar_head,
    p.avatar_torso,
    p.avatar_legs
  FROM profiles p
  ORDER BY p.total_xp DESC, p.created_at ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── CASUAL LEADERBOARD (Recent activity, casual matches only) ───────────────
CREATE OR REPLACE FUNCTION get_casual_leaderboard(p_limit integer DEFAULT 50)
RETURNS TABLE(
  rank integer,
  user_id uuid,
  username text,
  display_name text,
  current_level integer,
  total_xp integer,
  wins integer,
  losses integer,
  total_reps integer,
  avatar_gender text,
  avatar_head text,
  avatar_torso text,
  avatar_legs text,
  recent_activity timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    ROW_NUMBER() OVER (ORDER BY COALESCE(MAX(m.completed_at), p.updated_at) DESC, p.total_xp DESC) AS rank,
    p.id,
    p.username,
    p.display_name,
    p.current_level,
    p.total_xp,
    p.wins,
    p.losses,
    p.total_reps,
    p.avatar_gender,
    p.avatar_head,
    p.avatar_torso,
    p.avatar_legs,
    COALESCE(MAX(m.completed_at), p.updated_at) AS recent_activity
  FROM profiles p
  LEFT JOIN matches m ON (p.id = m.winner_id OR p.id = m.challenger_id OR p.id = m.opponent_id)
                     AND m.mode = 'casual'
                     AND m.status = 'completed'
  GROUP BY p.id, p.username, p.display_name, p.current_level, p.total_xp, p.wins, p.losses,
           p.total_reps, p.avatar_gender, p.avatar_head, p.avatar_torso, p.avatar_legs, p.updated_at
  ORDER BY COALESCE(MAX(m.completed_at), p.updated_at) DESC, p.total_xp DESC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- ─── GET USER STATS ───────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_user_stats(p_user_id uuid)
RETURNS TABLE(
  level integer,
  current_xp integer,
  next_level_xp integer,
  xp_progress numeric,
  wins integer,
  losses integer,
  win_rate numeric,
  total_reps integer,
  practice_count integer,
  best_practice_reps integer,
  matches_completed integer
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.current_level,
    p.total_xp,
    CASE
      WHEN p.current_level = 10 THEN 500000
      WHEN p.current_level = 9 THEN 240000
      WHEN p.current_level = 8 THEN 120000
      WHEN p.current_level = 7 THEN 60000
      WHEN p.current_level = 6 THEN 30000
      WHEN p.current_level = 5 THEN 15000
      WHEN p.current_level = 4 THEN 7000
      WHEN p.current_level = 3 THEN 3000
      WHEN p.current_level = 2 THEN 1000
      ELSE 0
    END,
    CASE
      WHEN p.current_level < 10 THEN ROUND(
        (p.total_xp - CASE
          WHEN p.current_level = 9 THEN 240000
          WHEN p.current_level = 8 THEN 120000
          WHEN p.current_level = 7 THEN 60000
          WHEN p.current_level = 6 THEN 30000
          WHEN p.current_level = 5 THEN 15000
          WHEN p.current_level = 4 THEN 7000
          WHEN p.current_level = 3 THEN 3000
          WHEN p.current_level = 2 THEN 1000
          ELSE 0
        END)::numeric / (CASE
          WHEN p.current_level = 9 THEN 260000
          WHEN p.current_level = 8 THEN 120000
          WHEN p.current_level = 7 THEN 60000
          WHEN p.current_level = 6 THEN 30000
          WHEN p.current_level = 5 THEN 15000
          WHEN p.current_level = 4 THEN 7000
          WHEN p.current_level = 3 THEN 3000
          WHEN p.current_level = 2 THEN 1000
          ELSE 0
        END), 2)
      ELSE 1.0
    END,
    p.wins,
    p.losses,
    ROUND(p.wins::numeric / NULLIF(p.wins + p.losses, 0) * 100, 1),
    p.total_reps,
    (SELECT COUNT(*) FROM practice_sessions WHERE user_id = p_user_id),
    (SELECT MAX(reps) FROM practice_sessions WHERE user_id = p_user_id),
    (SELECT COUNT(*) FROM matches WHERE (winner_id = p_user_id OR (challenger_id = p_user_id OR opponent_id = p_user_id)) AND status = 'completed')
  FROM profiles p
  WHERE p.id = p_user_id;
END;
$$ LANGUAGE plpgsql;
