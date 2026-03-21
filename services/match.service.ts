import { supabase } from '@/lib/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Match,
  MatchDisplay,
  MatchStatus,
  SubmitRepsResult,
  ProfileSearchResult,
  RepEvent,
} from '@/types/database';
import {
  ACTIVE_MATCH_STATUSES,
  TERMINAL_MATCH_STATUSES,
} from '@/types/database';

const repStorageKey = (matchId: string) => `repwager:reps:${matchId}`;
const repEventsStorageKey = (matchId: string) => `repwager:events:${matchId}`;

const ALLOWED_SUBMISSION_WINDOWS = new Set([1, 2, 6, 24]);

export async function createMatch(
  challengerId: string,
  exerciseType: 'push_ups' | 'squats',
  wagerAmount: number,
  mode: 'wager' | 'casual' = 'wager',
  opponentId?: string,
  submissionWindowHours: number = 2
): Promise<Match> {
  if (exerciseType === 'squats') {
    throw new Error('Squats are locked for launch — choose push-ups.');
  }
  const hours = ALLOWED_SUBMISSION_WINDOWS.has(submissionWindowHours)
    ? submissionWindowHours
    : 2;

  const { data, error } = await (supabase.from('matches') as any)
    .insert({
      challenger_id: challengerId,
      exercise_type: exerciseType,
      wager_amount: wagerAmount,
      status: 'pending',
      match_mode: mode,
      opponent_id: opponentId ?? null,
      submission_window_hours: hours,
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Match not created');

  if (opponentId) {
    await (supabase.from('notifications') as any).insert({
      user_id: opponentId,
      type: 'match_challenge',
      title: 'New Challenge!',
      body: `Someone challenged you to a ${exerciseType === 'push_ups' ? 'push-up' : 'squat'} battle for ${wagerAmount} RepCoins.`,
      data: { match_id: data.id },
    });
  }

  return data as Match;
}

export async function createDirectChallenge(
  challengerId: string,
  opponentUsername: string,
  exerciseType: 'push_ups' | 'squats',
  wagerAmount: number,
  mode: 'wager' | 'casual' = 'wager',
  submissionWindowHours: number = 2
): Promise<Match> {
  const { data: opponent, error: profileError } = await (supabase
    .from('profiles') as any)
    .select('id, display_name, username')
    .eq('username', opponentUsername.toLowerCase().trim())
    .maybeSingle();

  if (profileError) throw profileError;
  if (!opponent) throw new Error(`No user found with username @${opponentUsername}`);
  if (opponent.id === challengerId) throw new Error('You cannot challenge yourself');

  return createMatch(
    challengerId,
    exerciseType,
    wagerAmount,
    mode,
    opponent.id,
    submissionWindowHours
  );
}

export async function acceptMatch(
  matchId: string,
  opponentId: string
): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('accept_match', {
    p_match_id: matchId,
    p_opponent_id: opponentId,
  });
  if (error) throw error;
  return data as Match;
}

export async function submitReps(
  matchId: string,
  userId: string,
  reps: number,
  repEvents: RepEvent[] = []
): Promise<SubmitRepsResult> {
  const { data, error } = await (supabase.rpc as any)('submit_reps', {
    p_match_id: matchId,
    p_user_id: userId,
    p_reps: reps,
    p_rep_events: repEvents,
  });

  if (error) throw error;

  await clearLocalRepStorage(matchId);

  return data as SubmitRepsResult;
}

export async function saveRepsLocally(
  matchId: string,
  reps: number,
  repEvents: RepEvent[]
): Promise<void> {
  try {
    await AsyncStorage.setItem(repStorageKey(matchId), reps.toString());
    await AsyncStorage.setItem(
      repEventsStorageKey(matchId),
      JSON.stringify(repEvents)
    );
  } catch {
    // Non-fatal: local rep storage failed
  }
}

export async function getLocalReps(
  matchId: string
): Promise<{ reps: number; repEvents: RepEvent[] } | null> {
  try {
    const repsStr = await AsyncStorage.getItem(repStorageKey(matchId));
    const eventsStr = await AsyncStorage.getItem(repEventsStorageKey(matchId));

    if (!repsStr) return null;

    return {
      reps: parseInt(repsStr, 10),
      repEvents: eventsStr ? (JSON.parse(eventsStr) as RepEvent[]) : [],
    };
  } catch {
    return null;
  }
}

export async function clearLocalRepStorage(matchId: string): Promise<void> {
  try {
    await AsyncStorage.multiRemove([
      repStorageKey(matchId),
      repEventsStorageKey(matchId),
    ]);
  } catch {
    // Non-fatal
  }
}

export async function getMatch(matchId: string): Promise<Match | null> {
  const { data, error } = await (supabase.from('matches') as any)
    .select('*')
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data as Match | null;
}

/** Open-challenge detail: match + challenger profile row */
export async function getMatchWithChallengerProfile(
  matchId: string
): Promise<(Match & { profiles: Record<string, unknown> | null }) | null> {
  const { data, error } = await (supabase.from('matches') as any)
    .select(
      '*, profiles!matches_challenger_id_fkey(username, display_name, wins, losses, avatar_gender, elo, rank_tier)'
    )
    .eq('id', matchId)
    .maybeSingle();

  if (error) throw error;
  return data as (Match & { profiles: Record<string, unknown> | null }) | null;
}

export function buildMatchDisplay(
  match: Match,
  myUserId: string
): MatchDisplay {
  const iAmChallenger = match.challenger_id === myUserId;
  const isRevealed = match.scores_revealed_at !== null;

  const myReps = iAmChallenger ? match.challenger_reps : match.opponent_reps;
  const rawOpponentReps = iAmChallenger
    ? match.opponent_reps
    : match.challenger_reps;

  const iHaveSubmitted = iAmChallenger
    ? match.challenger_submitted_at !== null
    : match.opponent_submitted_at !== null;

  const opponentHasSubmitted = iAmChallenger
    ? match.opponent_submitted_at !== null
    : match.challenger_submitted_at !== null;

  let timeRemainingSeconds: number | null = null;
  if (match.submission_deadline) {
    const deadline = new Date(match.submission_deadline).getTime();
    const now = Date.now();
    const remaining = Math.floor((deadline - now) / 1000);
    timeRemainingSeconds = remaining > 0 ? remaining : 0;
  }

  const isExpired =
    match.status === 'expired' ||
    (timeRemainingSeconds !== null && timeRemainingSeconds <= 0);

  return {
    match,
    myReps: iHaveSubmitted ? myReps : null,
    opponentReps: isRevealed ? rawOpponentReps : null,
    iHaveSubmitted,
    opponentHasSubmitted,
    timeRemainingSeconds,
    isExpired,
    isRevealed,
    iAmChallenger,
  };
}

export async function getMatchForDisplay(
  matchId: string,
  myUserId: string
): Promise<MatchDisplay | null> {
  const match = await getMatch(matchId);
  if (!match) return null;
  return buildMatchDisplay(match, myUserId);
}

export async function getUserMatches(
  userId: string,
  filter?: 'active' | 'completed' | 'all'
): Promise<Match[]> {
  let query = (supabase.from('matches') as any)
    .select('*')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (filter === 'active') {
    query = query.in('status', ACTIVE_MATCH_STATUSES);
  } else if (filter === 'completed') {
    query = query.in('status', TERMINAL_MATCH_STATUSES);
  }

  const { data, error } = await query.limit(50);
  if (error) throw error;
  return (data ?? []) as Match[];
}

export async function getOpenChallenges(
  excludeUserId: string,
  limit = 20
): Promise<(Match & { profiles: any })[]> {
  const { data, error } = await (supabase.from('matches') as any)
    .select(
      '*, profiles!matches_challenger_id_fkey(username, display_name, wins, losses, avatar_gender, elo, rank_tier)'
    )
    .eq('status', 'pending')
    .is('opponent_id', null)
    .in('match_mode', ['wager', 'casual'])
    .neq('challenger_id', excludeUserId)
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as (Match & { profiles: any })[];
}

export async function cancelMatch(matchId: string): Promise<Match> {
  const { data, error } = await (supabase.rpc as any)('cancel_match', {
    p_match_id: matchId,
  });
  if (error) throw error;
  return data as Match;
}

export async function fileDispute(
  matchId: string,
  reason: string
): Promise<Match> {
  const { data, error } = await (supabase.from('matches') as any)
    .update({ status: 'disputed', dispute_reason: reason })
    .eq('id', matchId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Match not found');
  return data as Match;
}

export async function searchProfiles(
  query: string,
  excludeUserId?: string,
  limit = 10
): Promise<ProfileSearchResult[]> {
  if (!query || query.trim().length < 2) return [];

  const { data, error } = await (supabase.rpc as any)('search_profiles', {
    p_query: query.trim(),
    p_limit: limit,
    p_exclude_user_id: excludeUserId ?? null,
  });

  if (error) throw error;
  return (data ?? []) as ProfileSearchResult[];
}

/** Completed matches for public Theatre feed (RLS allows reading completed rows). */
export async function getPublicTheatreFeed(limit = 40): Promise<Match[]> {
  const { data, error } = await (supabase.from('matches') as any)
    .select('*')
    .eq('status', 'completed')
    .order('completed_at', { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data ?? []) as Match[];
}

/** Best winning rep count in any completed match (personal best). */
export async function getUserPersonalBestReps(userId: string): Promise<number> {
  const { data, error } = await (supabase.from('matches') as any)
    .select('challenger_reps, opponent_reps, winner_id, challenger_id, opponent_id, status')
    .eq('status', 'completed')
    .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);

  if (error) throw error;
  let max = 0;
  for (const m of data ?? []) {
    if (m.winner_id !== userId) continue;
    const mine =
      m.challenger_id === userId ? m.challenger_reps : m.opponent_reps;
    if (typeof mine === 'number' && mine > max) max = mine;
  }
  return max;
}

export function subscribeToMatch(
  matchId: string,
  callback: (match: Match) => void
) {
  return supabase
    .channel(`match:${matchId}`)
    .on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: 'matches',
        filter: `id=eq.${matchId}`,
      },
      (payload) => {
        callback(payload.new as Match);
      }
    )
    .subscribe();
}
