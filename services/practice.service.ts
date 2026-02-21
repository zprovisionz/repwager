import { supabase } from '@/lib/supabase';

export interface PracticeSession {
  id: string;
  user_id: string;
  exercise_type: 'push_ups' | 'squats';
  reps: number;
  duration_seconds: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface PracticeStats {
  total_sessions: number;
  total_reps: number;
  best_reps: number;
  avg_reps_per_session: number;
  push_ups_sessions: number;
  push_ups_total_reps: number;
  push_ups_best: number;
  squats_sessions: number;
  squats_total_reps: number;
  squats_best: number;
  last_session: PracticeSession | null;
}

/**
 * Record a new practice session
 */
export async function recordPracticeSession(
  userId: string,
  exerciseType: 'push_ups' | 'squats',
  reps: number,
  notes: string = ''
): Promise<PracticeSession> {
  const { data, error } = await (supabase.rpc as any)('record_practice_session', {
    p_user_id: userId,
    p_exercise_type: exerciseType,
    p_reps: reps,
    p_notes: notes,
  });
  if (error) throw error;
  return data as PracticeSession;
}

/**
 * Get all practice sessions for a user
 */
export async function getUserPracticeSessions(
  userId: string,
  limit = 50
): Promise<PracticeSession[]> {
  const { data, error } = await (supabase.from('practice_sessions') as any)
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as PracticeSession[];
}

/**
 * Get practice statistics for a user
 */
export async function getPracticeStats(userId: string): Promise<PracticeStats> {
  const sessions = await getUserPracticeSessions(userId, 1000);

  if (sessions.length === 0) {
    return {
      total_sessions: 0,
      total_reps: 0,
      best_reps: 0,
      avg_reps_per_session: 0,
      push_ups_sessions: 0,
      push_ups_total_reps: 0,
      push_ups_best: 0,
      squats_sessions: 0,
      squats_total_reps: 0,
      squats_best: 0,
      last_session: null,
    };
  }

  const pushUps = sessions.filter((s) => s.exercise_type === 'push_ups');
  const squats = sessions.filter((s) => s.exercise_type === 'squats');

  const totalReps = sessions.reduce((sum, s) => sum + s.reps, 0);

  return {
    total_sessions: sessions.length,
    total_reps: totalReps,
    best_reps: Math.max(...sessions.map((s) => s.reps), 0),
    avg_reps_per_session: Math.round(totalReps / sessions.length),
    push_ups_sessions: pushUps.length,
    push_ups_total_reps: pushUps.reduce((sum, s) => sum + s.reps, 0),
    push_ups_best: Math.max(...pushUps.map((s) => s.reps), 0),
    squats_sessions: squats.length,
    squats_total_reps: squats.reduce((sum, s) => sum + s.reps, 0),
    squats_best: Math.max(...squats.map((s) => s.reps), 0),
    last_session: sessions[0] || null,
  };
}

/**
 * Get practice session history grouped by day
 */
export async function getPracticeHistory(
  userId: string,
  days = 30
): Promise<{ date: string; count: number; total_reps: number }[]> {
  const { data, error } = await (supabase.from('practice_sessions') as any)
    .select('created_at, reps')
    .eq('user_id', userId)
    .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
    .order('created_at', { ascending: false });

  if (error) throw error;

  const grouped: { [date: string]: { count: number; total_reps: number } } = {};

  (data ?? []).forEach((session: any) => {
    const date = new Date(session.created_at).toISOString().split('T')[0];
    if (!grouped[date]) {
      grouped[date] = { count: 0, total_reps: 0 };
    }
    grouped[date].count++;
    grouped[date].total_reps += session.reps;
  });

  return Object.entries(grouped).map(([date, stats]) => ({
    date,
    count: stats.count,
    total_reps: stats.total_reps,
  }));
}

/**
 * Get personal records by exercise type
 */
export async function getPersonalRecords(
  userId: string
): Promise<{ push_ups: number; squats: number }> {
  const sessions = await getUserPracticeSessions(userId, 1000);

  const pushUpsPR = Math.max(
    ...sessions.filter((s) => s.exercise_type === 'push_ups').map((s) => s.reps),
    0
  );
  const squatsPR = Math.max(
    ...sessions.filter((s) => s.exercise_type === 'squats').map((s) => s.reps),
    0
  );

  return {
    push_ups: pushUpsPR,
    squats: squatsPR,
  };
}
