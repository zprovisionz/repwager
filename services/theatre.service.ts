/**
 * Theatre Service
 * Handles match replay data, queries, and analytics
 */

import { supabase } from '@/lib/supabase';
import type { TheatreMatch, FormQualityMarker, PrivateNote } from '@/types/theatre';

export type TheatreFilter = 'all' | 'wins' | 'losses' | 'push_ups' | 'squats' | 'disputed';
export type TheatreSort = 'recent' | 'oldest' | 'best_performance';

class TheatreService {
  /**
   * Get completed matches for a user with optional filters
   */
  async getCompletedMatches(
    userId: string,
    filter: TheatreFilter = 'all',
    sort: TheatreSort = 'recent',
    searchOpponent?: string
  ): Promise<TheatreMatch[]> {
    try {
      let query = supabase
        .from('matches')
        .select(
          `
          id,
          exercise_type,
          mode,
          status,
          wager_amount,
          challenger_id,
          opponent_id,
          challenger_reps,
          opponent_reps,
          winner_id,
          duration_seconds,
          created_at,
          challenger:profiles!challenger_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          opponent:profiles!opponent_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          match_videos(user_id, storage_path)
        `
        )
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);

      // Status filter
      if (filter === 'disputed') {
        query = query.eq('status', 'disputed');
      } else {
        query = query.eq('status', 'completed');
      }

      // Outcome filters
      if (filter === 'wins') {
        query = query.eq('winner_id', userId);
      } else if (filter === 'losses') {
        query = query.neq('winner_id', userId).not('winner_id', 'is', null);
      } else if (filter === 'push_ups') {
        query = query.eq('exercise_type', 'push_ups');
      } else if (filter === 'squats') {
        query = query.eq('exercise_type', 'squats');
      }

      // Sort
      const ascending = sort === 'oldest';
      query = query.order('created_at', { ascending });

      const { data, error } = await query.limit(50);

      if (error) throw error;

      return (data || []).map((match: any) => {
        const isChallenger = match.challenger_id === userId;
        const opponentProfile = isChallenger ? match.opponent : match.challenger;
        const myReps = isChallenger ? match.challenger_reps : match.opponent_reps;
        const opponentReps = isChallenger ? match.opponent_reps : match.challenger_reps;

        let outcome: 'win' | 'loss' | 'disputed' = 'loss';
        if (match.status === 'disputed') {
          outcome = 'disputed';
        } else if (match.winner_id === userId) {
          outcome = 'win';
        } else {
          outcome = 'loss';
        }

        const videos: any[] = match.match_videos || [];
        const myVideo = videos.find((v: any) => v.user_id === userId);
        const opponentVideo = videos.find((v: any) => v.user_id !== userId);

        return {
          id: match.id,
          opponentId: opponentProfile?.id || '',
          opponentName: opponentProfile?.display_name || 'Unknown',
          opponentAvatar: opponentProfile
            ? {
                gender: opponentProfile.avatar_gender || 'male',
                head: opponentProfile.avatar_head || 'head_default',
                torso: opponentProfile.avatar_torso || 'torso_default',
                legs: opponentProfile.avatar_legs || 'legs_default',
              }
            : undefined,
          exerciseType: match.exercise_type as 'push_ups' | 'squats',
          mode: match.mode as 'casual' | 'competitive',
          outcome,
          myReps,
          opponentReps,
          matchDate: new Date(match.created_at).getTime(),
          videoPath: myVideo?.storage_path,
          opponentVideoPath: opponentVideo?.storage_path,
          wagerAmount: match.wager_amount,
          durationSeconds: match.duration_seconds,
        };
      });
    } catch (error) {
      console.error('[TheatreService] Error fetching completed matches:', error);
      return [];
    }
  }

  /**
   * Get a specific match with all details for playback
   */
  async getMatchForPlayback(matchId: string, currentUserId: string): Promise<TheatreMatch | null> {
    try {
      const { data, error } = await supabase
        .from('matches')
        .select(
          `
          id,
          exercise_type,
          mode,
          status,
          wager_amount,
          challenger_id,
          opponent_id,
          challenger_reps,
          opponent_reps,
          winner_id,
          duration_seconds,
          created_at,
          challenger:profiles!challenger_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          opponent:profiles!opponent_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          match_videos(user_id, storage_path)
        `
        )
        .eq('id', matchId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const d = data as any;
      const isChallenger = d.challenger_id === currentUserId;
      const opponentProfile = isChallenger ? d.opponent : d.challenger;
      const myReps = isChallenger ? d.challenger_reps : d.opponent_reps;
      const opponentReps = isChallenger ? d.opponent_reps : d.challenger_reps;

      let outcome: 'win' | 'loss' | 'disputed' = 'loss';
      if (d.status === 'disputed') {
        outcome = 'disputed';
      } else if (d.winner_id === currentUserId) {
        outcome = 'win';
      }

      const videos: any[] = d.match_videos || [];
      const myVideo = videos.find((v: any) => v.user_id === currentUserId);
      const opponentVideo = videos.find((v: any) => v.user_id !== currentUserId);

      return {
        id: d.id,
        opponentId: opponentProfile?.id || d.opponent_id || '',
        opponentName: opponentProfile?.display_name || 'Unknown',
        opponentAvatar: opponentProfile
          ? {
              gender: opponentProfile.avatar_gender || 'male',
              head: opponentProfile.avatar_head || 'head_default',
              torso: opponentProfile.avatar_torso || 'torso_default',
              legs: opponentProfile.avatar_legs || 'legs_default',
            }
          : undefined,
        exerciseType: d.exercise_type as 'push_ups' | 'squats',
        mode: d.mode as 'casual' | 'competitive',
        outcome,
        myReps,
        opponentReps,
        matchDate: new Date(d.created_at).getTime(),
        videoPath: myVideo?.storage_path,
        opponentVideoPath: opponentVideo?.storage_path,
        wagerAmount: d.wager_amount,
        durationSeconds: d.duration_seconds,
      };
    } catch (error) {
      console.error('[TheatreService] Error fetching match for playback:', error);
      return null;
    }
  }

  /**
   * Save private notes for a match
   */
  async savePrivateNotes(matchId: string, userId: string, notes: string): Promise<boolean> {
    try {
      const { error } = await (supabase as any).from('theatre_notes').upsert(
        {
          match_id: matchId,
          user_id: userId,
          notes,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'match_id,user_id' }
      );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error('[TheatreService] Error saving notes:', error);
      return false;
    }
  }

  /**
   * Get private notes for a match
   */
  async getPrivateNotes(matchId: string, userId: string): Promise<string | null> {
    try {
      const { data, error } = await (supabase as any)
        .from('theatre_notes')
        .select('notes')
        .eq('match_id', matchId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return (data as any)?.notes || null;
    } catch (error) {
      console.error('[TheatreService] Error fetching notes:', error);
      return null;
    }
  }

  /**
   * Generate estimated rep timeline markers with realistic quality variation.
   * Creates a quality curve: starts strong, peaks ~30%, gradually fatigues.
   * Adds minor variation to simulate form degradation under fatigue.
   */
  getRepTimeline(totalReps: number, durationSeconds: number): FormQualityMarker[] {
    if (!totalReps || !durationSeconds) return [];

    const issueLibrary = [
      'Incomplete range of motion',
      'Form breakdown at peak',
      'Uneven weight distribution',
      'Slight loss of control',
      'Fatigue detected',
    ];

    return Array.from({ length: totalReps }, (_, i) => {
      const repNumber = i + 1;
      const progress = repNumber / totalReps; // 0 to 1

      // Quality curve: starts at 85, peaks at 95 around rep 30%, then declines with fatigue
      let baseQuality = 85;
      if (progress < 0.3) {
        // Warm-up phase: increasing to peak
        baseQuality = 85 + (progress / 0.3) * 10; // 85 → 95
      } else if (progress < 0.7) {
        // Peak form phase
        baseQuality = 95 - ((progress - 0.3) / 0.4) * 15; // 95 → 80
      } else {
        // Fatigue phase
        baseQuality = 80 - ((progress - 0.7) / 0.3) * 20; // 80 → 60
      }

      // Add minor random variation (±5 points)
      const variation = (Math.random() - 0.5) * 10;
      let quality = Math.max(30, Math.min(100, baseQuality + variation));
      quality = Math.round(quality);

      // Determine issues based on quality score
      let issues: string[] = [];
      if (quality < 60) {
        // Multiple issues when fatigued
        issues = [issueLibrary[Math.floor(Math.random() * issueLibrary.length)]];
      } else if (quality < 75) {
        // Occasional minor issue
        if (Math.random() > 0.6) {
          issues = [issueLibrary[Math.floor(Math.random() * issueLibrary.length)]];
        }
      }

      return {
        repNumber,
        timestamp: Math.round(((repNumber) / totalReps) * durationSeconds * 1000),
        quality,
        issues,
      };
    });
  }
}

export const theatreService = new TheatreService();
