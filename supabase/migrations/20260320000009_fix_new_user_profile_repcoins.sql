/*
  # Fix new_user_profile to use RepCoins
*/

CREATE OR REPLACE FUNCTION new_user_profile(
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_avatar_gender text DEFAULT 'male'
)
RETURNS profiles AS $$
DECLARE
  v_profile profiles;
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_gender, repcoins)
  VALUES (p_user_id, p_username, p_display_name, p_avatar_gender, 100)
  RETURNING * INTO v_profile;

  INSERT INTO transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'starting_balance', 100, 100, 'Welcome bonus - starting RepCoins');

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
