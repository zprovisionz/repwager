import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// ─── LEAGUE TYPES ─────────────────────────────────────────────────────────

export interface League {
  id: string;
  name: string;
  type: 'PUBLIC' | 'PRIVATE';
  season: string;
  created_at: string;
  updated_at: string;
}

export interface LeagueMemb {
  id: string;
  league_id: string;
  user_id: string;
  points: number;
  rank: number;
  joined_at: string;
  profile?: Partial<Profile>;
}

export interface LeagueReward {
  rank: number; // 1, 2, 3
  reward_type: 'BADGE' | 'XP' | 'COSMETIC';
  amount: number;
}

// ─── LEAGUE CONSTANTS ──────────────────────────────────────────────────────

export const POINTS_PER_WIN = 10;
export const LEVEL_MULTIPLIER = 0.5; // Higher opponent level = more points
export const SEASON = 'Season 1: Elite';

// ─── LEAGUE OPERATIONS ────────────────────────────────────────────────────

/**
 * Get all public leagues
 */
export async function getPublicLeagues(): Promise<League[]> {
  try {
    const { data, error } = await (supabase.from('leagues') as any)
      .select('*')
      .eq('type', 'PUBLIC')
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('[league.service] getPublicLeagues error (tables may not be set up yet):', error.message);
      return [];
    }

    return (data ?? []) as League[];
  } catch (error) {
    console.warn('[league.service] getPublicLeagues exception:', error);
    return [];
  }
}

/**
 * Get league members ranked by points
 */
export async function getLeagueMembers(leagueId: string, limit = 50): Promise<LeagueMemb[]> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('*, profile:user_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs, current_level)')
      .eq('league_id', leagueId)
      .order('points', { ascending: false })
      .order('rank', { ascending: true })
      .limit(limit);

    if (error) {
      console.warn('[league.service] getLeagueMembers error (tables may not be set up yet):', error.message);
      return [];
    }

    return (data ?? []) as LeagueMemb[];
  } catch (error) {
    console.warn('[league.service] getLeagueMembers exception:', error);
    return [];
  }
}

/**
 * Get user's rank in a specific league
 */
export async function getUserLeagueRank(userId: string, leagueId: string): Promise<{ rank: number; points: number } | null> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('rank, points')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data;
  } catch (err) {
    console.warn('[league.service] getUserLeagueRank error:', err);
    return null;
  }
}

/**
 * Join user to a public league
 */
export async function joinLeague(userId: string, leagueId: string): Promise<LeagueMemb | null> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .insert({
        league_id: leagueId,
        user_id: userId,
        points: 0,
        rank: 1000, // Will be recalculated
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[league.service] joinLeague error:', error);
      return null;
    }
    if (!data) {
      console.warn('[league.service] joinLeague: Failed to join league');
      return null;
    }

    return data as LeagueMemb;
  } catch (err) {
    console.warn('[league.service] joinLeague exception:', err);
    return null;
  }
}

/**
 * Update league points after a match win
 * Points = POINTS_PER_WIN * (1 + opponent_level * LEVEL_MULTIPLIER)
 */
export async function updateLeaguePoints(
  userId: string,
  leagueId: string,
  opponentLevel: number
): Promise<void> {
  // Calculate points based on opponent level
  const basePoints = POINTS_PER_WIN;
  const levelBonus = opponentLevel * LEVEL_MULTIPLIER;
  const totalPoints = Math.round(basePoints * (1 + levelBonus));

  try {
    // Get current points
    const { data: member, error: getErr } = await (supabase.from('league_members') as any)
      .select('points')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .maybeSingle();

    if (getErr || !member) {
      console.warn('[league.service] User not in league, skipping points update');
      return;
    }

    const newPoints = (member.points ?? 0) + totalPoints;

    // Update points
    const { error: updateErr } = await (supabase.from('league_members') as any)
      .update({ points: newPoints })
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    if (updateErr) {
      console.error('[league.service] Failed to update points:', updateErr);
    }
  } catch (err) {
    console.error('[league.service] updateLeaguePoints error:', err);
  }
}

/**
 * Recalculate rankings for a league
 * Should be called after points updates
 */
export async function recalculateLeagueRanks(leagueId: string): Promise<void> {
  try {
    const { data: members, error: getErr } = await (supabase.from('league_members') as any)
      .select('id')
      .eq('league_id', leagueId)
      .order('points', { ascending: false });

    if (getErr || !members) return;

    // Update ranks
    for (let i = 0; i < members.length; i++) {
      await (supabase.from('league_members') as any)
        .update({ rank: i + 1 })
        .eq('id', members[i].id);
    }
  } catch (err) {
    console.error('[league.service] recalculateLeagueRanks error:', err);
  }
}

/**
 * Get top 3 members (reward eligible)
 */
export async function getLeagueTop3(leagueId: string): Promise<LeagueMemb[]> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('*, profile:user_id(id, display_name, avatar_gender)')
      .eq('league_id', leagueId)
      .order('points', { ascending: false })
      .limit(3);

    if (error) {
      console.warn('[league.service] getLeagueTop3 error:', error);
      return [];
    }

    return (data ?? []) as LeagueMemb[];
  } catch (err) {
    console.warn('[league.service] getLeagueTop3 exception:', err);
    return [];
  }
}

/**
 * Reset league points (called on weekly schedule)
 */
export async function resetLeagueWeek(leagueId: string): Promise<void> {
  try {
    // Award top 3
    const top3 = await getLeagueTop3(leagueId);
    const rewards: LeagueReward[] = [
      { rank: 1, reward_type: 'BADGE', amount: 0 },
      { rank: 2, reward_type: 'XP', amount: 500 },
      { rank: 3, reward_type: 'XP', amount: 250 },
    ];

    for (const member of top3) {
      const reward = rewards.find((r) => r.rank === member.rank);
      if (reward) {
        // Award XP (would call badge service here in real impl)
        if (reward.reward_type === 'XP') {
          await (supabase.from('profiles') as any)
            .update({
              total_xp: supabase.raw(`total_xp + ${reward.amount}`),
            })
            .eq('id', member.user_id);
        }
      }
    }

    // Reset all points
    const { error } = await (supabase.rpc as any)('reset_league_points', { p_league_id: leagueId });
    if (error) throw error;
  } catch (err) {
    console.error('[league.service] resetLeagueWeek error:', err);
  }
}

/**
 * Subscribe to league member updates (realtime leaderboard)
 */
export function subscribeToLeagueMembers(leagueId: string, callback: (members: LeagueMemb[]) => void) {
  return supabase
    .channel(`league:${leagueId}:members`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'league_members',
      filter: `league_id=eq.${leagueId}`,
    }, async () => {
      // Re-fetch all members on any change
      const members = await getLeagueMembers(leagueId);
      callback(members);
    })
    .subscribe();
}

/**
 * Get or create the default public league for this season
 */
export async function getOrCreateDefaultLeague(): Promise<League | null> {
  try {
    // Check if exists
    const { data: existing, error: fetchErr } = await (supabase.from('leagues') as any)
      .select('*')
      .eq('season', SEASON)
      .eq('type', 'PUBLIC')
      .maybeSingle();

    if (fetchErr && fetchErr.code !== 'PGRST205') {
      // Only ignore table-not-found error
      throw fetchErr;
    }

    if (existing) {
      return existing as League;
    }

    // Create new
    const { data: created, error } = await (supabase.from('leagues') as any)
      .insert({
        name: SEASON,
        type: 'PUBLIC',
        season: SEASON,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.warn('[league.service] Failed to create league:', error);
      return null;
    }
    if (!created) {
      console.warn('[league.service] Failed to create league: no data returned');
      return null;
    }

    return created as League;
  } catch (err) {
    console.warn('[league.service] getOrCreateDefaultLeague error:', err);
    return null;
  }
}

/**
 * Auto-enroll user in default league (called on first match)
 */
export async function autoEnrollUserInDefaultLeague(userId: string): Promise<void> {
  try {
    const league = await getOrCreateDefaultLeague();
    if (!league) {
      console.warn('[league.service] autoEnrollUserInDefaultLeague: Could not get or create league');
      return;
    }

    // Check if already member
    const { data: existing } = await (supabase.from('league_members') as any)
      .select('id')
      .eq('league_id', league.id)
      .eq('user_id', userId)
      .maybeSingle();

    if (existing) return; // Already enrolled

    // Enroll
    await joinLeague(userId, league.id);
  } catch (err) {
    console.warn('[league.service] autoEnrollUserInDefaultLeague error:', err);
  }
}
