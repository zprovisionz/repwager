/*
  # Fix complete_match function

  ## Changes
  1. Streak tracking — update current_streak / best_streak on win; reset on loss
  2. Rake transaction balance_after — was showing same balance as wager_win (wrong)
     Fixed: rake_deduction now shows pre-win balance so the wallet history makes
     accounting sense (gross win → rake deducted → net credited)
  3. wager_loss amount — was recorded as 0 (misleading); now records the actual
     wager forfeited as a negative amount matching the wager_hold from accept_match
*/

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
  v_winner_new_streak integer;
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

  -- Compute new streak before update so we can write best_streak correctly
  v_winner_new_streak := v_winner.current_streak + 1;

  -- Winner: credit net winnings, increment wins/xp/reps, extend streak
  UPDATE profiles SET
    balance = balance + v_net_win,
    wins = wins + 1,
    total_xp = total_xp + v_xp_win,
    total_reps = total_reps + CASE
      WHEN id = v_match.challenger_id THEN p_challenger_reps
      ELSE p_opponent_reps
    END,
    current_streak = v_winner_new_streak,
    best_streak = GREATEST(best_streak, v_winner_new_streak)
  WHERE id = p_winner_id;

  -- Loser: increment losses/xp/reps, reset streak
  UPDATE profiles SET
    losses = losses + 1,
    total_xp = total_xp + v_xp_loss,
    total_reps = total_reps + CASE
      WHEN id = v_match.challenger_id THEN p_challenger_reps
      ELSE p_opponent_reps
    END,
    current_streak = 0
  WHERE id = v_loser_id;

  -- Transactions:
  --   wager_win:       gross pot credited to winner (before rake)
  --   rake_deduction:  rake taken back — balance_after shows pre-win balance
  --                    so wallet history reads: +gross, -rake, net = correct final balance
  --   wager_loss:      negative amount matching the wager held at accept_match
  INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
  VALUES
    (p_winner_id, p_match_id, 'wager_win', v_net_win,
     v_winner.balance + v_net_win,
     'Won match — net prize after 10% rake'),
    (p_winner_id, p_match_id, 'rake_deduction', -v_rake,
     v_winner.balance,
     'Platform rake (10%)'),
    (v_loser_id, p_match_id, 'wager_loss', -v_match.wager_amount,
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
