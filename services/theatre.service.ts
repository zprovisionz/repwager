/**
 * Theatre Service
 * Handles match replay data, queries, and analytics
 */

import { supabase } from '@/lib/supabase';
import type { TheatreMatch, PrivateNote } from '@/types/theatre';

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
          created_at,
          challenger:profiles!challenger_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          opponent:profiles!opponent_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          match_videos(storage_path)
        `
        )
        .eq('status', 'completed')
        .or(`challenger_id.eq.${userId},opponent_id.eq.${userId}`);

      // Apply filter
      if (filter === 'wins') {
        query = query.or(
          `challenger_id.eq.${userId},opponent_id.eq.${userId}`,
          {
            foreignTable: 'winner_id',
          }
        );
      } else if (filter === 'losses') {
        // Losses would be where user didn't win
      } else if (filter === 'push_ups') {
        query = query.eq('exercise_type', 'push_ups');
      } else if (filter === 'squats') {
        query = query.eq('exercise_type', 'squats');
      } else if (filter === 'disputed') {
        // Disputed matches - would need a status field
      }

      // Apply sort
      const sortField = sort === 'recent' ? 'created_at' : 'created_at';
      const sortAscending = sort === 'oldest';
      query = query.order(sortField, { ascending: sortAscending });

      const { data, error } = await query.limit(50);

      if (error) throw error;

      // Transform to TheatreMatch format
      return (data || []).map((match: any) => {
        const isChallenger = match.challenger_id === userId;
        const opponentProfile = isChallenger ? match.opponent : match.challenger;
        const myReps = isChallenger ? match.challenger_reps : match.opponent_reps;
        const opponentReps = isChallenger ? match.opponent_reps : match.challenger_reps;

        // Determine outcome
        let outcome: 'win' | 'loss' | 'disputed' = 'loss';
        if (myReps > opponentReps) {
          outcome = 'win';
        } else if (myReps < opponentReps) {
          outcome = 'loss';
        } else {
          outcome = 'disputed';
        }

        const videoPath = match.match_videos?.[0]?.storage_path;

        return {
          id: match.id,
          opponentId: opponentProfile.id,
          opponentName: opponentProfile.display_name,
          opponentAvatar: {
            gender: opponentProfile.avatar_gender || 'male',
            head: opponentProfile.avatar_head || 'head_default',
            torso: opponentProfile.avatar_torso || 'torso_default',
            legs: opponentProfile.avatar_legs || 'legs_default',
          },
          exerciseType: match.exercise_type as 'push_ups' | 'squats',
          mode: match.mode as 'casual' | 'competitive',
          outcome,
          myReps,
          opponentReps,
          matchDate: new Date(match.created_at).getTime(),
          videoPath,
          wagerAmount: match.wager_amount,
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
  async getMatchForPlayback(matchId: string): Promise<TheatreMatch | null> {
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
          created_at,
          challenger:profiles!challenger_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          opponent:profiles!opponent_id(id, display_name, avatar_gender, avatar_head, avatar_torso, avatar_legs),
          match_videos(storage_path)
        `
        )
        .eq('id', matchId)
        .single();

      if (error) throw error;
      if (!data) return null;

      // You'd need to know which user is viewing to determine outcome
      const videoPath = data.match_videos?.[0]?.storage_path;

      return {
        id: data.id,
        opponentId: data.opponent_id,
        opponentName: data.opponent.display_name,
        opponentAvatar: {
          gender: data.opponent.avatar_gender || 'male',
          head: data.opponent.avatar_head || 'head_default',
          torso: data.opponent.avatar_torso || 'torso_default',
          legs: data.opponent.avatar_legs || 'legs_default',
        },
        exerciseType: data.exercise_type as 'push_ups' | 'squats',
        mode: data.mode as 'casual' | 'competitive',
        outcome: 'loss', // Would need user context
        myReps: data.challenger_reps,
        opponentReps: data.opponent_reps,
        matchDate: new Date(data.created_at).getTime(),
        videoPath,
        wagerAmount: data.wager_amount,
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
      const { error } = await supabase.from('theatre_notes').upsert(
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
      const { data, error } = await supabase
        .from('theatre_notes')
        .select('notes')
        .eq('match_id', matchId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // 116 = not found
      return data?.notes || null;
    } catch (error) {
      console.error('[TheatreService] Error fetching notes:', error);
      return null;
    }
  }

  /**
   * Get rep timeline markers from stored form quality data
   * Note: This is simplified - in production would retrieve from rep_quality table
   */
  async getRepTimeline(matchId: string): Promise<any[]> {
    try {
      // In production, you'd have a rep_quality or match_events table
      // For now, return empty array that will be populated during playback
      return [];
    } catch (error) {
      console.error('[TheatreService] Error fetching rep timeline:', error);
      return [];
    }
  }
}

export const theatreService = new TheatreService();
