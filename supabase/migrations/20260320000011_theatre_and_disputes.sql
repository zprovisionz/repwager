-- Additive: theatre social layer + disputes ledger (does not replace matches.disputed / dispute_reason)

-- Allow any authenticated user to read completed matches (theatre / replay feed).
CREATE POLICY "matches_select_completed_for_theatre_feed"
  ON matches FOR SELECT
  TO authenticated
  USING (status = 'completed');

CREATE TABLE IF NOT EXISTS theatre_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_activity_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (match_id)
);

CREATE TABLE IF NOT EXISTS theatre_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'fire' CHECK (char_length(kind) BETWEEN 1 AND 32),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theatre_reactions_match ON theatre_reactions (match_id);

CREATE TABLE IF NOT EXISTS theatre_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theatre_comments_match ON theatre_comments (match_id);

CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id uuid NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
  filed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewing', 'resolved', 'dismissed')),
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_disputes_match ON disputes (match_id);

-- ─── RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE theatre_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_reactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE theatre_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

-- Match visibility helper: participant OR completed replay (theatre feed)
-- INVOKER rights: `matches` RLS still applies inside the EXISTS.
CREATE OR REPLACE FUNCTION public.match_visible_for_theatre(p_match_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM matches m
    WHERE m.id = p_match_id
      AND (
        m.challenger_id = auth.uid()
        OR m.opponent_id = auth.uid()
        OR m.status = 'completed'
      )
  );
$$;

-- theatre_sessions
CREATE POLICY "theatre_sessions_select_participant_or_completed"
  ON theatre_sessions FOR SELECT TO authenticated
  USING (public.match_visible_for_theatre(match_id));

CREATE POLICY "theatre_sessions_insert_participant"
  ON theatre_sessions FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );

CREATE POLICY "theatre_sessions_update_participant"
  ON theatre_sessions FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );

-- theatre_reactions
CREATE POLICY "theatre_reactions_select_visible"
  ON theatre_reactions FOR SELECT TO authenticated
  USING (public.match_visible_for_theatre(match_id));

CREATE POLICY "theatre_reactions_insert_visible"
  ON theatre_reactions FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.match_visible_for_theatre(match_id)
  );

-- theatre_comments
CREATE POLICY "theatre_comments_select_visible"
  ON theatre_comments FOR SELECT TO authenticated
  USING (public.match_visible_for_theatre(match_id));

CREATE POLICY "theatre_comments_insert_visible"
  ON theatre_comments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND public.match_visible_for_theatre(match_id)
  );

-- disputes (participants only)
CREATE POLICY "disputes_select_participants"
  ON disputes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );

CREATE POLICY "disputes_insert_participant"
  ON disputes FOR INSERT TO authenticated
  WITH CHECK (
    filed_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );

CREATE POLICY "disputes_update_participant"
  ON disputes FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM matches m
      WHERE m.id = match_id
        AND (m.challenger_id = auth.uid() OR m.opponent_id = auth.uid())
    )
  );
