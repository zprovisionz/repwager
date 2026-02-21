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
   * Get match videos for both players
   */
  async getMatchVideos(matchId: string): Promise<{ self: string | null; opponent: string | null }> {
    try {
      const { data, error } = await supabase
        .from('match_videos')
        .select('user_id, storage_path')
        .eq('match_id', matchId);

      if (error) throw error;

      const videos: { [key: string]: string } = {};

      for (const video of data || []) {
        const signedUrl = await this.getSignedVideoUrl(video.storage_path);
        if (signedUrl) {
          videos[video.user_id] = signedUrl;
        }
      }

      return {
        self: Object.values(videos)[0] || null,
        opponent: Object.values(videos)[1] || null,
      };
    } catch (error) {
      console.error('[VideoService] Error fetching match videos:', error);
      return { self: null, opponent: null };
    }
  }

  /**
   * Apply color masking to video URL
   * MVP: Uses CSS filters, not actual video processing
   * Future: Could use FFmpeg or vision-camera for real masking
   */
  getPrivacyMaskStyles(playerType: 'self' | 'opponent'): any {
    // MVP implementation: Use CSS filter to tint the video
    const colors = {
      self: 'hue-rotate(150deg) saturate(2)', // Cyan-ish
      opponent: 'hue-rotate(310deg) saturate(2)', // Pink-ish
    };

    return {
      filter: colors[playerType],
      opacity: 0.7,
    };
  }

  /**
   * Toggle masking state
   */
  toggleMasking(enabled: boolean, playerType: 'self' | 'opponent'): {
    filter: string;
    opacity: number;
  } {
    if (!enabled) {
      return {
        filter: 'none',
        opacity: 1,
      };
    }

    return this.getPrivacyMaskStyles(playerType);
  }

  /**
   * Generate shareable clip from video
   * MVP: Returns info for sharing, logic deferred to Phase 5
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
        duration: 0, // Would need to parse video metadata
        size: file.metadata?.size || 0,
      };
    } catch (error) {
      console.error('[VideoService] Error getting metadata:', error);
      return null;
    }
  }
}

export const videoService = new VideoService();
