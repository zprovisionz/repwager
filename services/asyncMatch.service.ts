import { supabase } from '@/lib/supabase';
import { getMatch } from '@/services/match.service';
import type { Match } from '@/types/database';

export type AsyncPhase =
  | 'PENDING'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'SUBMISSION_WINDOW'
  | 'COMPLETED';

/**
 * Derives the async match phase from match state alone (no DB call).
 *
 * Phase transitions:
 *   PENDING           → match created, not yet accepted
 *   ACCEPTED          → opponent joined, neither player has started
 *   IN_PROGRESS       → match timer has started, no submissions yet
 *   SUBMISSION_WINDOW → at least one player submitted; waiting for the other
 *   COMPLETED         → both submitted (or status already completed/cancelled/disputed)
 */
export function getAsyncPhase(match: Match): AsyncPhase {
  if (match.status === 'pending') return 'PENDING';

  if (match.status === 'completed' || match.status === 'cancelled' || match.status === 'disputed') {
    return 'COMPLETED';
  }

  // Both submitted → treat as completed even if DB hasn't caught up yet
  if (match.challenger_submitted_at && match.opponent_submitted_at) {
    return 'COMPLETED';
  }

  // At least one submitted → other player still has time to submit
  if (match.challenger_submitted_at || match.opponent_submitted_at) {
    return 'SUBMISSION_WINDOW';
  }

  if (match.status === 'in_progress') return 'IN_PROGRESS';

  // status === 'accepted' and neither started
  return 'ACCEPTED';
}

/**
 * Returns true when the opponent has submitted but the current user has not.
 * In this state the opponent's rep count must remain hidden.
 */
export async function isOpponentScoreHidden(
  matchId: string,
  currentUserId: string,
): Promise<boolean> {
  const match = await getMatch(matchId);
  if (!match) return false;

  const isChallenger = match.challenger_id === currentUserId;
  const mySubmittedAt = isChallenger
    ? match.challenger_submitted_at
    : match.opponent_submitted_at;
  const opponentSubmittedAt = isChallenger
    ? match.opponent_submitted_at
    : match.challenger_submitted_at;

  return !!opponentSubmittedAt && !mySubmittedAt;
}

/**
 * Returns true if the current user is still allowed to submit their score.
 * Conditions: match active, user hasn't submitted yet, deadline not passed.
 */
export async function canSubmitScore(
  matchId: string,
  currentUserId: string,
): Promise<boolean> {
  const match = await getMatch(matchId);
  if (!match) return false;

  if (match.status !== 'in_progress' && match.status !== 'accepted') return false;

  const isChallenger = match.challenger_id === currentUserId;
  const mySubmittedAt = isChallenger
    ? match.challenger_submitted_at
    : match.opponent_submitted_at;

  if (mySubmittedAt) return false;

  if (match.submission_deadline && new Date() > new Date(match.submission_deadline)) {
    return false;
  }

  return true;
}

/**
 * Submits a rep count for the current user via the `submit_async_score` RPC.
 *
 * The RPC atomically:
 *   1. Records the rep count and submission timestamp for this player
 *   2. Sets submission_deadline = now + 2 hours on the first submission
 *   3. Calls complete_match when both players have submitted
 *
 * Returns the updated match row.
 */
export async function submitMatchScore(
  matchId: string,
  currentUserId: string,
  reps: number,
): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('submit_async_score', {
    p_match_id: matchId,
    p_user_id: currentUserId,
    p_reps: reps,
  });
  if (error) throw error;
  return data as Match;
}

/**
 * Returns how many whole minutes remain until the submission deadline.
 * Returns null if no deadline is set.
 */
export function getMinutesUntilDeadline(match: Match): number | null {
  if (!match.submission_deadline) return null;
  const msLeft = new Date(match.submission_deadline).getTime() - Date.now();
  return Math.max(0, Math.floor(msLeft / 60_000));
}
