import { supabase } from '@/lib/supabase';

export interface StreakUpdateResult {
  currentStreak: number;
  longestStreak: number;
  /** True when this win crossed a 7-milestone and a new freeze was granted. */
  grantedFreeze: boolean;
  /** True when a loss was absorbed by a held freeze instead of resetting streak. */
  usedFreeze: boolean;
}

export interface StreakStatus {
  currentStreak: number;
  longestStreak: number;
  /** Whether the user currently holds an unconsumed freeze token. */
  freezeAvailable: boolean;
  /** ISO timestamp of the last freeze consumption, or null if never used. */
  freezeUsedAt: string | null;
}

/**
 * Call after every match win.
 * - Increments current_streak and updates longest_streak.
 * - Automatically grants a streak freeze at every 7-win milestone
 *   (only if one isn't already held).
 */
export async function incrementStreak(userId: string): Promise<StreakUpdateResult> {
  console.log('[streak] incrementStreak — userId:', userId);
  const { data, error } = await (supabase.rpc as any)('update_streak', {
    p_user_id: userId,
    p_won: true,
  });
  if (error) throw error;
  const result = mapResult(data);
  console.log('[streak] incrementStreak result:', result);
  return result;
}

/**
 * Call after every match loss.
 * - If a freeze token is held it is consumed: streak is preserved.
 * - Otherwise current_streak resets to 0.
 *
 * The `hasFreeze` parameter is informational (used at call-site for early
 * UI decisions); the DB record is always the source of truth.
 */
export async function decrementStreak(
  userId: string,
  hasFreeze: boolean,
): Promise<StreakUpdateResult> {
  console.log('[streak] decrementStreak — userId:', userId, '| hasFreeze:', hasFreeze);
  const { data, error } = await (supabase.rpc as any)('update_streak', {
    p_user_id: userId,
    p_won: false,
  });
  if (error) throw error;
  const result = mapResult(data);
  console.log('[streak] decrementStreak result:', result);
  return result;
}

/**
 * Manually grants a streak freeze token to a user.
 * In normal gameplay this is triggered automatically by the 7-win milestone
 * inside update_streak(). Exposed here for admin tooling and testing.
 */
export async function grantStreakFreeze(userId: string): Promise<void> {
  console.log('[streak] grantStreakFreeze — userId:', userId);
  const { error } = await (supabase.rpc as any)('grant_streak_freeze', {
    p_user_id: userId,
  });
  if (error) throw error;
}

/**
 * Returns the current streak state for a user without modifying anything.
 */
export async function getStreakStatus(userId: string): Promise<StreakStatus> {
  const { data, error } = await (supabase.from('profiles') as any)
    .select('current_streak, longest_streak, streak_freeze_available, streak_freeze_used_at')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return {
    currentStreak: data?.current_streak ?? 0,
    longestStreak: data?.longest_streak ?? 0,
    freezeAvailable: data?.streak_freeze_available ?? false,
    freezeUsedAt: data?.streak_freeze_used_at ?? null,
  };
}

// ── helpers ───────────────────────────────────────────────────────────────────

function mapResult(raw: any): StreakUpdateResult {
  return {
    currentStreak: raw?.current_streak ?? 0,
    longestStreak: raw?.longest_streak ?? 0,
    grantedFreeze: raw?.granted_freeze ?? false,
    usedFreeze:    raw?.used_freeze    ?? false,
  };
}
