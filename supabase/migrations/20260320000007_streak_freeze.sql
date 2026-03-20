-- Streak freeze support
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS streak_frozen_until timestamptz,
  ADD COLUMN IF NOT EXISTS freeze_count integer NOT NULL DEFAULT 0;

-- RPC: use_streak_freeze — consumes 1 freeze, sets frozen_until = now() + 24h
CREATE OR REPLACE FUNCTION use_streak_freeze(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_frozen_until timestamptz;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  IF v_profile.freeze_count <= 0 THEN
    RAISE EXCEPTION 'No streak freezes available';
  END IF;

  v_frozen_until := now() + interval '24 hours';

  UPDATE profiles
  SET
    freeze_count = freeze_count - 1,
    streak_frozen_until = v_frozen_until,
    updated_at = now()
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'success', true,
    'freeze_count', v_profile.freeze_count - 1,
    'frozen_until', v_frozen_until
  );
END;
$$;

-- RPC: check_and_award_freeze — called after each casual match; awards a freeze at 5, 10, 15... casual matches
CREATE OR REPLACE FUNCTION check_and_award_freeze(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_profile profiles%ROWTYPE;
  v_awarded boolean := false;
BEGIN
  SELECT * INTO v_profile FROM profiles WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('awarded', false);
  END IF;

  -- Award a freeze every 5 casual matches, max 3 held at once
  IF v_profile.casual_matches_count > 0
    AND v_profile.casual_matches_count % 5 = 0
    AND v_profile.freeze_count < 3
  THEN
    UPDATE profiles
    SET
      freeze_count = LEAST(freeze_count + 1, 3),
      updated_at = now()
    WHERE id = p_user_id;
    v_awarded := true;
  END IF;

  RETURN jsonb_build_object(
    'awarded', v_awarded,
    'freeze_count', CASE WHEN v_awarded THEN LEAST(v_profile.freeze_count + 1, 3) ELSE v_profile.freeze_count END
  );
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION use_streak_freeze(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION check_and_award_freeze(uuid) TO authenticated;
