import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

export async function getProfile(userId: string): Promise<Profile> {
  const { data, error } = await (supabase.from('profiles') as any)
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Profile not found');
  return data as Profile;
}

export async function updateProfile(userId: string, updates: Partial<Pick<Profile, 'display_name' | 'avatar_gender' | 'avatar_head' | 'avatar_torso' | 'avatar_legs'>>) {
  const { data, error } = await (supabase.from('profiles') as any)
    .update(updates)
    .eq('id', userId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data as Profile | null;
}

export async function getLeaderboard(limit = 20) {
  const { data, error } = await (supabase.from('profiles') as any)
    .select('id, username, display_name, wins, losses, total_reps, total_xp, avatar_gender, avatar_head, avatar_torso, avatar_legs')
    .order('total_xp', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function searchProfiles(query: string) {
  const { data, error } = await (supabase.from('profiles') as any)
    .select('id, username, display_name, wins, losses, total_xp, avatar_gender')
    .ilike('username', `%${query}%`)
    .limit(10);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getTransactions(userId: string) {
  const { data, error } = await (supabase.from('transactions') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getCompetitiveLeaderboard(limit = 50) {
  const { data, error } = await (supabase.rpc as any)('get_competitive_leaderboard', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getCasualLeaderboard(limit = 50) {
  const { data, error } = await (supabase.rpc as any)('get_casual_leaderboard', {
    p_limit: limit,
  });
  if (error) throw error;
  return (data ?? []) as any[];
}

export async function getUserLeaderboardRank(userId: string): Promise<number | null> {
  try {
    const data = await getCompetitiveLeaderboard(100);
    const idx = (data as any[]).findIndex((r: any) => r.user_id === userId);
    return idx >= 0 ? idx + 1 : null;
  } catch {
    return null;
  }
}

export async function markOnboardingShown(userId: string): Promise<void> {
  await (supabase.from('profiles') as any)
    .update({ onboarding_shown: true })
    .eq('id', userId);
}

export async function getUserStats(userId: string) {
  const { data, error } = await (supabase.rpc as any)('get_user_stats', {
    p_user_id: userId,
  });
  if (error) throw error;
  return data?.[0] ?? null;
}
