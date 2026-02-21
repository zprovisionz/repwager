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
