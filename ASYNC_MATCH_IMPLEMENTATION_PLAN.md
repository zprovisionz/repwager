# Async Match System Implementation Plan

## Overview
Convert RepWager from **synchronous** (both players ready simultaneously) to **asynchronous** (each player records independently within a 2-hour window).

**Key Decisions Made:**
- Time window: **2 hours** (tighter, keeps matches moving)
- No-show behavior: **Full refund to both players** (fair, prevents frustration)
- Score visibility: **Hidden until both submit** (prevents gaming)
- Auto-resolution: **When both submit, winner is determined + money transfers atomically**

---

## Phase 1: Database Changes

### 1.1 New Migration File: `20260221_async_matches.sql`

```sql
/*
  # Phase 6: Asynchronous Match System

  Changes:
  - Add submission window fields to matches table
  - Repurpose challenger_ready/opponent_ready to mean "submitted score" (not "ready to start")
  - Add new RPC: submit_match_score() for atomic score submission + auto-resolution
  - Update accept_match RPC to set submission_deadline = now() + 2 hours
  - Add optional: handle_expired_matches() for deadline enforcement
*/

-- Add new fields to matches table
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS submission_deadline timestamptz,
ADD COLUMN IF NOT EXISTS challenger_submitted_at timestamptz,
ADD COLUMN IF NOT EXISTS opponent_submitted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_matches_submission_deadline ON matches(submission_deadline);

-- Comment on repurposed columns for clarity
COMMENT ON COLUMN matches.challenger_ready IS 'Now means: challenger has submitted their score';
COMMENT ON COLUMN matches.opponent_ready IS 'Now means: opponent has submitted their score';

-- ─── SUBMIT MATCH SCORE ─────────────────────────────────────────────────────
-- Called by user after recording their 60-second reps
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
  -- Lock the match row for consistency
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match not found';
  END IF;

  -- Validate: match is accepted, not expired, user is participant, hasn't submitted yet
  IF v_match.status != 'accepted' THEN
    RAISE EXCEPTION 'Match is not in accepted state';
  END IF;

  IF v_match.submission_deadline IS NULL OR now() > v_match.submission_deadline THEN
    RAISE EXCEPTION 'Submission deadline has passed';
  END IF;

  -- Determine if user is challenger or opponent
  v_is_challenger := p_user_id = v_match.challenger_id;
  IF NOT v_is_challenger AND p_user_id != v_match.opponent_id THEN
    RAISE EXCEPTION 'User is not a participant in this match';
  END IF;

  -- Check if user has already submitted
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

  -- Check if both have now submitted
  SELECT * INTO v_match FROM matches WHERE id = p_match_id FOR UPDATE;
  v_both_submitted := v_match.challenger_ready AND v_match.opponent_ready;

  -- If both submitted, run complete_match logic atomically
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

    -- Update winner
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

    -- Update loser
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

    -- Update match to completed
    UPDATE matches SET
      status = 'completed',
      winner_id = v_winner_id,
      completed_at = now(),
      updated_at = now()
    WHERE id = p_match_id;

    -- Send notifications
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES
      (v_winner_id, 'match_completed', 'You Won!',
       'Your opponent submitted ' || v_match.opponent_reps::text || ' reps. You won $' || v_net_win::text || '!',
       jsonb_build_object('match_id', p_match_id, 'won', true, 'your_reps', (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END), 'opponent_reps', (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.opponent_reps ELSE v_match.challenger_reps END), 'xp_gained', v_xp_win)),
      (v_loser_id, 'match_completed', 'Match Over',
       'Opponent got ' || (CASE WHEN v_winner_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || ' reps vs your ' || (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END)::text || '. Better luck next time! +' || v_xp_loss::text || ' XP',
       jsonb_build_object('match_id', p_match_id, 'won', false, 'your_reps', (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.challenger_reps ELSE v_match.opponent_reps END), 'opponent_reps', (CASE WHEN v_loser_id = v_match.challenger_id THEN v_match.opponent_reps ELSE v_match.challenger_reps END), 'xp_gained', v_xp_loss));
  END IF;

  -- Get fresh match data and return
  SELECT * INTO v_match FROM matches WHERE id = p_match_id;
  RETURN v_match;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ─── UPDATE ACCEPT_MATCH TO SET SUBMISSION_DEADLINE ─────────────────────────
-- Need to update existing accept_match RPC to set submission_deadline
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

-- OPTIONAL: Handle expired matches (runs via cron or triggered manually)
-- Sets matches to 'cancelled' if deadline passed and not both submitted
-- Refunds both players
CREATE OR REPLACE FUNCTION handle_expired_matches()
RETURNS void AS $$
DECLARE
  v_expired_match matches%ROWTYPE;
  v_challenger profiles%ROWTYPE;
  v_opponent profiles%ROWTYPE;
BEGIN
  FOR v_expired_match IN
    SELECT * FROM matches
    WHERE status = 'accepted'
    AND submission_deadline < now()
    AND NOT (challenger_ready AND opponent_ready)
  LOOP
    -- Get both players
    SELECT * INTO v_challenger FROM profiles WHERE id = v_expired_match.challenger_id;
    SELECT * INTO v_opponent FROM profiles WHERE id = v_expired_match.opponent_id;

    -- Refund wager to both (full refund)
    UPDATE profiles SET balance = balance + v_expired_match.wager_amount
    WHERE id = v_expired_match.challenger_id;

    UPDATE profiles SET balance = balance + v_expired_match.wager_amount
    WHERE id = v_expired_match.opponent_id;

    -- Record refund transactions
    INSERT INTO transactions (user_id, match_id, type, amount, balance_after, description)
    VALUES
      (v_expired_match.challenger_id, v_expired_match.id, 'refund', v_expired_match.wager_amount,
       (SELECT balance FROM profiles WHERE id = v_expired_match.challenger_id),
       'Match expired — full refund'),
      (v_expired_match.opponent_id, v_expired_match.id, 'refund', v_expired_match.wager_amount,
       (SELECT balance FROM profiles WHERE id = v_expired_match.opponent_id),
       'Match expired — full refund');

    -- Cancel the match
    UPDATE matches
    SET status = 'cancelled', updated_at = now()
    WHERE id = v_expired_match.id;

    -- Send notifications
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES
      (v_expired_match.challenger_id, 'match_completed', 'Match Expired',
       'Your match expired. Wager refunded to both players.',
       jsonb_build_object('match_id', v_expired_match.id, 'expired', true)),
      (v_expired_match.opponent_id, 'match_completed', 'Match Expired',
       'Match expired. Wager refunded to both players.',
       jsonb_build_object('match_id', v_expired_match.id, 'expired', true));
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 1.2 TypeScript Types Update

**File:** `types/database.ts`

Update the `Match` type:
```typescript
matches: {
  Row: {
    // ... existing fields ...

    // NEW FIELDS
    submission_deadline: string | null;         // 2 hours from acceptance
    challenger_submitted_at: string | null;     // timestamp when challenger submitted
    opponent_submitted_at: string | null;       // timestamp when opponent submitted

    // REDEFINED SEMANTICS (same column names, different meaning)
    // challenger_ready: now means "challenger has submitted their score"
    // opponent_ready: now means "opponent has submitted their score"
  };
};
```

Add new RPC function type:
```typescript
Functions: {
  // ... existing functions ...

  submit_match_score: {
    Args: { p_match_id: string; p_user_id: string; p_reps: number };
    Returns: Database['public']['Tables']['matches']['Row'];
  };

  handle_expired_matches: {
    Args: {};
    Returns: void;
  };
};
```

---

## Phase 2: Service Layer Changes

### 2.1 Update `services/match.service.ts`

**Remove these functions:**
```typescript
// DELETE: setReady() - no longer needed
export async function setReady(matchId: string, userId: string, isChallenger: boolean): Promise<Match>
```

**Add new function:**
```typescript
export async function submitMatchScore(
  matchId: string,
  userId: string,
  isChallenger: boolean,
  reps: number
): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('submit_match_score', {
    p_match_id: matchId,
    p_user_id: userId,
    p_reps: reps,
  });
  if (error) throw error;
  return data as Match;
}

// Optional: helper to check if match has expired
export async function isMatchExpired(match: Match): Promise<boolean> {
  if (!match.submission_deadline) return false;
  return new Date() > new Date(match.submission_deadline);
}

// Optional: trigger expired match cleanup manually
export async function cleanupExpiredMatches(): Promise<void> {
  const { error } = await (supabase.rpc as any)('handle_expired_matches');
  if (error) throw error;
}
```

**No changes needed to:**
- `subscribeToMatch()` — already watches for all UPDATE events on matches, will catch submission_deadline, ready flag changes, status changes
- `createMatch()` — works as-is, submission_deadline set during accept
- `acceptMatch()` — updated via migration (sets submission_deadline)
- `getMatch()` — works as-is, returns all new fields
- `getOpenChallenges()` — works as-is

---

## Phase 3: Match Screen Rewrite

### 3.1 `app/match/[id].tsx` - Complete Rewrite

**New type definition:**
```typescript
type MatchPhase = 'loading' | 'pre_record' | 'recording' | 'submitted' | 'expired' | 'results';
```

**Key changes:**

#### Loading Phase
- Fetch match
- Subscribe to realtime updates
- If `submission_deadline` has passed → `expired` phase
- If both `challenger_ready` AND `opponent_ready` → `results` phase
- If `my submission already submitted` → `submitted` phase
- Otherwise → `pre_record` phase

#### Pre-Record Phase
```
┌─────────────────────────────────┐
│  RECORDING WINDOW ACTIVE         │
├─────────────────────────────────┤
│  Exercise: Push-ups              │
│  Wager: $5.00                    │
│  Deadline: 1h 47m remaining      │
├─────────────────────────────────┤
│  [START RECORDING]               │
│  (Large button)                  │
└─────────────────────────────────┘
```

- Display:
  - Exercise type + icon
  - Wager amount
  - Time remaining countdown (updates every second)
  - "START RECORDING" button
- User taps → phases to `recording`

#### Recording Phase
```
┌─────────────────────────────────┐
│  1:00 (60 seconds)               │
├─────────────────────────────────┤
│  [Camera preview]                │
│  [Pose detection running]        │
├─────────────────────────────────┤
│         47 REPS                  │
├─────────────────────────────────┤
│  [TAP TO COUNT REP] (dev button) │
└─────────────────────────────────┘
```

- Timer counts from 60 down to 0
- Large rep counter in center
- Camera feed with pose detection active
- When timer hits 0:
  - Automatically call `submitMatchScore(matchId, userId, isChallenger, repCount)`
  - Phase → `submitted`
  - Reset Zustand store

#### Submitted Phase
```
┌─────────────────────────────────┐
│  ✓ SCORE SUBMITTED               │
├─────────────────────────────────┤
│  You recorded: 47 REPS           │
├─────────────────────────────────┤
│  Waiting for opponent to submit  │
│  their reps...                   │
│                                  │
│  Deadline: 1h 12m remaining      │
├─────────────────────────────────┤
│  (opponent scores HIDDEN)         │
│  (shown only after both submit)   │
└─────────────────────────────────┘
```

- Display:
  - Confirmation: "Score submitted"
  - Your rep count (visible to you)
  - "Waiting for [opponent username] to record..."
  - Countdown to deadline
  - Opponent's score is **HIDDEN** (shows "?"  or "Awaiting submission")
- Realtime subscription watches for:
  - `match.opponent_ready` becomes true (or whichever opponent flag)
  - `match.status` becomes 'completed'
- When both submitted:
  - Match resolved automatically by RPC
  - Fetch updated match data
  - Show results inline or navigate to results screen

#### Expired Phase
```
┌─────────────────────────────────┐
│  ⏱ MATCH EXPIRED                 │
├─────────────────────────────────┤
│  Submission deadline has passed. │
│  Opponent did not record their   │
│  reps in time.                   │
│                                  │
│  ✓ Wager refunded to both        │
│                                  │
│  [BACK TO HOME]                  │
└─────────────────────────────────┘
```

- Shown if:
  - User loads the match and `submission_deadline < now()` AND not both submitted
  - Auto-triggered on load or via realtime subscription if deadline passes while viewing
- Display:
  - "Match Expired"
  - Explanation
  - "Wager refunded" message
  - Back button

#### Results Phase (inline or navigate to results.tsx)
- Show final results:
  - Your reps vs opponent's reps
  - Who won
  - Your balance change
  - XP gained
  - Confetti if won
  - Badges earned

**Implementation Notes:**

```typescript
// Fetch match on load
async function loadMatch() {
  const m = await getMatch(id);
  setMatch(m);
  setActiveMatch(m);

  // Determine phase
  if (isExpired(m)) {
    setPhase('expired');
  } else if (m.status === 'completed') {
    setPhase('results');
  } else if (didISubmit(m)) {
    setPhase('submitted');
  } else if (m.status === 'accepted') {
    setPhase('pre_record');
  }

  // Subscribe to updates
  subscribeToMatch(m.id, (updated) => {
    setMatch(updated);

    // Auto-advance phases based on updates
    if (updated.status === 'completed') {
      setPhase('results'); // or navigate to results.tsx
    }

    if (isExpired(updated) && phase !== 'expired') {
      setPhase('expired');
    }
  });
}

// Helper functions
function isExpired(match: Match): boolean {
  return match.submission_deadline && new Date() > new Date(match.submission_deadline);
}

function didISubmit(match: Match): boolean {
  const isChallenger = match.challenger_id === session.user.id;
  return isChallenger ? match.challenger_ready : match.opponent_ready;
}

// Recording complete → auto-submit
function handleRecordingComplete(finalReps: number) {
  setPhase('submitting'); // optional, for UX feedback

  submitMatchScore(matchId, session.user.id, isChallenger, finalReps)
    .then((updated) => {
      setMatch(updated);

      // If match auto-resolved (both submitted), jump to results
      if (updated.status === 'completed') {
        setPhase('results');
      } else {
        setPhase('submitted');
      }
    })
    .catch((err) => {
      showToast({ type: 'error', title: 'Failed to submit score' });
      setPhase('recording'); // let user try again
    });
}
```

---

## Phase 4: Home Screen Updates

### 4.1 `app/(tabs)/index.tsx` - Async Aware Display

**Changes to "Active Matches" section:**

```typescript
// Categorize active matches into async states
const myRecordingNeeded = activeMatches.filter(m =>
  m.status === 'accepted' && !didUserSubmit(m, session.user.id)
);

const waitingForOpponent = activeMatches.filter(m =>
  m.status === 'accepted' && didUserSubmit(m, session.user.id) && !didOpponentSubmit(m, session.user.id)
);

const justCompleted = activeMatches.filter(m =>
  m.status === 'completed' && !hasViewedResults(m.id) // track viewed in Zustand
);
```

**Display three subsections:**

1. **"🎯 Your Turn to Record"** (if `myRecordingNeeded.length > 0`)
   - Shows cards with "RECORD NOW" button
   - Deadline countdown badge

2. **"⏳ Waiting for Opponent"** (if `waitingForOpponent.length > 0`)
   - Shows opponent's name
   - "Recording their reps..." message
   - Deadline countdown for opponent

3. **"✅ Match Results"** (if `justCompleted.length > 0`)
   - Shows win/loss
   - "Tap to view"

---

## Phase 5: MatchCard Component Update

### 5.1 `components/MatchCard.tsx` Changes

**Add submission state prop:**
```typescript
interface MatchCardProps {
  match: Match;
  submissionState: 'record_needed' | 'waiting_opponent' | 'completed';
  onPress: () => void;
}
```

**Render state-specific UI:**
```tsx
{submissionState === 'record_needed' && (
  <>
    <Text style={styles.ctaText}>RECORD YOUR REPS</Text>
    <View style={styles.deadlineTimer}>
      <Clock size={12} color={colors.accent} />
      <Text style={styles.timerText}>{hoursRemaining}h remaining</Text>
    </View>
  </>
)}

{submissionState === 'waiting_opponent' && (
  <>
    <Text style={styles.waitingText}>Waiting for opponent...</Text>
    <ActivityIndicator size="small" color={colors.primary} />
  </>
)}

{submissionState === 'completed' && (
  <>
    <Text style={styles.resultText}>
      {match.winner_id === session.user.id ? '✅ YOU WON' : '❌ YOU LOST'}
    </Text>
  </>
)}
```

---

## Phase 6: Results Screen Update

### 6.1 `app/match/results.tsx` Changes

**Currently:** Only shows `myReps` from route params

**Updated:** Fetch full match object to show both scores

```typescript
useEffect(() => {
  // Fetch the full match object to show opponent's score
  getMatch(matchId).then((match) => {
    setFullMatch(match);
    // Now we can show both scores
  });
}, [matchId]);

return (
  <View>
    {/* Your reps */}
    <Text style={styles.yourReps}>{fullMatch.challenger_reps}</Text>
    <Text>vs</Text>
    {/* Opponent reps */}
    <Text style={styles.opponentReps}>{fullMatch.opponent_reps}</Text>
  </View>
);
```

---

## Phase 7: Zustand Store Minimal Changes

### 7.1 `stores/matchStore.ts`

**No major changes needed.**

The `activeMatch` object structure remains the same:
```typescript
{
  match: Match,
  myReps: number,
  opponentReps: number, // Still here, but only populated after match completes
  timeLeft: number,      // Only used during 60s recording window
  isRunning: boolean
}
```

**Minor improvement (optional):**
```typescript
// Add helper to check if I've submitted
didUserSubmitted: (matchId: string, userId: string) => boolean
```

---

## Implementation Order

1. **Create migration file** (`20260221_async_matches.sql`)
   - Add new columns
   - Create `submit_match_score()` RPC
   - Update `accept_match()` RPC

2. **Update types** (`types/database.ts`)
   - Add new field types
   - Add new RPC signatures

3. **Update services** (`match.service.ts`)
   - Remove `setReady()`
   - Add `submitMatchScore()`
   - Add `isMatchExpired()`

4. **Rewrite match screen** (`app/match/[id].tsx`)
   - New phases: pre_record, recording, submitted, expired
   - New subscription logic
   - Auto-submit on timer complete

5. **Update home screen** (`app/(tabs)/index.tsx`)
   - Categorize active matches by submission state
   - Show 3 sections: "Your Turn", "Waiting", "Results"

6. **Update MatchCard** (`components/MatchCard.tsx`)
   - Add submission state UI
   - Show deadline countdowns

7. **Update results screen** (`app/match/results.tsx`)
   - Fetch full match to show both scores

8. **Testing**
   - User 1 accepts challenge
   - User 1 records reps, submits
   - Sees "Waiting for opponent..."
   - User 2 records reps, submits
   - Both see results with full score comparison

---

## Key Advantages of Async Flow

✅ No friction from "both players must be simultaneously ready"
✅ 2-hour window accommodates different schedules
✅ Full refund prevents bad feelings if one player forgets
✅ Hidden scores prevent gaming the system (going second)
✅ Auto-resolution when both submit (no manual winner call)
✅ Clear status indicators at each step
✅ Live updates via Supabase realtime

---

## Testing Checklist

- [ ] User A accepts challenge, gets deadline
- [ ] User A can record within 2h window
- [ ] User A submits, sees "Waiting..."
- [ ] User A cannot see User B's score
- [ ] User B still has X hours to submit
- [ ] User B records and submits
- [ ] Match auto-resolves, both see results with actual scores
- [ ] If User C doesn't submit before 2h, both get refund
- [ ] Results show XP gained for both players
- [ ] Leaderboard reflects new XP
- [ ] Home screen shows correct state indicators

