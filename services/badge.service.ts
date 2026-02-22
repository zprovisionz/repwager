import { supabase } from '@/lib/supabase';
import { notifyBadgeUnlocked } from '@/services/notification.service';
import type { Badge, UserBadge } from '@/types/database';
import type { Profile } from '@/types/database';

export async function getUserBadges(userId: string): Promise<(UserBadge & { badge: Badge })[]> {
  const { data, error } = await (supabase.from('user_badges') as any)
    .select('*, badge:badges(*)')
    .eq('user_id', userId)
    .order('earned_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as (UserBadge & { badge: Badge })[];
}

export async function getAllBadges(): Promise<Badge[]> {
  const { data, error } = await (supabase.from('badges') as any).select('*').order('xp_reward');
  if (error) throw error;
  return (data ?? []) as Badge[];
}

export async function checkAndAwardBadges(userId: string, profile: Profile, matchReps?: number): Promise<string[]> {
  const awarded: string[] = [];

  const checkBadge = async (badgeId: string, condition: boolean) => {
    if (!condition) return;
    const { data } = await (supabase.from('user_badges') as any)
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badgeId)
      .maybeSingle();
    if (!data) {
      const { error } = await (supabase.from('user_badges') as any)
        .insert({ user_id: userId, badge_id: badgeId });
      if (!error) {
        awarded.push(badgeId);
        // Send notification for new badge
        await sendBadgeNotification(userId, badgeId);
      }
    }
  };

  await checkBadge('first_win', profile.wins >= 1);
  await checkBadge('hot_streak', profile.current_streak >= 3);
  await checkBadge('unstoppable', profile.current_streak >= 10);
  await checkBadge('veteran', profile.wins + profile.losses >= 50);
  await checkBadge('rep_legend', profile.total_reps >= 1000);

  if (matchReps !== undefined) {
    await checkBadge('pushup_centurion', matchReps >= 100);
    await checkBadge('squat_master', matchReps >= 100);
  }

  return awarded;
}

/**
 * Send notification when a badge is unlocked
 */
async function sendBadgeNotification(userId: string, badgeId: string): Promise<void> {
  try {
    const { data: badge } = await (supabase.from('badges') as any)
      .select('name, icon, xp_reward')
      .eq('id', badgeId)
      .maybeSingle();

    if (badge) {
      await notifyBadgeUnlocked(
        userId,
        badge.name,
        badge.icon || '🏅',
        badge.xp_reward || 0
      );
    }
  } catch (err) {
    console.warn('[badge.service] Failed to send badge notification:', err);
  }
}
