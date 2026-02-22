/*
  # Async Match Submission Fields

  ## Overview
  Adds support for async match submission windows:
  - Players can each submit their rep count independently
  - After the first submission, a 2-hour window opens for the opponent
  - The first submitter's score is hidden until the opponent also submits

  ## Changes

  ### matches table
  - `submission_deadline` — when the 2-hour submission window closes (set on first submission)
  - `challenger_submitted_at` — timestamp when challenger submitted their rep count
  - `opponent_submitted_at` — timestamp when opponent submitted their rep count

  ### submit_async_score(p_match_id, p_user_id, p_reps)
  - Records a player's rep count atomically
  - Sets submission_deadline (now + 2 hours) on the first submission
  - Triggers complete_match when both players have submitted
*/

-- ─── ADD ASYNC SUBMISSION COLUMNS ────────────────────────────────────────────
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS submission_deadline    timestamptz,
  ADD COLUMN IF NOT EXISTS challenger_submitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS opponent_submitted_at   timestamptz;

-- ─── submit_async_score RPC ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION submit_async_score(
  p_match_id uuid,
  p_user_id  uuid,
  p_reps     integer
)
RETURNS matches AS $$
DECLARE
  v_match       matches%ROWTYPE;
  v_is_challenger boolean;
  v_winner_id   uuid;
BEGIN
  -- Lock the row for this transaction
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found: %', p_match_id;
  END IF;

  IF v_match.status NOT IN ('in_progress', 'accepted') THEN
    RAISE EXCEPTION 'Match is not active (status: %)', v_match.status;
  END IF;

  -- Identify which participant is submitting
  IF v_match.challenger_id = p_user_id THEN
    v_is_challenger := true;
  ELSIF v_match.opponent_id = p_user_id THEN
    v_is_challenger := false;
  ELSE
    RAISE EXCEPTION 'User % is not a participant in match %', p_user_id, p_match_id;
  END IF;

  -- Guard: already submitted
  IF v_is_challenger AND v_match.challenger_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Challenger has already submitted for match %', p_match_id;
  END IF;
  IF NOT v_is_challenger AND v_match.opponent_submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Opponent has already submitted for match %', p_match_id;
  END IF;

  -- Guard: deadline passed (only applies if deadline was already set)
  IF v_match.submission_deadline IS NOT NULL AND now() > v_match.submission_deadline THEN
    RAISE EXCEPTION 'Submission deadline has passed for match %', p_match_id;
  END IF;

  -- Record this player's submission
  -- If this is the FIRST submission, also set the deadline
  IF v_is_challenger THEN
    UPDATE matches
    SET
      challenger_reps         = p_reps,
      challenger_submitted_at = now(),
      submission_deadline     = COALESCE(submission_deadline, now() + interval '2 hours'),
      status                  = 'in_progress'
    WHERE id = p_match_id;
  ELSE
    UPDATE matches
    SET
      opponent_reps           = p_reps,
      opponent_submitted_at   = now(),
      submission_deadline     = COALESCE(submission_deadline, now() + interval '2 hours'),
      status                  = 'in_progress'
    WHERE id = p_match_id;
  END IF;

  -- Re-fetch to check if both have now submitted
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;

  IF v_match.challenger_submitted_at IS NOT NULL AND v_match.opponent_submitted_at IS NOT NULL THEN
    -- Both submitted — determine winner and complete the match
    v_winner_id := CASE
      WHEN v_match.challenger_reps >= v_match.opponent_reps THEN v_match.challenger_id
      ELSE v_match.opponent_id
    END;

    PERFORM complete_match(
      p_match_id,
      v_winner_id,
      v_match.challenger_reps,
      v_match.opponent_reps
    );

    -- Return the fully-completed match row
    SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  END IF;

  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
