/*
  # ELO system for ranked ladder
*/

CREATE OR REPLACE FUNCTION get_rank_tier_for_elo(p_elo integer)
RETURNS text AS $$
BEGIN
  IF p_elo >= 2200 THEN RETURN 'goggins'; END IF;
  IF p_elo >= 1800 THEN RETURN 'elite'; END IF;
  IF p_elo >= 1500 THEN RETURN 'advanced'; END IF;
  IF p_elo >= 1200 THEN RETURN 'intermediate'; END IF;
  RETURN 'rookie';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION update_elo_after_match(
  p_winner_id uuid,
  p_loser_id uuid,
  p_k integer DEFAULT 32
)
RETURNS void AS $$
DECLARE
  w_elo integer;
  l_elo integer;
  expected_w numeric;
  expected_l numeric;
  delta_w integer;
  delta_l integer;
BEGIN
  SELECT elo INTO w_elo FROM profiles WHERE id = p_winner_id FOR UPDATE;
  SELECT elo INTO l_elo FROM profiles WHERE id = p_loser_id FOR UPDATE;

  expected_w := 1 / (1 + power(10, (l_elo - w_elo) / 400.0));
  expected_l := 1 / (1 + power(10, (w_elo - l_elo) / 400.0));
  delta_w := round(p_k * (1 - expected_w));
  delta_l := round(p_k * (0 - expected_l));

  UPDATE profiles
  SET elo = elo + delta_w,
      ranked_matches_played = ranked_matches_played + 1,
      rank_tier = get_rank_tier_for_elo(elo + delta_w)
  WHERE id = p_winner_id;

  UPDATE profiles
  SET elo = GREATEST(1000, elo + delta_l),
      ranked_matches_played = ranked_matches_played + 1,
      rank_tier = get_rank_tier_for_elo(GREATEST(1000, elo + delta_l))
  WHERE id = p_loser_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

ALTER TABLE badges ADD COLUMN IF NOT EXISTS badge_type text DEFAULT 'seasonal';

CREATE OR REPLACE FUNCTION seasonal_elo_reset()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET elo = GREATEST(1000, floor(elo * 0.85)::integer),
      rank_tier = get_rank_tier_for_elo(GREATEST(1000, floor(elo * 0.85)::integer));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
