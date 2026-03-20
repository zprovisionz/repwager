import { supabase } from '@/lib/supabase';

export interface FreezeResult {
  success: boolean;
  freeze_count: number;
  frozen_until?: string;
}

export async function useFreeze(userId: string): Promise<FreezeResult> {
  const { data, error } = await (supabase.rpc as any)('use_streak_freeze', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as FreezeResult;
}

export async function awardFreezeForCasualMilestone(
  userId: string
): Promise<{ awarded: boolean; freeze_count: number }> {
  const { data, error } = await (supabase.rpc as any)('check_and_award_freeze', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data as { awarded: boolean; freeze_count: number };
}

export function checkStreakStatus(profile: {
  current_streak: number;
  last_active_date: string | null;
  streak_frozen_until?: string | null;
}): {
  isAtRisk: boolean;
  isFrozen: boolean;
  frozenUntil: Date | null;
} {
  const now = new Date();

  const isFrozen =
    !!profile.streak_frozen_until &&
    new Date(profile.streak_frozen_until) > now;

  const frozenUntil = isFrozen ? new Date(profile.streak_frozen_until!) : null;

  let isAtRisk = false;
  if (profile.last_active_date && !isFrozen) {
    const lastActive = new Date(profile.last_active_date);
    const hoursSinceLast =
      (now.getTime() - lastActive.getTime()) / (1000 * 60 * 60);
    isAtRisk = hoursSinceLast >= 20 && profile.current_streak > 0;
  }

  return { isAtRisk, isFrozen, frozenUntil };
}
