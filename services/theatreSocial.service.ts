import { supabase } from '@/lib/supabase';

export async function fetchTheatreReactions(matchId: string) {
  const { data, error } = await (supabase.from('theatre_reactions') as any)
    .select('id, kind, user_id, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function addTheatreReaction(matchId: string, userId: string, kind: string) {
  const { error } = await (supabase.from('theatre_reactions') as any).insert({
    match_id: matchId,
    user_id: userId,
    kind,
  });
  if (error) throw error;
}

export async function fetchTheatreComments(matchId: string) {
  const { data, error } = await (supabase.from('theatre_comments') as any)
    .select('id, body, user_id, created_at')
    .eq('match_id', matchId)
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function addTheatreComment(matchId: string, userId: string, body: string) {
  const { error } = await (supabase.from('theatre_comments') as any).insert({
    match_id: matchId,
    user_id: userId,
    body: body.trim().slice(0, 2000),
  });
  if (error) throw error;
}
