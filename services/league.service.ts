import { supabase } from '@/lib/supabase';

export interface League {
  id: string;
  name: string;
  description: string | null;
  photo_url: string | null;
  focus: 'push_ups' | 'squats' | 'mixed';
  privacy: 'public' | 'private' | 'invite_only';
  admin_id: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface LeagueMember {
  id: string;
  league_id: string;
  user_id: string;
  league_elo: number;
  wins: number;
  losses: number;
  joined_at: string;
  profiles?: {
    display_name: string;
    username: string;
    avatar_gender: string;
    avatar_head: string;
    avatar_torso: string;
    avatar_legs: string;
  };
}

export interface LeagueSeason {
  id: string;
  league_id: string;
  season_number: number;
  started_at: string | null;
  ended_at: string | null;
  status: 'upcoming' | 'active' | 'playoff' | 'completed';
  created_at: string;
}

export interface LeagueMatch {
  id: string;
  league_id: string;
  season_id: string | null;
  match_id: string | null;
  player1_id: string;
  player2_id: string;
  scheduled_at: string | null;
  round: string | null;
  status: 'scheduled' | 'active' | 'completed' | 'cancelled';
  created_at: string;
}

export interface ChatMessage {
  id: string;
  league_id: string;
  user_id: string;
  message: string;
  created_at: string;
  profiles?: { display_name: string; username: string };
}

export async function getPublicLeagues(limit = 20): Promise<League[]> {
  const { data, error } = await (supabase.from('leagues') as any)
    .select('*')
    .eq('privacy', 'public')
    .order('member_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as League[];
}

export async function getMyLeagues(userId: string): Promise<League[]> {
  const { data, error } = await (supabase.from('league_members') as any)
    .select('leagues(*)')
    .eq('user_id', userId);
  if (error) throw error;
  return ((data ?? []) as any[]).map((d) => d.leagues).filter(Boolean) as League[];
}

export async function getLeague(leagueId: string): Promise<League | null> {
  const { data, error } = await (supabase.from('leagues') as any)
    .select('*')
    .eq('id', leagueId)
    .maybeSingle();
  if (error) throw error;
  return data as League | null;
}

export async function getLeagueMembers(leagueId: string): Promise<LeagueMember[]> {
  const { data, error } = await (supabase.from('league_members') as any)
    .select('*, profiles(display_name, username, avatar_gender, avatar_head, avatar_torso, avatar_legs)')
    .eq('league_id', leagueId)
    .order('league_elo', { ascending: false });
  if (error) throw error;
  return (data ?? []) as LeagueMember[];
}

export async function getLeagueMatches(leagueId: string): Promise<LeagueMatch[]> {
  const { data, error } = await (supabase.from('league_matches') as any)
    .select('*')
    .eq('league_id', leagueId)
    .order('scheduled_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as LeagueMatch[];
}

export async function getLeagueChat(leagueId: string, limit = 50): Promise<ChatMessage[]> {
  const { data, error } = await (supabase.from('league_chat_messages') as any)
    .select('*, profiles(display_name, username)')
    .eq('league_id', leagueId)
    .order('created_at', { ascending: true })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as ChatMessage[];
}

export async function sendChatMessage(
  leagueId: string,
  userId: string,
  message: string
): Promise<ChatMessage> {
  const { data, error } = await (supabase.from('league_chat_messages') as any)
    .insert({ league_id: leagueId, user_id: userId, message })
    .select('*, profiles(display_name, username)')
    .maybeSingle();
  if (error) throw error;
  return data as ChatMessage;
}

export async function createLeague(
  userId: string,
  params: { name: string; description?: string; focus: string; privacy: string }
): Promise<League> {
  const { data, error } = await (supabase.rpc as any)('create_league', {
    p_user_id: userId,
    p_name: params.name,
    p_description: params.description ?? null,
    p_focus: params.focus,
    p_privacy: params.privacy,
  });
  if (error) throw error;
  return data as League;
}

export async function joinLeague(userId: string, leagueId: string): Promise<LeagueMember> {
  const { data, error } = await (supabase.rpc as any)('join_league', {
    p_user_id: userId,
    p_league_id: leagueId,
  });
  if (error) throw error;
  return data as LeagueMember;
}

export async function getLeagueStandings(
  leagueId: string
): Promise<LeagueMember[]> {
  return getLeagueMembers(leagueId);
}

export function subscribeToLeagueChat(
  leagueId: string,
  callback: (msg: ChatMessage) => void
) {
  return supabase
    .channel(`league_chat:${leagueId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'league_chat_messages',
        filter: `league_id=eq.${leagueId}`,
      },
      (payload) => callback(payload.new as ChatMessage)
    )
    .subscribe();
}

export interface BracketSlot {
  round: string;
  position: number;
  player1?: LeagueMember | null;
  player2?: LeagueMember | null;
  winnerId?: string | null;
}

export function buildPlayoffBracket(members: LeagueMember[]): BracketSlot[][] {
  const top8 = members.slice(0, 8);
  const rounds = ['Quarterfinals', 'Semifinals', 'Final'];

  const bracket: BracketSlot[][] = [];

  const qf: BracketSlot[] = [];
  for (let i = 0; i < 4; i++) {
    qf.push({
      round: 'Quarterfinals',
      position: i,
      player1: top8[i * 2] ?? null,
      player2: top8[i * 2 + 1] ?? null,
      winnerId: null,
    });
  }
  bracket.push(qf);

  const sf: BracketSlot[] = [
    { round: 'Semifinals', position: 0, player1: null, player2: null, winnerId: null },
    { round: 'Semifinals', position: 1, player1: null, player2: null, winnerId: null },
  ];
  bracket.push(sf);

  const final: BracketSlot[] = [
    { round: 'Final', position: 0, player1: null, player2: null, winnerId: null },
  ];
  bracket.push(final);

  return bracket;
}
