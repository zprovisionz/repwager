import { supabase } from '@/lib/supabase';
import type { Notification } from '@/types/database';

// ─── CORE NOTIFICATION OPERATIONS ──────────────────────────────────────────

export async function getNotifications(userId: string): Promise<Notification[]> {
  const { data, error } = await (supabase.from('notifications') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as Notification[];
}

export async function markAsRead(notificationId: string) {
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('id', notificationId);
  if (error) throw error;
}

export async function markAllAsRead(userId: string) {
  const { error } = await (supabase.from('notifications') as any)
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw error;
}

export function subscribeToNotifications(userId: string, callback: (notification: Notification) => void) {
  return supabase
    .channel(`notifications:${userId}`)
    .on('postgres_changes', {
      event: 'INSERT',
      schema: 'public',
      table: 'notifications',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      callback(payload.new as Notification);
    })
    .subscribe();
}

// ─── PUSH NOTIFICATION HELPER ──────────────────────────────────────────────

/**
 * Send both database notification and push notification to user
 */
async function sendNotificationToPush(
  userId: string,
  type: 'match_challenge' | 'match_accepted' | 'match_completed' | 'badge_earned' | 'dispute_filed' | 'dispute_resolved' | 'opponent_submitted' | 'new_challenge' | 'inactivity_nudge' | 'streak_reminder',
  title: string,
  body: string,
  data: Record<string, unknown> = {}
) {
  try {
    // Save to notifications table
    const { error: dbError } = await (supabase.from('notifications') as any).insert({
      user_id: userId,
      type,
      title,
      body,
      data,
    });

    if (dbError) console.error('[notification.service] DB insert error:', dbError);

    // Send push notification via Supabase function
    try {
      await fetch(`${supabase.supabaseUrl}/functions/v1/send-push-notification`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${supabase.auth.session()?.access_token || ''}`,
        },
        body: JSON.stringify({
          user_id: userId,
          title,
          body,
          data: { type, ...data },
        }),
      });
    } catch (pushErr) {
      console.warn('[notification.service] Push send failed (non-blocking):', pushErr);
    }
  } catch (err) {
    console.error('[notification.service] Error sending notification:', err);
  }
}

// ─── PHASE 2: NOTIFICATION TRIGGERS ───────────────────────────────────────

/**
 * Notify opponent that their opponent has submitted a score
 * Used when one player submits in an async match
 */
export async function notifyOpponentSubmitted(
  matchId: string,
  opponentUserId: string,
  opponentName: string,
  minutesRemaining: number
): Promise<void> {
  const title = `🎯 ${opponentName} submitted!`;
  const body = `You have ${minutesRemaining} minutes left to submit your score.`;
  await sendNotificationToPush(opponentUserId, 'opponent_submitted', title, body, {
    matchId,
    action: 'view_match',
  });
}

/**
 * Notify user when a new challenge is created for them
 */
export async function notifyNewChallenge(
  userId: string,
  challengerName: string,
  exerciseType: 'push_ups' | 'squats',
  wagerAmount: number,
  matchId: string
): Promise<void> {
  const exercise = exerciseType === 'push_ups' ? 'Push-Ups' : 'Squats';
  const title = `⚡ ${challengerName} challenges you!`;
  const body = `${exercise} match with $${wagerAmount.toFixed(2)} wager. Accept or pass?`;
  await sendNotificationToPush(userId, 'new_challenge', title, body, {
    matchId,
    action: 'view_challenge',
    challenger: challengerName,
    exercise: exerciseType,
  });
}

/**
 * Notify user when they unlock a badge
 */
export async function notifyBadgeUnlocked(
  userId: string,
  badgeName: string,
  badgeIcon: string,
  xpReward: number
): Promise<void> {
  const title = `🏅 Badge Unlocked: ${badgeName}`;
  const body = `You earned +${xpReward} XP! Keep it up!`;
  await sendNotificationToPush(userId, 'badge_earned', title, body, {
    badge: badgeName,
    icon: badgeIcon,
    xp: xpReward,
  });
}

/**
 * Remind user to play today to keep their streak alive
 */
export async function notifyStreakReminder(
  userId: string,
  currentStreak: number
): Promise<void> {
  const title = `🔥 Streak reminder!`;
  const body = `Keep your ${currentStreak}-day streak alive. Challenge someone today!`;
  await sendNotificationToPush(userId, 'streak_reminder', title, body, {
    streak: currentStreak,
    action: 'play_match',
  });
}

/**
 * Nudge inactive user to return and play
 */
export async function notifyInactivity(
  userId: string,
  currentStreak: number
): Promise<void> {
  const streakMsg = currentStreak > 0
    ? `Your ${currentStreak}-day streak is at risk!`
    : 'New challenges are waiting for you.';
  const title = `👋 Miss the grind?`;
  const body = streakMsg;
  await sendNotificationToPush(userId, 'inactivity_nudge', title, body, {
    streak: currentStreak,
    action: 'play_match',
  });
}

// ─── PHASE 2: LEAGUE NOTIFICATIONS ────────────────────────────────────────

/**
 * Notify league members that a new match has been scheduled
 */
export async function notifyLeagueMatchScheduled(
  userIds: string[],
  leagueName: string,
  opponentLeagueName: string,
  matchId: string
): Promise<void> {
  for (const userId of userIds) {
    try {
      const title = `⚔️ League Match: ${leagueName} vs ${opponentLeagueName}`;
      const body = 'Your league is facing a new opponent! Get ready to compete.';
      await sendNotificationToPush(userId, 'match_challenge', title, body, {
        type: 'league_match_scheduled',
        matchId,
        leagueName,
        action: 'view_league_match',
      });
    } catch (err) {
      console.warn('[Notification] Failed to send league match notification:', err);
    }
  }
}

/**
 * Notify user when they advance in playoff bracket
 */
export async function notifyLeaguePlayoffAdvance(
  userId: string,
  leagueName: string,
  roundName: string
): Promise<void> {
  try {
    const title = `🏆 Playoffs Advancing: ${leagueName}`;
    const body = `You advanced to the ${roundName}!`;
    await sendNotificationToPush(userId, 'match_completed', title, body, {
      type: 'league_playoff_advance',
      leagueName,
      roundName,
      action: 'view_playoff_bracket',
    });
  } catch (err) {
    console.warn('[Notification] Failed to send playoff advance notification:', err);
  }
}

/**
 * Notify user when they level up in a league
 */
export async function notifyLeagueLevelUp(
  userId: string,
  leagueName: string,
  newLevel: number,
  newTitle?: string
): Promise<void> {
  try {
    const titleMsg = newTitle ? ` (${newTitle})` : '';
    const title = `⭐ League Level Up in ${leagueName}`;
    const body = `Congratulations! You reached Level ${newLevel}${titleMsg}.`;
    await sendNotificationToPush(userId, 'badge_earned', title, body, {
      type: 'league_level_up',
      leagueName,
      newLevel,
      newTitle: newTitle || '',
      action: 'view_league',
    });
  } catch (err) {
    console.warn('[Notification] Failed to send level up notification:', err);
  }
}
