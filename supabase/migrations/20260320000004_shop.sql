CREATE TABLE IF NOT EXISTS shop_items (
  id text PRIMARY KEY,
  name text NOT NULL,
  cost_repcoins integer NOT NULL CHECK (cost_repcoins > 0),
  item_type text NOT NULL CHECK (item_type IN ('streak_freeze', 'cosmetic')),
  active boolean NOT NULL DEFAULT true
);

INSERT INTO shop_items (id, name, cost_repcoins, item_type)
VALUES
  ('freeze_pack_1', 'Streak Freeze', 50, 'streak_freeze'),
  ('cosmetic_neon_1', 'Neon Avatar Accent', 75, 'cosmetic')
ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION purchase_item(p_user_id uuid, p_item_id text)
RETURNS void AS $$
DECLARE
  v_cost integer;
BEGIN
  SELECT cost_repcoins INTO v_cost FROM shop_items WHERE id = p_item_id AND active = true;
  IF v_cost IS NULL THEN RAISE EXCEPTION 'Item unavailable'; END IF;
  UPDATE profiles SET repcoins = repcoins - v_cost WHERE id = p_user_id AND repcoins >= v_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'Insufficient RepCoins'; END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
