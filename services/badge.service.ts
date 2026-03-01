import { supabase } from '@/lib/supabase';
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

export async function checkAndAwardBadges(
  userId: string,
  profile: Profile,
  matchReps?: number,
  exerciseType?: 'push_ups' | 'squats'
): Promise<string[]> {
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
      if (!error) awarded.push(badgeId);
    }
  };

  await checkBadge('first_win', profile.wins >= 1);
  await checkBadge('hot_streak', profile.current_streak >= 3);
  await checkBadge('unstoppable', profile.current_streak >= 10);
  await checkBadge('veteran', profile.wins + profile.losses >= 50);
  await checkBadge('rep_legend', profile.total_reps >= 1000);

  if (matchReps !== undefined && exerciseType) {
    await checkBadge('pushup_centurion', exerciseType === 'push_ups' && matchReps >= 100);
    await checkBadge('squat_master', exerciseType === 'squats' && matchReps >= 100);
  }

  return awarded;
}
