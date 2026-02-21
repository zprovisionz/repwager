/*
  # Phase 6: Asynchronous Match System

  Converts from synchronous (both players ready simultaneously) to
  asynchronous (each player records independently within 2-hour window).

  Changes:
  - Add submission_deadline (2 hours from acceptance)
  - Add challenger/opponent_submitted_at timestamps
  - Repurpose challenger_ready/opponent_ready to mean "score submitted"
  - New RPC: submit_match_score() - atomic submission + auto-resolution
  - Update accept_match() to set 2-hour submission_deadline
*/

-- ─── ADD ASYNC FIELDS TO MATCHES ────────────────────────────────────────────
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS submission_deadline timestamptz,
ADD COLUMN IF NOT EXISTS challenger_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS opponent_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_matches_submission_deadline ON matches(submission_deadline);
CREATE INDEX IF NOT EXISTS idx_matches_challenger_submitted_at ON matches(challenger_submitted_at);
CREATE INDEX IF NOT EXISTS idx_matches_opponent_submitted_at ON matches(opponent_submitted_at);

-- ─── SUBMIT MATCH SCORE ─────────────────────────────────────────────────────
-- Called when user finishes recording their 60s reps
-- Atomically: records reps, marks as submitted, auto-resolves if both submitted
CREATE OR REPLACE FUNCTION submit_match_score(
  p_match_id uuid,
  p_user_id uuid,
  p_reps integer
)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_is_challenger boolean;
  v_both_submitted boolean;
  v_winner_id uuid;
  v_loser_id uuid;
  v_gross_pot numeric(10,2);
  v_rake numeric(10,2);
  v_net_win numeric(10,2);
  v_xp_win integer := 100;
  v_xp_loss integer := 25;
  v_xp_multiplier numeric := 1.0;
BEGIN
  -- Lock match for consistency
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Validate: match is accepted, not expired, user is participant
  IF v_match.status != 'accepted' THEN
    RAISE EXCEPTION 'Match is not in accepted state (status: %)', v_match.status;
  END IF;

  IF v_match.submission_deadline IS NULL OR now() > v_match.submission_deadline THEN
    RAISE EXCEPTION 'Submission deadline has passed';
  END IF;

  -- Determine if user is challenger or opponent
  v_is_challenger := p_user_id = v_match.challenger_id;
  IF NOT v_is_challenger AND p_user_id != v_match.opponent_id THEN
    RAISE EXCEPTION 'User is not a participant in this match';
  END IF;

  -- Check if already submitted
  IF v_is_challenger AND v_match.challenger_ready THEN
    RAISE EXCEPTION 'Challenger has already submitted';
  END IF;

  IF NOT v_is_challenger AND v_match.opponent_ready THEN
    RAISE EXCEPTION 'Opponent has already submitted';
  END IF;

  -- Record the submission
  IF v_is_challenger THEN
    UPDATE matches SET
      challenger_reps = p_reps,
      challenger_ready = true,
      challenger_submitted_at = now()
    WHERE id = p_match_id;
  ELSE
    UPDATE matches SET
      opponent_reps = p_reps,
      opponent_ready = true,
      opponent_submitted_at = now()
    WHERE id = p_match_id;
  END IF;

  -- Fetch updated match to check if both submitted
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  v_both_submitted := v_match.challenger_ready AND v_match.opponent_ready;

  -- If both submitted, auto-resolve the match
  IF v_both_submitted THEN
    -- Determine winner (higher reps wins, tie goes to challenger)
    v_winner_id := CASE
      WHEN v_match.challenger_reps >= v_match.opponent_reps THEN v_match.challenger_id
      ELSE v_match.opponent_id
    END;

    v_loser_id := CASE
      WHEN v_winner_id = v_match.challenger_id THEN v_match.opponent_id
      ELSE v_match.challenger_id
    END;

    -- Apply XP multiplier based on mode
    v_xp_multiplier := CASE
      WHEN v_match.mode = 'competitive' THEN 1.5
      ELSE 1.0
    END;

    v_xp_win := ROUND(v_xp_win * v_xp_multiplier)::integer;
    v_xp_loss := ROUND(v_xp_loss * v_xp_multiplier)::integer;

    -- Calculate pot and rake
    v_gross_pot := v_match.wager_amount * 2;
    v_rake := ROUND(v_gross_pot * 0.10, 2);
    v_net_win := v_gross_pot - v_rake;

    -- Update winner: +balance, +wins, +xp, +level, +total_reps
    UPDATE profiles SET
      balance = balance + v_net_win,
      wins = wins + 1,
      total_xp = total_xp + v_xp_win,
      current_level = calculate_level(total_xp + v_xp_win),
      total_reps = total_reps + (CASE
        WHEN v_match.challenger_id = v_winner_id THEN v_match.challenger_reps
        ELSE v_match.opponent_reps
      END)
    WHERE id = v_winner_id;

    -- Update loser: +losses, +xp, +level, +total_reps (no balance)
    UPDATE profiles SET
      losses = losses + 1,
      total_xp = total_xp + v_xp_loss,
      current_level = calculate_level(total_xp + v_xp_loss),
      total_reps = total_reps + (CASE
        WHEN v_match.challenger_id = v_loser_id THEN v_match.challenger_reps
        ELSE v_match.opponent_reps
      END)
    WHERE id = v_loser_id;

    -- Record transactions
    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES
      (v_winner_id, p_match_id, 'wager_win', v_net_win,
       (SELECT balance FROM profiles WHERE id = v_winner_id),
       'Won async match — net prize after 10% rake'),
      (v_winner_id, p_match_id, 'rake_deduction', -v_rake,
       (SELECT balance FROM profiles WHERE id = v_winner_id),
       'Platform rake (10%)'),
      (v_loser_id, p_match_id, 'wager_loss', 0,
       (SELECT balance FROM profiles WHERE id = v_loser_id),
       'Lost async match — wager forfeited');

    -- Mark match as completed
    UPDATE matches SET
      status = 'completed',
      winner_id = v_winner_id,
      completed_at = now(),
      updated_at = now()
    WHERE id = p_match_id;

    -- Notifications
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES
      (v_winner_id, 'match_completed', 'You Won!',
       'Opponent submitted ' || v_match.opponent_reps::text || ' reps. You got ' || (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || ' reps. Won $' || v_net_win::text || '!',
       jsonb_build_object('match_id', p_match_id, 'won', true, 'your_reps', (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END), 'opponent_reps', (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.opponent_reps ELSE v_match.challenger_reps END), 'xp_gained', v_xp_win)),
      (v_loser_id, 'match_completed', 'Match Over',
       'Opponent got ' || (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || ' reps vs your ' || (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || '. Better luck next time! +' || v_xp_loss::text || ' XP',
       jsonb_build_object('match_id', p_match_id, 'won', false, 'your_reps', (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END), 'opponent_reps', (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.opponent_reps ELSE v_match.challenger_reps END), 'xp_gained', v_xp_loss));
  END IF;

  -- Return updated match
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── UPDATE ACCEPT_MATCH TO SET SUBMISSION_DEADLINE ──────────────────────────
-- Modified to set 2-hour submission window
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

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status != 'pending' THEN
    RAISE EXCEPTION 'Match is not pending';
  END IF;

  IF v_match.challenger_id = p_opponent_id THEN
    RAISE EXCEPTION 'Cannot accept your own challenge';
  END IF;

  SELECT * INTO v_opponent FROM profiles WHERE id = p_opponent_id FOR UPDATE;
  SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;

  IF v_opponent.balance < v_match.wager_amount THEN
    RAISE EXCEPTION 'Insufficient balance';
  END IF;

  IF v_challenger.balance < v_match.wager_amount THEN
    RAISE EXCEPTION 'Challenger has insufficient balance';
  END IF;

  -- Hold wagers
  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = p_opponent_id;
  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = v_match.challenger_id;

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
  VALUES
    (p_opponent_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     v_opponent.balance - v_match.wager_amount, 'Wager held for match'),
    (v_match.challenger_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     v_challenger.balance - v_match.wager_amount, 'Wager held for match');

  -- NEW: Set submission_deadline to 2 hours from now
  UPDATE matches
  SET
    status = 'accepted',
    opponent_id = p_opponent_id,
    submission_deadline = now() + interval '2 hours',
    updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (v_match.challenger_id, 'match_accepted', 'Challenge Accepted!',
          v_opponent.username || ' accepted your challenge. Record your reps within 2 hours!',
          jsonb_build_object('match_id', p_match_id));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── HANDLE EXPIRED MATCHES (Optional: cleanup via cron) ──────────────────────
-- Cancels matches past deadline + refunds both players
CREATE OR REPLACE FUNCTION handle_expired_matches()
RETURNS void AS $$
DECLARE
  v_expired_match matches%ROWTYPE;
  v_refund_amount numeric(10,2);
BEGIN
  -- Find all expired matches that aren't both submitted
  FOR v_expired_match IN
    SELECT * FROM matches
    WHERE status = 'accepted'
    AND submission_deadline < now()
    AND NOT (challenger_ready AND opponent_ready)
  LOOP
    v_refund_amount := v_expired_match.wager_amount;

    -- Refund both players
    UPDATE profiles SET balance = balance + v_refund_amount
    WHERE id = v_expired_match.challenger_id;

    UPDATE profiles SET balance = balance + v_refund_amount
    WHERE id = v_expired_match.opponent_id;

    -- Record refund transactions
    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES
      (v_expired_match.challenger_id, v_expired_match.id, 'refund', v_refund_amount,
       (SELECT balance FROM profiles WHERE id = v_expired_match.challenger_id),
       'Match expired — full refund'),
      (v_expired_match.opponent_id, v_expired_match.id, 'refund', v_refund_amount,
       (SELECT balance FROM profiles WHERE id = v_expired_match.opponent_id),
       'Match expired — full refund');

    -- Cancel match
    UPDATE matches
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_expired_match.id;

    -- Notifications
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES
      (v_expired_match.challenger_id, 'match_completed', 'Match Expired',
       'Your match expired. Opponent did not submit their reps in time. Wager refunded.',
       jsonb_build_object('match_id', v_expired_match.id, 'expired', true)),
      (v_expired_match.opponent_id, 'match_completed', 'Match Expired',
       'Match expired. You did not submit your reps in time. Wager refunded.',
       jsonb_build_object('match_id', v_expired_match.id, 'expired', true));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
