/*
  # Streak Freeze System

  ## Overview
  Adds a "streak freeze" mechanic to profiles:
  - Players earn a freeze at every 7-win streak milestone
  - A freeze absorbs one loss: streak is preserved instead of resetting to 0
  - Using a freeze records a timestamp; holding one is shown in the UI with a shield

  ## Changes

  ### profiles table
  - `streak_freeze_available` — whether a freeze token is currently held
  - `streak_freeze_used_at`   — when the most recent freeze was consumed

  ### update_streak(p_user_id, p_won)
  Atomic streak update called after every completed match.
  - Win  → current_streak++, update longest_streak, grant freeze at every 7-milestone
  - Loss + freeze held  → consume freeze (preserve streak), record timestamp
  - Loss + no freeze    → reset current_streak to 0

  Returns jsonb:
    { current_streak, longest_streak, granted_freeze, used_freeze }

  ### grant_streak_freeze(p_user_id)
  Utility / admin function to manually grant a freeze token.
  Used by grantStreakFreeze() in the service layer (and test tooling).
*/

-- ─── ADD COLUMNS ──────────────────────────────────────────────────────────────
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_freeze_available boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS streak_freeze_used_at   timestamptz;

-- ─── update_streak ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_streak(
  p_user_id uuid,
  p_won     boolean
)
RETURNS jsonb AS $$
DECLARE
  v_profile        profiles%ROWTYPE;
  v_new_streak     integer;
  v_new_longest    integer;
  v_granted_freeze boolean := false;
  v_used_freeze    boolean := false;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found: %', p_user_id;
  END IF;

  IF p_won THEN
    v_new_streak  := v_profile.current_streak + 1;
    v_new_longest := GREATEST(v_new_streak, v_profile.longest_streak);

    -- Grant a freeze at every 7-win milestone, but only if one isn't already held
    IF v_new_streak % 7 = 0 AND NOT v_profile.streak_freeze_available THEN
      v_granted_freeze := true;
    END IF;

    UPDATE profiles SET
      current_streak         = v_new_streak,
      longest_streak         = v_new_longest,
      last_active_date       = CURRENT_DATE,
      streak_freeze_available = CASE
        WHEN v_granted_freeze THEN true
        ELSE streak_freeze_available
      END
    WHERE id = p_user_id;

  ELSE
    -- Loss path
    IF v_profile.streak_freeze_available THEN
      -- Consume freeze: streak is preserved
      v_used_freeze := true;
      v_new_streak  := v_profile.current_streak;
      v_new_longest := v_profile.longest_streak;

      UPDATE profiles SET
        streak_freeze_available = false,
        streak_freeze_used_at   = now(),
        last_active_date        = CURRENT_DATE
      WHERE id = p_user_id;
    ELSE
      -- No freeze: reset streak
      v_new_streak  := 0;
      v_new_longest := v_profile.longest_streak;

      UPDATE profiles SET
        current_streak   = 0,
        last_active_date = CURRENT_DATE
      WHERE id = p_user_id;
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'current_streak', v_new_streak,
    'longest_streak', v_new_longest,
    'granted_freeze', v_granted_freeze,
    'used_freeze',    v_used_freeze
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── grant_streak_freeze (admin / test utility) ───────────────────────────────
CREATE OR REPLACE FUNCTION grant_streak_freeze(p_user_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE profiles SET streak_freeze_available = true WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
