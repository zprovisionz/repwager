import type { Match } from '@/types/database';

export type AsyncPhase = 'PENDING' | 'ACCEPTED' | 'IN_PROGRESS' | 'SUBMISSION_WINDOW' | 'COMPLETED';

/**
 * Determine the current async match phase
 */
export function getAsyncPhase(match: Match): AsyncPhase {
  // If match is completed, return completed
  if (match.status === 'completed') {
    return 'COMPLETED';
  }

  // If match is not accepted yet, it's pending
  if (match.status === 'pending') {
    return 'PENDING';
  }

  // If match is cancelled or disputed, treat as completed for UI purposes
  if (match.status === 'cancelled' || match.status === 'disputed') {
    return 'COMPLETED';
  }

  // If match is accepted but recording hasn't started, it's accepted
  if (match.status === 'accepted' && !match.started_at) {
    return 'ACCEPTED';
  }

  // If match is accepted and recording is in progress
  if (match.status === 'accepted' && match.started_at && !match.submission_deadline) {
    return 'IN_PROGRESS';
  }

  // If match has submission_deadline, it's in submission window
  if (match.submission_deadline) {
    return 'SUBMISSION_WINDOW';
  }

  // Default to accepted state
  return 'ACCEPTED';
}

/**
 * Check if the submission deadline has passed
 */
export function isSubmissionDeadlineExpired(match: Match): boolean {
  if (!match.submission_deadline) return false;
  const now = new Date();
  const deadline = new Date(match.submission_deadline);
  return now > deadline;
}

/**
 * Check if current user can submit their score
 * Returns { canSubmit: boolean, reason?: string }
 */
export function canSubmitScore(match: Match, currentUserId: string): { canSubmit: boolean; reason?: string } {
  // Check if deadline has passed
  if (isSubmissionDeadlineExpired(match)) {
    return { canSubmit: false, reason: 'Submission deadline has passed' };
  }

  // Check if user has already submitted
  const isChallenger = match.challenger_id === currentUserId;
  const userSubmitted = isChallenger ? match.challenger_submitted_at : match.opponent_submitted_at;

  if (userSubmitted) {
    return { canSubmit: false, reason: 'You have already submitted your score' };
  }

  // Check if match is in valid status for submission
  if (match.status !== 'in_progress' && match.status !== 'accepted') {
    return { canSubmit: false, reason: 'Match is not in a submittable state' };
  }

  return { canSubmit: true };
}

/**
 * Check if opponent's score is hidden from the current user
 * Opponent score is hidden if:
 * - Opponent has submitted (opponent_submitted_at is set)
 * - Current user has NOT submitted yet
 */
export function isOpponentScoreHidden(match: Match, currentUserId: string): boolean {
  const isChallenger = match.challenger_id === currentUserId;

  // Get opponent submission status
  const opponentSubmitted = isChallenger
    ? match.opponent_submitted_at !== null
    : match.challenger_submitted_at !== null;

  // Get current user submission status
  const userSubmitted = isChallenger
    ? match.challenger_submitted_at !== null
    : match.opponent_submitted_at !== null;

  // Opponent score is hidden if opponent has submitted but user hasn't
  return opponentSubmitted && !userSubmitted;
}

/**
 * Check if the opponent has submitted their score
 */
export function hasOpponentSubmitted(match: Match, currentUserId: string): boolean {
  const isChallenger = match.challenger_id === currentUserId;
  return isChallenger
    ? match.opponent_submitted_at !== null
    : match.challenger_submitted_at !== null;
}

/**
 * Check if current user has submitted their score
 */
export function hasUserSubmitted(match: Match, currentUserId: string): boolean {
  const isChallenger = match.challenger_id === currentUserId;
  return isChallenger
    ? match.challenger_submitted_at !== null
    : match.opponent_submitted_at !== null;
}

/**
 * Get time remaining until submission deadline in seconds
 */
export function getTimeUntilDeadline(match: Match): number {
  if (!match.submission_deadline) return 0;
  const now = new Date().getTime();
  const deadline = new Date(match.submission_deadline).getTime();
  const secondsLeft = Math.floor((deadline - now) / 1000);
  return Math.max(0, secondsLeft);
}

/**
 * Format seconds into readable format (e.g., "47 minutes 23 seconds")
 */
export function formatDeadlineTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  }

  return `${secs}s`;
}

/**
 * Get opponent data for display purposes
 */
export function getOpponentData(match: Match, currentUserId: string): { reps: number | null; submitted: boolean } {
  const isChallenger = match.challenger_id === currentUserId;
  const opponentSubmitted = isChallenger
    ? match.opponent_submitted_at !== null
    : match.challenger_submitted_at !== null;

  // If opponent score is hidden, don't show reps
  if (isOpponentScoreHidden(match, currentUserId)) {
    return {
      reps: null,
      submitted: true, // They submitted but we don't see reps yet
    };
  }

  // If both have submitted, show opponent reps
  const opponentReps = isChallenger ? match.opponent_reps : match.challenger_reps;
  return {
    reps: opponentSubmitted ? opponentReps : null,
    submitted: opponentSubmitted,
  };
}
