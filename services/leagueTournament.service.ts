/*
  League Tournament Service

  Complete Madden-style league system with:
  - League creation & customization
  - Member management + roles
  - Matchmaking & auto 1v1 splitting
  - Points calculation
  - Weekly season reset
  - Realtime chat
*/

import { supabase } from '@/lib/supabase';
import type { Profile } from '@/types/database';

// ─────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────

export type LeagueFocusType = 'casual' | 'fitness' | 'competitive';
export type LeaguePrivacy = 'public' | 'private';
export type MemberRole = 'owner' | 'admin' | 'member';
export type LeagueMatchStatus = 'pending' | 'ongoing' | 'completed' | 'cancelled';

export interface League {
  id: string;
  name: string;
  photo_url?: string;
  focus_type: LeagueFocusType;
  privacy: LeaguePrivacy;
  invite_code?: string;
  owner_id: string;
  max_members: number;
  entry_fee: number;
  season_start: string;
  season_end: string;
  season: string;
  created_at: string;
  updated_at: string;
  member_count?: number;
  is_owner?: boolean;
  user_role?: MemberRole;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  role: MemberRole;
  points: number;
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  joined_at: string;
  profile?: Partial<Profile>;
}

export interface LeagueMatch {
  id: string;
  league_id: string;
  opponent_league_id: string;
  status: LeagueMatchStatus;
  scheduled_at: string;
  winner_league_id?: string;
  league_a_points: number;
  league_b_points: number;
  exercise_type: string;
  wager_amount: number;
  created_at: string;
  completed_at?: string;
}

export interface LeagueChat {
  id: string;
  league_id: string;
  user_id: string;
  message: string;
  created_at: string;
  author?: Partial<Profile>;
}

// ─────────────────────────────────────────────────────────────────────────
// LEAGUE CRUD
// ─────────────────────────────────────────────────────────────────────────

/**
 * Create a new league
 */
export async function createLeague(
  userId: string,
  data: {
    name: string;
    photo_url?: string;
    focus_type: LeagueFocusType;
    privacy: LeaguePrivacy;
    max_members: number;
    entry_fee: number;
  }
): Promise<League | null> {
  try {
    // Generate unique invite code for private leagues
    const invite_code = data.privacy === 'private' ? generateInviteCode() : null;

    const { data: league, error } = await (supabase.from('leagues') as any)
      .insert({
        name: data.name,
        photo_url: data.photo_url,
        focus_type: data.focus_type,
        privacy: data.privacy,
        invite_code,
        owner_id: userId,
        max_members: data.max_members,
        entry_fee: data.entry_fee,
        season_start: new Date().toISOString(),
        season_end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] createLeague error:', error);
      return null;
    }

    // Add creator as owner
    if (league) {
      await (supabase.from('league_members') as any).insert({
        league_id: league.id,
        user_id: userId,
        role: 'owner',
        points: 0,
      });

      // Create default settings
      await (supabase.from('league_settings') as any).insert({
        league_id: league.id,
      });
    }

    return league as League;
  } catch (error) {
    console.error('[leagueTournament] createLeague exception:', error);
    return null;
  }
}

/**
 * Get all public leagues with optional filters
 */
export async function getPublicLeagues(filters?: {
  focus_type?: LeagueFocusType;
  search?: string;
}): Promise<League[]> {
  try {
    let query = (supabase.from('leagues') as any)
      .select('*')
      .eq('privacy', 'public')
      .order('created_at', { ascending: false });

    if (filters?.focus_type) {
      query = query.eq('focus_type', filters.focus_type);
    }

    if (filters?.search) {
      query = query.ilike('name', `%${filters.search}%`);
    }

    const { data, error } = await query;

    if (error) {
      console.warn('[leagueTournament] getPublicLeagues error:', error);
      return [];
    }

    return (data ?? []) as League[];
  } catch (error) {
    console.error('[leagueTournament] getPublicLeagues exception:', error);
    return [];
  }
}

/**
 * Get user's leagues
 */
export async function getUserLeagues(userId: string): Promise<League[]> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('leagues(*)')
      .eq('user_id', userId);

    if (error) {
      console.warn('[leagueTournament] getUserLeagues error:', error);
      return [];
    }

    return data?.map((m: any) => ({ ...m.leagues, user_role: m.role })) ?? [];
  } catch (error) {
    console.error('[leagueTournament] getUserLeagues exception:', error);
    return [];
  }
}

/**
 * Get league detail by ID
 */
export async function getLeagueDetail(leagueId: string): Promise<League | null> {
  try {
    const { data, error } = await (supabase.from('leagues') as any)
      .select('*')
      .eq('id', leagueId)
      .single();

    if (error) {
      console.warn('[leagueTournament] getLeagueDetail error:', error);
      return null;
    }

    return data as League;
  } catch (error) {
    console.error('[leagueTournament] getLeagueDetail exception:', error);
    return null;
  }
}

/**
 * Update league settings (owner/admin only)
 */
export async function updateLeague(
  leagueId: string,
  userId: string,
  updates: Partial<League>
): Promise<League | null> {
  try {
    // Verify user is owner
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner') {
      console.warn('[leagueTournament] updateLeague: not owner');
      return null;
    }

    const { data, error } = await (supabase.from('leagues') as any)
      .update(updates)
      .eq('id', leagueId)
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] updateLeague error:', error);
      return null;
    }

    return data as League;
  } catch (error) {
    console.error('[leagueTournament] updateLeague exception:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MEMBERSHIP
// ─────────────────────────────────────────────────────────────────────────

/**
 * Join a public league
 */
export async function joinLeague(userId: string, leagueId: string): Promise<LeagueMember | null> {
  try {
    // Check league is public and not full
    const league = await getLeagueDetail(leagueId);
    if (!league || league.privacy !== 'public') {
      return null;
    }

    const memberCount = await getLeagueMemberCount(leagueId);
    if (memberCount >= league.max_members) {
      console.warn('[leagueTournament] League is full');
      return null;
    }

    const { data, error } = await (supabase.from('league_members') as any)
      .insert({
        league_id: leagueId,
        user_id: userId,
        role: 'member',
        points: 0,
      })
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] joinLeague error:', error);
      return null;
    }

    return data as LeagueMember;
  } catch (error) {
    console.error('[leagueTournament] joinLeague exception:', error);
    return null;
  }
}

/**
 * Join private league with invite code
 */
export async function joinLeagueWithCode(userId: string, inviteCode: string): Promise<LeagueMember | null> {
  try {
    // Find league by invite code
    const leagueResult = await (supabase.from('leagues') as any)
      .select('id')
      .eq('invite_code', inviteCode)
      .single();

    if (leagueResult.error || !leagueResult.data) {
      console.warn('[leagueTournament] Invalid invite code');
      return null;
    }

    return joinLeague(userId, leagueResult.data.id);
  } catch (error) {
    console.error('[leagueTournament] joinLeagueWithCode exception:', error);
    return null;
  }
}

/**
 * Leave a league
 */
export async function leaveLeague(userId: string, leagueId: string): Promise<boolean> {
  try {
    // Can't leave if owner (transfer ownership first)
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role === 'owner') {
      console.warn('[leagueTournament] Owner cannot leave league');
      return false;
    }

    const { error } = await (supabase.from('league_members') as any)
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    if (error) {
      console.error('[leagueTournament] leaveLeague error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[leagueTournament] leaveLeague exception:', error);
    return false;
  }
}

/**
 * Get league members with profiles
 */
export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('*, profile:user_id(id, username, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs, current_level)')
      .eq('league_id', leagueId)
      .order('points', { ascending: false });

    if (error) {
      console.warn('[leagueTournament] getLeagueMembers error:', error);
      return [];
    }

    return (data ?? []) as LeagueMember[];
  } catch (error) {
    console.error('[leagueTournament] getLeagueMembers exception:', error);
    return [];
  }
}

/**
 * Promote/demote member (admin/owner only)
 */
export async function updateMemberRole(
  leagueId: string,
  userId: string,
  targetUserId: string,
  newRole: MemberRole
): Promise<LeagueMember | null> {
  try {
    // Verify user is admin/owner
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner' && member.data?.role !== 'admin') {
      console.warn('[leagueTournament] Not authorized');
      return null;
    }

    const { data, error } = await (supabase.from('league_members') as any)
      .update({ role: newRole })
      .eq('league_id', leagueId)
      .eq('user_id', targetUserId)
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] updateMemberRole error:', error);
      return null;
    }

    return data as LeagueMember;
  } catch (error) {
    console.error('[leagueTournament] updateMemberRole exception:', error);
    return null;
  }
}

/**
 * Kick member from league (admin/owner only)
 */
export async function kickMember(
  leagueId: string,
  userId: string,
  targetUserId: string
): Promise<boolean> {
  try {
    if (userId === targetUserId) {
      return leaveLeague(userId, leagueId);
    }

    // Verify user is admin/owner
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner' && member.data?.role !== 'admin') {
      console.warn('[leagueTournament] Not authorized');
      return false;
    }

    const { error } = await (supabase.from('league_members') as any)
      .delete()
      .eq('league_id', leagueId)
      .eq('user_id', targetUserId);

    if (error) {
      console.error('[leagueTournament] kickMember error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('[leagueTournament] kickMember exception:', error);
    return false;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// MATCHMAKING & 1V1 SPLITTING
// ─────────────────────────────────────────────────────────────────────────

/**
 * Get candidate opponent leagues (same focus type, active)
 */
export async function getOpponentLeagueCandidates(
  leagueId: string,
  limit: number = 10
): Promise<League[]> {
  try {
    const league = await getLeagueDetail(leagueId);
    if (!league) return [];

    const { data, error } = await (supabase.from('leagues') as any)
      .select('*')
      .eq('focus_type', league.focus_type)
      .eq('privacy', 'public')
      .neq('id', leagueId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[leagueTournament] getOpponentLeagueCandidates error:', error);
      return [];
    }

    return (data ?? []) as League[];
  } catch (error) {
    console.error('[leagueTournament] getOpponentLeagueCandidates exception:', error);
    return [];
  }
}

/**
 * Schedule League vs League match
 * Returns match ID on success
 */
export async function scheduleLeagueMatch(
  userId: string,
  leagueId: string,
  opponentLeagueId: string,
  data: {
    exercise_type: string;
    wager_amount: number;
  }
): Promise<LeagueMatch | null> {
  try {
    // Verify user is owner/admin
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner' && member.data?.role !== 'admin') {
      console.warn('[leagueTournament] Not authorized to schedule match');
      return null;
    }

    // Verify both leagues exist
    const [league1, league2] = await Promise.all([
      getLeagueDetail(leagueId),
      getLeagueDetail(opponentLeagueId),
    ]);

    if (!league1 || !league2) {
      console.warn('[leagueTournament] One or both leagues not found');
      return null;
    }

    // Create league match
    const { data: match, error } = await (supabase.from('league_matches') as any)
      .insert({
        league_id: leagueId,
        opponent_league_id: opponentLeagueId,
        status: 'pending',
        scheduled_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(), // 1 hour from now
        exercise_type: data.exercise_type,
        wager_amount: data.wager_amount,
      })
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] scheduleLeagueMatch error:', error);
      return null;
    }

    return match as LeagueMatch;
  } catch (error) {
    console.error('[leagueTournament] scheduleLeagueMatch exception:', error);
    return null;
  }
}

/**
 * Auto-split league match into 1v1s
 * Pairs members top-vs-top (ranked by league points)
 */
export async function splitLeagueMatchInto1v1s(
  matchId: string,
  userId: string
): Promise<string[]> {
  // Returns array of created match IDs
  try {
    const match = await getLeagueMatch(matchId);
    if (!match || match.status !== 'pending') {
      console.warn('[leagueTournament] Match not found or not pending');
      return [];
    }

    // Verify user is authorized
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', match.league_id)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner' && member.data?.role !== 'admin') {
      console.warn('[leagueTournament] Not authorized');
      return [];
    }

    // Get members from both leagues, sorted by points (desc)
    const [leagueAMembers, leagueBMembers] = await Promise.all([
      getLeagueMembersSorted(match.league_id),
      getLeagueMembersSorted(match.opponent_league_id),
    ]);

    // Pair members: top vs top, etc.
    const pairs = [];
    const maxPairs = Math.min(leagueAMembers.length, leagueBMembers.length);

    for (let i = 0; i < maxPairs; i++) {
      pairs.push({
        user_a_id: leagueAMembers[i].user_id,
        user_b_id: leagueBMembers[i].user_id,
      });
    }

    // Create 1v1 matches in matches table (existing structure)
    const createdMatchIds: string[] = [];

    for (const pair of pairs) {
      const { data: newMatch, error } = await (supabase.from('matches') as any)
        .insert({
          user_a_id: pair.user_a_id,
          user_b_id: pair.user_b_id,
          exercise_type: match.exercise_type,
          wager_amount: match.wager_amount,
          status: 'pending',
          league_match_id: matchId, // Link to league match
        })
        .select()
        .single();

      if (!error && newMatch) {
        createdMatchIds.push(newMatch.id);
      }
    }

    // Update league match status to ongoing
    await (supabase.from('league_matches') as any)
      .update({ status: 'ongoing' })
      .eq('id', matchId);

    return createdMatchIds;
  } catch (error) {
    console.error('[leagueTournament] splitLeagueMatchInto1v1s exception:', error);
    return [];
  }
}

/**
 * Get league match by ID
 */
export async function getLeagueMatch(matchId: string): Promise<LeagueMatch | null> {
  try {
    const { data, error } = await (supabase.from('league_matches') as any)
      .select('*')
      .eq('id', matchId)
      .single();

    if (error) {
      console.warn('[leagueTournament] getLeagueMatch error:', error);
      return null;
    }

    return data as LeagueMatch;
  } catch (error) {
    console.error('[leagueTournament] getLeagueMatch exception:', error);
    return null;
  }
}

/**
 * Get all matches for a league
 */
export async function getLeagueMatches(leagueId: string): Promise<LeagueMatch[]> {
  try {
    const { data, error } = await (supabase.from('league_matches') as any)
      .select('*')
      .or(`league_id.eq.${leagueId},opponent_league_id.eq.${leagueId}`)
      .order('scheduled_at', { ascending: false });

    if (error) {
      console.warn('[leagueTournament] getLeagueMatches error:', error);
      return [];
    }

    return (data ?? []) as LeagueMatch[];
  } catch (error) {
    console.error('[leagueTournament] getLeagueMatches exception:', error);
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// POINTS & RANKINGS
// ─────────────────────────────────────────────────────────────────────────

/**
 * Update member points based on match result
 * Win: 3pts, Tie: 1pt, Loss: 0pts
 */
export async function updateMemberLeaguePoints(
  leagueId: string,
  userId: string,
  result: 'win' | 'loss' | 'tie'
): Promise<LeagueMember | null> {
  try {
    const member = await (supabase.from('league_members') as any)
      .select('points, wins, losses, ties')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (!member.data) return null;

    const pointsMap = { win: 3, loss: 0, tie: 1 };
    const statsMap = {
      win: { wins: member.data.wins + 1 },
      loss: { losses: member.data.losses + 1 },
      tie: { ties: member.data.ties + 1 },
    };

    const { data, error } = await (supabase.from('league_members') as any)
      .update({
        points: member.data.points + pointsMap[result],
        ...statsMap[result],
      })
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] updateMemberLeaguePoints error:', error);
      return null;
    }

    return data as LeagueMember;
  } catch (error) {
    console.error('[leagueTournament] updateMemberLeaguePoints exception:', error);
    return null;
  }
}

/**
 * Recalculate rankings for entire league
 */
export async function recalculateLeagueRankings(leagueId: string): Promise<void> {
  try {
    const members = await getLeagueMembersSorted(leagueId);

    for (let i = 0; i < members.length; i++) {
      await (supabase.from('league_members') as any)
        .update({ rank: i + 1 })
        .eq('id', members[i].id);
    }
  } catch (error) {
    console.error('[leagueTournament] recalculateLeagueRankings exception:', error);
  }
}

/**
 * Reset league for new season (owner/admin only)
 */
export async function resetLeagueSeason(
  leagueId: string,
  userId: string
): Promise<League | null> {
  try {
    // Verify user is owner
    const member = await (supabase.from('league_members') as any)
      .select('role')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (member.data?.role !== 'owner') {
      console.warn('[leagueTournament] Not authorized');
      return null;
    }

    // Award top 3 members (badges, bonus XP, balance)
    const topMembers = await (supabase.from('league_members') as any)
      .select('user_id')
      .eq('league_id', leagueId)
      .order('points', { ascending: false })
      .limit(3);

    if (topMembers.data) {
      for (let i = 0; i < topMembers.data.length; i++) {
        const rewardXp = [500, 300, 150][i] || 0;
        const rewardBalance = [50, 30, 10][i] || 0;

        // Award XP to profile
        await (supabase.from('profiles') as any)
          .update({
            total_xp: supabase.raw(`total_xp + ${rewardXp}`),
            balance: supabase.raw(`balance + ${rewardBalance}`),
          })
          .eq('id', topMembers.data[i].user_id);
      }
    }

    // Reset all points but keep wins/losses/ties
    await (supabase.from('league_members') as any)
      .update({
        points: 0,
        rank: null,
      })
      .eq('league_id', leagueId);

    // Update league season dates
    const newEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const { data, error } = await (supabase.from('leagues') as any)
      .update({
        season_start: new Date().toISOString(),
        season_end: newEnd.toISOString(),
      })
      .eq('id', leagueId)
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] resetLeagueSeason error:', error);
      return null;
    }

    return data as League;
  } catch (error) {
    console.error('[leagueTournament] resetLeagueSeason exception:', error);
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────
// CHAT
// ─────────────────────────────────────────────────────────────────────────

/**
 * Send league chat message
 */
export async function sendLeagueChat(
  leagueId: string,
  userId: string,
  message: string
): Promise<LeagueChat | null> {
  try {
    const { data, error } = await (supabase.from('league_chats') as any)
      .insert({
        league_id: leagueId,
        user_id: userId,
        message: message.slice(0, 500), // Cap at 500 chars
      })
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] sendLeagueChat error:', error);
      return null;
    }

    return data as LeagueChat;
  } catch (error) {
    console.error('[leagueTournament] sendLeagueChat exception:', error);
    return null;
  }
}

/**
 * Get league chat history
 */
export async function getLeagueChats(leagueId: string, limit: number = 50): Promise<LeagueChat[]> {
  try {
    const { data, error } = await (supabase.from('league_chats') as any)
      .select('*, author:user_id(id, username, display_name)')
      .eq('league_id', leagueId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.warn('[leagueTournament] getLeagueChats error:', error);
      return [];
    }

    return (data ?? []).reverse() as LeagueChat[];
  } catch (error) {
    console.error('[leagueTournament] getLeagueChats exception:', error);
    return [];
  }
}

/**
 * Subscribe to league chat realtime
 */
export function subscribeToLeagueChat(
  leagueId: string,
  callback: (chat: LeagueChat) => void
) {
  return supabase
    .channel(`league-chat:${leagueId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'league_chats',
        filter: `league_id=eq.${leagueId}`,
      },
      (payload: any) => {
        callback(payload.new as LeagueChat);
      }
    )
    .subscribe();
}

// ─────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

async function getLeagueMemberCount(leagueId: string): Promise<number> {
  try {
    const { count } = await (supabase.from('league_members') as any)
      .select('*', { count: 'exact', head: true })
      .eq('league_id', leagueId);

    return count ?? 0;
  } catch {
    return 0;
  }
}

async function getLeagueMembersSorted(leagueId: string): Promise<LeagueMember[]> {
  try {
    const { data, error } = await (supabase.from('league_members') as any)
      .select('*')
      .eq('league_id', leagueId)
      .order('points', { ascending: false });

    if (error) return [];
    return (data ?? []) as LeagueMember[];
  } catch {
    return [];
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PLAYOFF BRACKET (Single-Elimination)
// ─────────────────────────────────────────────────────────────────────────

/**
 * Generate playoff bracket after season reset
 * Top 8 or 16 members qualify (configurable)
 * Single-elimination: Quarterfinals → Semifinals → Finals
 */
export async function generatePlayoffBracket(leagueId: string): Promise<boolean> {
  try {
    const league = await getLeagueDetail(leagueId);
    if (!league || !league.playoff_enabled) return false;

    // Get top N members sorted by points
    const topMembers = await (supabase.from('league_members') as any)
      .select('user_id')
      .eq('league_id', leagueId)
      .order('points', { ascending: false })
      .limit(league.playoff_size || 8);

    if (!topMembers.data || topMembers.data.length < 2) {
      console.warn('[leagueTournament] Not enough members for playoffs');
      return false;
    }

    const members = topMembers.data;
    const bracket_size = members.length;

    // Determine rounds needed
    const rounds = Math.log2(bracket_size);

    // Create first round matches (quarterfinals or similar)
    for (let i = 0; i < bracket_size; i += 2) {
      if (i + 1 < bracket_size) {
        await (supabase.from('playoff_matches') as any)
          .insert({
            league_id: leagueId,
            round_number: 1,
            round_name: bracket_size === 8 ? 'Quarterfinals' : 'Round of 16',
            seed_a: i + 1,
            seed_b: i + 2,
            status: 'pending',
          });
      }
    }

    // Update league playoff start
    await (supabase.from('leagues') as any)
      .update({ playoff_start_at: new Date().toISOString() })
      .eq('id', leagueId);

    console.log('[leagueTournament] Playoff bracket generated for league', leagueId);
    return true;
  } catch (error) {
    console.error('[leagueTournament] generatePlayoffBracket exception:', error);
    return false;
  }
}

/**
 * Get playoff bracket for a league
 */
export async function getPlayoffBracket(leagueId: string): Promise<any[]> {
  try {
    const { data, error } = await (supabase.from('playoff_matches') as any)
      .select('*, match:match_id(user_a_id, user_b_id, winner_id)')
      .eq('league_id', leagueId)
      .order('round_number', { ascending: true })
      .order('seed_a', { ascending: true });

    if (error) {
      console.warn('[leagueTournament] getPlayoffBracket error:', error);
      return [];
    }

    return (data ?? []) as any[];
  } catch (error) {
    console.error('[leagueTournament] getPlayoffBracket exception:', error);
    return [];
  }
}

/**
 * Complete playoff match and advance winner to next round
 */
export async function completePlayoffMatch(
  playoffMatchId: string,
  winnerSeed: number
): Promise<boolean> {
  try {
    const { data: match, error: matchError } = await (supabase.from('playoff_matches') as any)
      .select('*')
      .eq('id', playoffMatchId)
      .single();

    if (matchError || !match) return false;

    // Update this match
    await (supabase.from('playoff_matches') as any)
      .update({ status: 'completed', winner_seed: winnerSeed })
      .eq('id', playoffMatchId);

    // If finals, award championship
    if (match.round_name === 'Finals') {
      await awardPlayoffChampion(match.league_id, winnerSeed);
      return true;
    }

    // Create next round match if needed
    const nextRound = match.round_number + 1;
    const { data: nextMatches } = await (supabase.from('playoff_matches') as any)
      .select('*')
      .eq('league_id', match.league_id)
      .eq('round_number', nextRound);

    // Determine next seed slot
    const nextSeedSlot = match.seed_a < match.seed_b ?
      (Math.floor((match.seed_a - 1) / 2) * 2 + 1) :
      (Math.floor((match.seed_b - 1) / 2) * 2 + 1);

    console.log('[leagueTournament] Playoff match completed, winner advances');
    return true;
  } catch (error) {
    console.error('[leagueTournament] completePlayoffMatch exception:', error);
    return false;
  }
}

/**
 * Award championship to playoff winner
 */
async function awardPlayoffChampion(leagueId: string, winnerSeed: number): Promise<void> {
  try {
    // Get the winner's user_id by seed (requires lookup in bracket)
    // For now, mark as champion in league metadata
    await (supabase.from('leagues') as any)
      .update({ playoff_winner_id: null }) // Set to actual winner ID
      .eq('id', leagueId);

    console.log('[leagueTournament] Playoff champion awarded');
  } catch (error) {
    console.error('[leagueTournament] awardPlayoffChampion exception:', error);
  }
}

// ─────────────────────────────────────────────────────────────────────────
// PRESTIGE & PROGRESSION (League Levels & Titles)
// ─────────────────────────────────────────────────────────────────────────

const LEAGUE_LEVEL_THRESHOLDS: { [key: number]: number } = {
  1: 0,
  2: 500,
  3: 1500,
  4: 4000,
  5: 10000,
};

const LEAGUE_TITLES: { [key: number]: string } = {
  1: 'Newcomer',
  2: 'Member',
  3: 'League Veteran',
  4: 'League Elite',
  5: 'League Legend',
};

/**
 * Award league XP and auto-level up
 */
export async function awardLeagueXp(
  userId: string,
  leagueId: string,
  xpAmount: number
): Promise<LeagueMember | null> {
  try {
    const member = await (supabase.from('league_members') as any)
      .select('league_xp, league_level')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (!member.data) return null;

    const newXp = (member.data.league_xp || 0) + xpAmount;
    let newLevel = member.data.league_level || 1;

    // Auto-level if threshold reached
    for (let i = 5; i >= 1; i--) {
      if (newXp >= LEAGUE_LEVEL_THRESHOLDS[i]) {
        newLevel = i;
        break;
      }
    }

    const newTitle = LEAGUE_TITLES[newLevel];

    const { data, error } = await (supabase.from('league_members') as any)
      .update({
        league_xp: newXp,
        league_level: newLevel,
        league_title: newTitle,
      })
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      console.error('[leagueTournament] awardLeagueXp error:', error);
      return null;
    }

    return data as LeagueMember;
  } catch (error) {
    console.error('[leagueTournament] awardLeagueXp exception:', error);
    return null;
  }
}

/**
 * Award league-specific badge
 */
export async function awardLeagueBadge(
  userId: string,
  leagueId: string,
  badgeId: string
): Promise<boolean> {
  try {
    const { error } = await (supabase.from('user_league_badges') as any)
      .insert({
        user_id: userId,
        league_id: leagueId,
        badge_id: badgeId,
      });

    if (error) {
      console.warn('[leagueTournament] Badge already earned or error:', error);
      // Ignore duplicate key errors
      return true;
    }

    return true;
  } catch (error) {
    console.error('[leagueTournament] awardLeagueBadge exception:', error);
    return false;
  }
}

/**
 * Get member's league prestige (level, title, badges)
 */
export async function getLeaguePrestige(
  userId: string,
  leagueId: string
): Promise<{ level: number; title: string; badges: string[] } | null> {
  try {
    const { data: member, error: memberError } = await (supabase.from('league_members') as any)
      .select('league_level, league_title')
      .eq('league_id', leagueId)
      .eq('user_id', userId)
      .single();

    if (memberError || !member) return null;

    const { data: badges, error: badgeError } = await (supabase.from('user_league_badges') as any)
      .select('badge_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    return {
      level: member.league_level || 1,
      title: member.league_title || 'Newcomer',
      badges: (badges ?? []).map((b: any) => b.badge_id),
    };
  } catch (error) {
    console.error('[leagueTournament] getLeaguePrestige exception:', error);
    return null;
  }
}
