-- Allow wager_amount = 0 for casual matches (DESIGN_SPEC: cyan casual, no stake)

ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_wager_amount_check;

ALTER TABLE matches
  ADD CONSTRAINT matches_wager_amount_mode_check
  CHECK (
    (match_mode = 'casual' AND wager_amount >= 0 AND wager_amount <= 1000)
    OR (match_mode = 'wager' AND wager_amount >= 1)
  );
