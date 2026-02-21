/**
 * Video Service
 * Handles video playback, URLs, and privacy masking
 */

import { supabase } from '@/lib/supabase';

class VideoService {
  /**
   * Get signed URL for a video from storage
   */
  async getSignedVideoUrl(storagePath: string, expiresIn: number = 3600): Promise<string | null> {
    try {
      const { data, error } = await supabase.storage.from('match-videos').createSignedUrl(storagePath, expiresIn);

      if (error) throw error;
      return data?.signedUrl || null;
    } catch (error) {
      console.error('[VideoService] Error getting signed URL:', error);
      return null;
    }
  }

  /**
   * Get match videos for both players, correctly distinguishing self vs opponent
   */
  async getMatchVideos(
    matchId: string,
    currentUserId: string
  ): Promise<{ self: string | null; opponent: string | null }> {
    try {
      const { data, error } = await supabase
        .from('match_videos')
        .select('user_id, storage_path')
        .eq('match_id', matchId);

      if (error) throw error;

      const videos: Record<string, string> = {};

      for (const video of (data || []) as any[]) {
        const signedUrl = await this.getSignedVideoUrl(video.storage_path);
        if (signedUrl) {
          videos[video.user_id] = signedUrl;
        }
      }

      return {
        self: videos[currentUserId] || null,
        opponent: Object.entries(videos).find(([id]) => id !== currentUserId)?.[1] || null,
      };
    } catch (error) {
      console.error('[VideoService] Error fetching match videos:', error);
      return { self: null, opponent: null };
    }
  }

  /**
   * Get mask color style for a given player type (React Native View overlay approach)
   * CSS filters don't work on native — callers apply backgroundColor to an absoluteFill View
   */
  getMaskColor(playerType: 'self' | 'opponent'): string {
    return playerType === 'self'
      ? 'rgba(0, 212, 255, 0.35)'   // Electric cyan for self
      : 'rgba(255, 45, 120, 0.35)'; // Hot pink for opponent
  }

  /**
   * Generate shareable clip from video
   * MVP: Returns info for sharing, actual processing deferred to Phase 7
   */
  generateShareableClip(
    videoUrl: string,
    startTime: number,
    endTime: number,
    maskingApplied: boolean
  ): {
    url: string;
    duration: number;
    masked: boolean;
    startTime: number;
    endTime: number;
  } {
    return {
      url: videoUrl,
      duration: endTime - startTime,
      masked: maskingApplied,
      startTime,
      endTime,
    };
  }

  /**
   * Get video metadata
   */
  async getVideoMetadata(
    storagePath: string
  ): Promise<{ duration: number; size: number } | null> {
    try {
      const { data, error } = await supabase.storage.from('match-videos').list();

      if (error) throw error;

      const file = data?.find((f) => f.name === storagePath.split('/').pop());
      if (!file) return null;

      return {
        duration: 0,
        size: file.metadata?.size || 0,
      };
    } catch (error) {
      console.error('[VideoService] Error getting metadata:', error);
      return null;
    }
  }
}

export const videoService = new VideoService();
