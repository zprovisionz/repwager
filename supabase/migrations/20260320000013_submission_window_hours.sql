-- Variable submission window (hours) chosen at challenge creation; honored on accept.

ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS submission_window_hours integer NOT NULL DEFAULT 2
  CHECK (submission_window_hours IN (1, 2, 6, 24));

COMMENT ON COLUMN matches.submission_window_hours IS 'Hours each player has to submit after match is accepted.';

CREATE OR REPLACE FUNCTION accept_match(
  p_match_id uuid,
  p_opponent_id uuid
)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_opponent profiles;
  v_challenger profiles;
  v_hours integer;
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

  v_hours := COALESCE(v_match.submission_window_hours, 2);
  IF v_hours NOT IN (1, 2, 6, 24) THEN
    v_hours := 2;
  END IF;

  UPDATE matches SET
    status = 'accepted',
    opponent_id = p_opponent_id,
    submission_deadline = now() + (v_hours || ' hours')::interval,
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
