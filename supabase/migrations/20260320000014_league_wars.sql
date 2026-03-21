-- League wars (minimal schema — expand with battles/brackets as product solidifies)

CREATE TABLE IF NOT EXISTS league_wars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  league_id uuid NOT NULL REFERENCES leagues(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'War',
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'completed', 'cancelled')),
  declared_by uuid REFERENCES profiles(id),
  declared_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_league_wars_league ON league_wars (league_id);

COMMENT ON TABLE league_wars IS 'Headline league conflict events; UI in app/leagues/war.tsx';
