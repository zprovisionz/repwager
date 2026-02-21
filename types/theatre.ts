/**
 * Theatre Types
 * Definitions for match replay and video playback
 */

export interface TheatreMatch {
  id: string;
  opponentId: string;
  opponentName: string;
  opponentAvatar?: {
    gender: 'male' | 'female';
    head: string;
    torso: string;
    legs: string;
  };
  exerciseType: 'push_ups' | 'squats';
  mode: 'casual' | 'competitive';
  outcome: 'win' | 'loss' | 'disputed';
  myReps: number;
  opponentReps: number;
  matchDate: number; // timestamp
  videoPath?: string;
  opponentVideoPath?: string;
  wagerAmount?: number;
  durationSeconds?: number;
}

export interface FormQualityMarker {
  repNumber: number;
  timestamp: number; // ms from start of video
  quality: number; // 0-100
  issues: string[];
}

export interface PrivateNote {
  matchId: string;
  userId: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface VideoMetadata {
  duration: number; // seconds
  fps: number; // frames per second
  resolution: string; // e.g. "1920x1080"
}
