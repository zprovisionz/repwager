import { supabase } from '@/lib/supabase';
import { notifyStreakReminder } from '@/services/notification.service';
import type { Profile } from '@/types/database';

// ─── STREAK CONSTANTS ──────────────────────────────────────────────────────

export const STREAK_FREEZE_UNLOCK_THRESHOLD = 7; // Grant freeze at 7-day streak
export const STREAK_FREEZE_RESET_THRESHOLD = 7; // Reset freeze availability at 7-day streak

// ─── STREAK OPERATIONS ────────────────────────────────────────────────────

/**
 * Increment user streak by 1 (after a win)
 * Also checks if they've unlocked a new freeze at 7-day milestone
 */
export async function incrementStreak(userId: string): Promise<{
  newStreak: number;
  freezeGranted: boolean;
}> {
  try {
    // Get current profile
    const { data: profile, error: getErr } = await (supabase.from('profiles') as any)
      .select('current_streak, longest_streak, streak_freeze_available')
      .eq('id', userId)
      .maybeSingle();

    if (getErr || !profile) throw getErr || new Error('Profile not found');

    const newStreak = (profile.current_streak ?? 0) + 1;
    const updates: any = {
      current_streak: newStreak,
      longest_streak: Math.max(newStreak, profile.longest_streak ?? 0),
      last_active_date: new Date().toISOString(),
    };

    // Grant freeze at 7-day streak
    let freezeGranted = false;
    if (newStreak === STREAK_FREEZE_UNLOCK_THRESHOLD && !profile.streak_freeze_available) {
      updates.streak_freeze_available = true;
      freezeGranted = true;
    }

    const { error: updateErr } = await (supabase.from('profiles') as any)
      .update(updates)
      .eq('id', userId);

    if (updateErr) throw updateErr;

    return { newStreak, freezeGranted };
  } catch (err) {
    console.error('[streak.service] incrementStreak error:', err);
    throw err;
  }
}

/**
 * Decrement user streak (after a loss)
 * If user has freeze available, consume it and preserve streak
 * Otherwise, reset streak to 0
 */
export async function decrementStreak(userId: string): Promise<{
  freezeConsumed: boolean;
  newStreak: number;
}> {
  try {
    // Get current profile
    const { data: profile, error: getErr } = await (supabase.from('profiles') as any)
      .select('current_streak, streak_freeze_available, streak_freeze_used_at')
      .eq('id', userId)
      .maybeSingle();

    if (getErr || !profile) throw getErr || new Error('Profile not found');

    const hasFreeze = profile.streak_freeze_available === true;
    const updates: any = {
      last_active_date: new Date().toISOString(),
    };

    let freezeConsumed = false;

    if (hasFreeze) {
      // Consume the freeze — streak is preserved
      updates.streak_freeze_available = false;
      updates.streak_freeze_used_at = new Date().toISOString();
      freezeConsumed = true;
    } else {
      // No freeze — reset streak to 0
      updates.current_streak = 0;
    }

    const { error: updateErr } = await (supabase.from('profiles') as any)
      .update(updates)
      .eq('id', userId);

    if (updateErr) throw updateErr;

    return {
      freezeConsumed,
      newStreak: freezeConsumed ? profile.current_streak : 0,
    };
  } catch (err) {
    console.error('[streak.service] decrementStreak error:', err);
    throw err;
  }
}

/**
 * Manually grant a freeze to a user (used for rewards/special events)
 */
export async function grantStreakFreeze(userId: string): Promise<void> {
  try {
    const { error } = await (supabase.from('profiles') as any)
      .update({ streak_freeze_available: true })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error('[streak.service] grantStreakFreeze error:', err);
    throw err;
  }
}

/**
 * Get comprehensive streak status for a user
 */
export async function getStreakStatus(userId: string): Promise<{
  currentStreak: number;
  longestStreak: number;
  freezeAvailable: boolean;
  freezeUsedAt: string | null;
  freezeUsedRecently: boolean;
}> {
  try {
    const { data: profile, error } = await (supabase.from('profiles') as any)
      .select('current_streak, longest_streak, streak_freeze_available, streak_freeze_used_at')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) throw error || new Error('Profile not found');

    // Check if freeze was used in last 3 days
    const freezeUsedAt = profile.streak_freeze_used_at;
    const now = new Date();
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const freezeUsedRecently = freezeUsedAt ? new Date(freezeUsedAt) > threeDaysAgo : false;

    return {
      currentStreak: profile.current_streak ?? 0,
      longestStreak: profile.longest_streak ?? 0,
      freezeAvailable: profile.streak_freeze_available ?? false,
      freezeUsedAt: profile.streak_freeze_used_at ?? null,
      freezeUsedRecently,
    };
  } catch (err) {
    console.error('[streak.service] getStreakStatus error:', err);
    throw err;
  }
}

/**
 * Check if user needs a streak reminder today
 * Returns true if they have an active streak and haven't played today
 */
export async function needsStreakReminder(userId: string): Promise<boolean> {
  try {
    const { data: profile, error } = await (supabase.from('profiles') as any)
      .select('current_streak, last_active_date')
      .eq('id', userId)
      .maybeSingle();

    if (error || !profile) return false;

    // No active streak
    if ((profile.current_streak ?? 0) < 1) return false;

    // Has active streak — check if played today
    const today = new Date().toISOString().split('T')[0];
    const lastActiveDate = profile.last_active_date ? profile.last_active_date.split('T')[0] : null;

    return lastActiveDate !== today;
  } catch (err) {
    console.error('[streak.service] needsStreakReminder error:', err);
    return false;
  }
}

/**
 * Reset user streak (used for when streak expires or admin actions)
 * Does NOT consume freeze
 */
export async function resetStreak(userId: string): Promise<void> {
  try {
    const { error } = await (supabase.from('profiles') as any)
      .update({ current_streak: 0 })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error('[streak.service] resetStreak error:', err);
    throw err;
  }
}

/**
 * Update last active date (called on any match completion)
 */
export async function updateLastActiveDate(userId: string): Promise<void> {
  try {
    const { error } = await (supabase.from('profiles') as any)
      .update({ last_active_date: new Date().toISOString() })
      .eq('id', userId);

    if (error) throw error;
  } catch (err) {
    console.error('[streak.service] updateLastActiveDate error:', err);
    throw err;
  }
}

/**
 * Format streak display string with freeze indicator
 */
export function formatStreakDisplay(status: {
  currentStreak: number;
  freezeAvailable: boolean;
  freezeUsedRecently: boolean;
}): string {
  let display = `${status.currentStreak}`;

  if (status.freezeAvailable) {
    display += ' 🛡️'; // Shield indicating freeze available
  } else if (status.freezeUsedRecently) {
    display += ' ✓'; // Checkmark indicating freeze was recently used
  }

  return display;
}
