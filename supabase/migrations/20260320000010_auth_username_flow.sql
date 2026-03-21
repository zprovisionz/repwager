/*
  # Auth + username onboarding hardening
  - Make username uniqueness case-insensitive
  - Replace new_user_profile to remove display_name input
*/

CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_username_lower_unique
  ON profiles (lower(username));

DROP FUNCTION IF EXISTS new_user_profile(uuid, text, text, text);

CREATE OR REPLACE FUNCTION new_user_profile(
  p_user_id uuid,
  p_username text,
  p_avatar_gender text DEFAULT 'male'
)
RETURNS profiles AS $$
DECLARE
  v_profile profiles;
  v_username text := lower(trim(p_username));
BEGIN
  IF v_username IS NULL OR length(v_username) < 3 THEN
    RAISE EXCEPTION 'Username must be at least 3 characters';
  END IF;

  INSERT INTO profiles (id, username, display_name, avatar_gender, repcoins)
  VALUES (p_user_id, v_username, v_username, p_avatar_gender, 100)
  RETURNING * INTO v_profile;

  INSERT INTO transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'starting_balance', 100, 100, 'Welcome bonus - starting RepCoins');

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
