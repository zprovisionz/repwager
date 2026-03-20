import { supabase } from '@/lib/supabase';
import type { Match, RepEvent } from '@/types/database';

export interface DisputeEvidencePayload {
  matchId: string;
  reason: string;
  challengerVideoPath?: string | null;
  opponentVideoPath?: string | null;
  challengerRepEvents?: RepEvent[];
  opponentRepEvents?: RepEvent[];
  submittedBy: string;
}

export async function fileDisputeWithEvidence(
  payload: DisputeEvidencePayload
): Promise<Match> {
  const description = [
    payload.reason,
    payload.challengerVideoPath ? `Challenger video: ${payload.challengerVideoPath}` : null,
    payload.opponentVideoPath ? `Opponent video: ${payload.opponentVideoPath}` : null,
    payload.challengerRepEvents?.length
      ? `Challenger reps: ${payload.challengerRepEvents.length} events`
      : null,
    payload.opponentRepEvents?.length
      ? `Opponent reps: ${payload.opponentRepEvents.length} events`
      : null,
  ]
    .filter(Boolean)
    .join(' | ');

  const { data, error } = await (supabase.from('matches') as any)
    .update({
      status: 'disputed',
      dispute_reason: description,
    })
    .eq('id', payload.matchId)
    .select()
    .maybeSingle();

  if (error) throw error;
  if (!data) throw new Error('Match not found');

  await (supabase.from('notifications') as any).insert({
    user_id: payload.submittedBy,
    type: 'dispute_filed',
    title: 'Dispute Filed',
    body: 'Your dispute has been submitted. Our team will review the evidence.',
    data: { match_id: payload.matchId },
  });

  return data as Match;
}
