import { supabase } from '@/lib/supabase';
import type { Match } from '@/types/database';

export async function createMatch(challengerId: string, exerciseType: 'push_ups' | 'squats', wagerAmount: number, opponentId?: string): Promise<Match> {
  const { data, error } = await (supabase.from('matches') as any)
    .insert({
      challenger_id: challengerId,
      exercise_type: exerciseType,
      wager_amount: wagerAmount,
      status: 'pending',
      opponent_id: opponentId ?? null,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Match not created');
  return data as Match;
}

export async function acceptMatch(matchId: string, opponentId: string): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('accept_match', {
    p_match_id: matchId,
    p_opponent_id: opponentId,
  });
  if (error) throw error;
  return data as Match;
}

export async function startMatch(matchId: string): Promise<Match> {
  const { data, error } = await (supabase.from('matches') as any)
    .update({ status: 'in_progress', started_at: new Date().toISOString() })
    .eq('id', matchId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Match not found');
  return data as Match;
}

export async function completeMatch(matchId: string, winnerId: string, challengerReps: number, opponentReps: number): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('complete_match', {
    p_match_id: matchId,
    p_winner_id: winnerId,
    p_challenger_reps: challengerReps,
    p_opponent_reps: opponentReps,
  });
  if (error) throw error;
  return data as Match;
}

export async function cancelMatch(matchId: string): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('cancel_match', { p_match_id: matchId });
  if (error) throw error;
  return data as Match;
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await (supabase.from('matches') as any)
    .select('*')
    .eq('id', matchId)
    .maybeSingle();
  if (error) throw error;
  return data as Match | null;
}

export async function getUserMatches(userId: string, status?: string) {
  let query = (supabase.from('matches') as any)
    .select('*')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getOpenChallenges(limit = 20) {
  const { data, error } = await (supabase.from('matches') as any)
    .select('*, profiles!matches_challenger_id_fkey(username, display_name, wins, losses, avatar_gender)')
    .eq('status', 'pending')
    .is('opponent_id', null)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fileDispute(matchId: string, reason: string): Promise<Match> {
  const { data, error } = await (supabase.from('matches') as any)
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', matchId)
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Match not found');
  return data as Match;
}

export async function submitMatchScore(matchId: string, userId: string, reps: number): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('submit_match_score', {
    p_match_id: matchId,
    p_user_id: userId,
    p_reps: reps,
  });
  if (error) throw error;
  return data as Match;
}

export function isMatchExpired(match: Match): boolean {
  if (!match.submission_deadline) return false;
  return new Date() > new Date(match.submission_deadline);
}

export async function cleanupExpiredMatches(): Promise<void> {
  const { error } = await (supabase.rpc as any)('handle_expired_matches');
  if (error) throw error;
}

export function subscribeToMatch(matchId: string, callback: (match: Match) => void) {
  return supabase
    .channel(`match:${matchId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'matches',
      filter: `id=eq.${matchId}`,
    }, (payload) => {
      callback(payload.new as Match);
    })
    .subscribe();
}
