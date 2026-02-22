import { supabase } from '@/lib/supabase';
import { notifyOpponentSubmitted, notifyNewChallenge } from '@/services/notification.service';
import { getTimeUntilDeadline, formatDeadlineTime } from '@/services/asyncMatch.service';
import { autoEnrollUserInDefaultLeague, updateLeaguePoints, getOrCreateDefaultLeague } from '@/services/league.service';
import type { Match } from '@/types/database';

export async function createMatch(challengerId: string, exerciseType: 'push_ups' | 'squats', wagerAmount: number, opponentId?: string, mode: 'competitive' | 'casual' = 'competitive'): Promise<Match> {
  const { data, error } = await (supabase.from('matches') as any)
    .insert({
      challenger_id: challengerId,
      exercise_type: exerciseType,
      wager_amount: wagerAmount,
      status: 'pending',
      opponent_id: opponentId ?? null,
      mode,
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Match not created');

  // Send notification to opponent if specific opponent (not open challenge)
  if (opponentId) {
    try {
      const { data: challenger } = await (supabase.from('profiles') as any)
        .select('display_name')
        .eq('id', challengerId)
        .maybeSingle();

      if (challenger) {
        await notifyNewChallenge(
          opponentId,
          challenger.display_name || 'Unknown Player',
          exerciseType,
          wagerAmount,
          data.id
        );
      }
    } catch (notifErr) {
      console.warn('[match.service] Failed to send challenge notification:', notifErr);
    }
  }

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

export async function getHotMatches(limit = 6): Promise<any[]> {
  const { data, error } = await (supabase.from('matches') as any)
    .select('id, exercise_type, wager_amount, mode, created_at, profiles!matches_challenger_id_fkey(username)')
    .eq('status', 'pending')
    .is('opponent_id', null)
    .gt('expires_at', new Date().toISOString())
    .order('wager_amount', { ascending: false })
    .limit(limit);
  if (error) return [];
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

  // Send notification to opponent when this user submits
  if (data) {
    try {
      const match = data as Match;
      const isChallenger = match.challenger_id === userId;
      const opponentId = isChallenger ? match.opponent_id : match.challenger_id;

      if (opponentId && !match.opponent_submitted_at && !match.challenger_submitted_at) {
        // Only send notification if opponent hasn't already submitted
        const { data: submitter } = await (supabase.from('profiles') as any)
          .select('display_name')
          .eq('id', userId)
          .maybeSingle();

        if (submitter && match.submission_deadline) {
          const timeLeft = getTimeUntilDeadline(match);
          const minutesRemaining = Math.ceil(timeLeft / 60);

          await notifyOpponentSubmitted(
            matchId,
            opponentId,
            submitter.display_name || 'Your opponent',
            minutesRemaining
          );
        }
      }
    } catch (notifErr) {
      console.warn('[match.service] Failed to send opponent notification:', notifErr);
    }
  }

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

/**
 * Handle post-match league updates (called after match completion)
 * Enrolls user in default league and awards points if they won
 */
export async function updateMatchLeagueStats(
  userId: string,
  userLevel: number,
  isWinner: boolean
): Promise<void> {
  try {
    // Auto-enroll in default league
    await autoEnrollUserInDefaultLeague(userId);

    // Award points if winner
    if (isWinner) {
      const league = await getOrCreateDefaultLeague();
      await updateLeaguePoints(userId, league.id, userLevel);
    }
  } catch (err) {
    console.warn('[match.service] updateMatchLeagueStats error:', err);
  }
}
