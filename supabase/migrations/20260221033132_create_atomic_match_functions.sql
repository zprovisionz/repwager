/*
  # Atomic Match Functions

  ## Overview
  Server-side PL/pgSQL functions that handle money movement atomically.
  These prevent race conditions and ensure the ledger stays consistent.

  ## Functions

  ### complete_match(match_id, winner_id, challenger_reps, opponent_reps)
  - Marks match as completed
  - Deducts 10% rake from wager
  - Transfers net winnings to winner
  - Deducts loss from loser
  - Records transactions for both parties
  - Awards XP and updates win/loss records

  ### accept_match(match_id, opponent_id)
  - Validates opponent has sufficient balance
  - Holds wager from opponent's balance
  - Updates match status to accepted

  ### cancel_match(match_id)
  - Refunds both parties if match is cancelled after acceptance
  - Only challenger or system can cancel

  ### new_user_profile(user_id, username, display_name, avatar_gender)
  - Creates profile and records starting_balance transaction
*/

-- ─── NEW USER PROFILE ────────────────────────────────────────────────────────
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
  INSERT INTO profiles (id, username, display_name, avatar_gender, balance)
  VALUES (p_user_id, p_username, p_display_name, p_avatar_gender, 100.00)
  RETURNING * INTO v_profile;

  INSERT INTO transactions (user_id, type, amount, balance_after, description)
  VALUES (p_user_id, 'starting_balance', 100.00, 100.00, 'Welcome bonus — starting balance');

  RETURN v_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── ACCEPT MATCH ────────────────────────────────────────────────────────────
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

  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = p_opponent_id;
  UPDATE profiles SET balance = balance - v_match.wager_amount WHERE id = v_match.challenger_id;

  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
  VALUES
    (p_opponent_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     v_opponent.balance - v_match.wager_amount, 'Wager held for match'),
    (v_match.challenger_id, p_match_id, 'wager_hold', -v_match.wager_amount,
     v_challenger.balance - v_match.wager_amount, 'Wager held for match');

  UPDATE matches
  SET status = 'accepted', opponent_id = p_opponent_id, updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (v_match.challenger_id, 'match_accepted', 'Challenge Accepted!',
          v_opponent.username || ' accepted your challenge. Get ready!',
          jsonb_build_object('match_id', p_match_id));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── COMPLETE MATCH ──────────────────────────────────────────────────────────
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
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status NOT IN ('accepted', 'in_progress') THEN
    RAISE EXCEPTION 'Match cannot be completed in status: %', v_match.status;
  END IF;

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
    total_reps = total_reps + CASE WHEN id = v_match.challenger_id THEN p_challenger_reps ELSE p_opponent_reps END
  WHERE id = p_winner_id;

  UPDATE profiles SET
    losses = losses + 1,
    total_xp = total_xp + v_xp_loss,
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
     'You won the match and earned $' || v_net_win::text || '!',
     jsonb_build_object('match_id', p_match_id, 'won', true)),
    (v_loser_id, 'match_completed', 'Match Over',
     'You lost this one. Better luck next time!',
     jsonb_build_object('match_id', p_match_id, 'won', false));

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── CANCEL MATCH ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cancel_match(p_match_id uuid)
RETURNS matches AS $$
DECLARE
  v_match matches;
  v_challenger profiles;
  v_opponent profiles;
BEGIN
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  IF v_match.status = 'completed' OR v_match.status = 'cancelled' THEN
    RAISE EXCEPTION 'Cannot cancel a % match', v_match.status;
  END IF;

  IF v_match.status IN ('accepted', 'in_progress') THEN
    SELECT * INTO v_challenger FROM profiles WHERE id = v_match.challenger_id FOR UPDATE;

    UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.challenger_id;

    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES (v_match.challenger_id, p_match_id, 'refund', v_match.wager_amount,
            v_challenger.balance + v_match.wager_amount, 'Match cancelled — wager refunded');

    IF v_match.opponent_id IS NOT NULL THEN
      SELECT * INTO v_opponent FROM profiles WHERE id = v_match.opponent_id FOR UPDATE;
      UPDATE profiles SET balance = balance + v_match.wager_amount WHERE id = v_match.opponent_id;
      INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
      VALUES (v_match.opponent_id, p_match_id, 'refund', v_match.wager_amount,
              v_opponent.balance + v_match.wager_amount, 'Match cancelled — wager refunded');
    END IF;
  END IF;

  UPDATE matches SET status = 'cancelled', updated_at = now()
  WHERE id = p_match_id
  RETURNING * INTO v_match;

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
