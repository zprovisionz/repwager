export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          username: string;
          display_name: string;
          avatar_gender: 'male' | 'female';
          avatar_head: string;
          avatar_torso: string;
          avatar_legs: string;
          balance: number;
          total_xp: number;
          current_level: number;
          current_streak: number;
          longest_streak: number;
          last_active_date: string | null;
          wins: number;
          losses: number;
          total_reps: number;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      matches: {
        Row: {
          id: string;
          challenger_id: string;
          opponent_id: string | null;
          exercise_type: 'push_ups' | 'squats';
          wager_amount: number;
          mode: 'competitive' | 'casual';
          status: 'pending' | 'accepted' | 'in_progress' | 'completed' | 'disputed' | 'cancelled';
          challenger_reps: number;
          opponent_reps: number;
          winner_id: string | null;
          duration_seconds: number;
          challenger_ready: boolean;
          opponent_ready: boolean;
          started_at: string | null;
          completed_at: string | null;
          expires_at: string;
          dispute_reason: string | null;
          // NEW: Async match fields (2-hour submission window)
          submission_deadline: string | null;
          challenger_submitted_at: string | null;
          opponent_submitted_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['matches']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['matches']['Insert']>;
      };
      match_videos: {
        Row: {
          id: string;
          match_id: string;
          user_id: string;
          storage_path: string;
          duration_seconds: number | null;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['match_videos']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['match_videos']['Insert']>;
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          match_id: string | null;
          type: 'wager_hold' | 'wager_win' | 'wager_loss' | 'rake_deduction' | 'starting_balance' | 'refund';
          amount: number;
          balance_after: number;
          description: string;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['transactions']['Row'], 'id' | 'created_at'>;
        Update: never;
      };
      badges: {
        Row: {
          id: string;
          name: string;
          description: string;
          icon: string;
          xp_reward: number;
          rarity: 'common' | 'rare' | 'epic' | 'legendary';
        };
        Insert: Database['public']['Tables']['badges']['Row'];
        Update: Partial<Database['public']['Tables']['badges']['Row']>;
      };
      user_badges: {
        Row: {
          id: string;
          user_id: string;
          badge_id: string;
          earned_at: string;
        };
        Insert: Omit<Database['public']['Tables']['user_badges']['Row'], 'id' | 'earned_at'>;
        Update: never;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'match_challenge' | 'match_accepted' | 'match_completed' | 'badge_earned' | 'dispute_filed' | 'dispute_resolved';
          title: string;
          body: string;
          data: Json;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          exercise_type: 'push_ups' | 'squats';
          reps: number;
          duration_seconds: number;
          notes: string;
          created_at: string;
          updated_at: string;
        };
        Insert: Omit<Database['public']['Tables']['practice_sessions']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['practice_sessions']['Insert']>;
      };
    };
    Functions: {
      new_user_profile: {
        Args: { p_user_id: string; p_username: string; p_display_name: string; p_avatar_gender?: string };
        Returns: Database['public']['Tables']['profiles']['Row'];
      };
      accept_match: {
        Args: { p_match_id: string; p_opponent_id: string };
        Returns: Database['public']['Tables']['matches']['Row'];
      };
      complete_match: {
        Args: { p_match_id: string; p_winner_id: string; p_challenger_reps: number; p_opponent_reps: number };
        Returns: Database['public']['Tables']['matches']['Row'];
      };
      cancel_match: {
        Args: { p_match_id: string };
        Returns: Database['public']['Tables']['matches']['Row'];
      };
      submit_match_score: {
        Args: { p_match_id: string; p_user_id: string; p_reps: number };
        Returns: Database['public']['Tables']['matches']['Row'];
      };
      handle_expired_matches: {
        Args: {};
        Returns: void;
      };
      record_practice_session: {
        Args: { p_user_id: string; p_exercise_type: string; p_reps: number; p_notes?: string };
        Returns: Database['public']['Tables']['practice_sessions']['Row'];
      };
      calculate_level: {
        Args: { p_xp: number };
        Returns: number;
      };
      get_competitive_leaderboard: {
        Args: { p_limit?: number };
        Returns: Array<any>;
      };
      get_casual_leaderboard: {
        Args: { p_limit?: number };
        Returns: Array<any>;
      };
      get_user_stats: {
        Args: { p_user_id: string };
        Returns: Array<any>;
      };
    };
  };
}

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Match = Database['public']['Tables']['matches']['Row'];
export type MatchVideo = Database['public']['Tables']['match_videos']['Row'];
export type Transaction = Database['public']['Tables']['transactions']['Row'];
export type Badge = Database['public']['Tables']['badges']['Row'];
export type UserBadge = Database['public']['Tables']['user_badges']['Row'];
export type Notification = Database['public']['Tables']['notifications']['Row'];
export type PracticeSession = Database['public']['Tables']['practice_sessions']['Row'];
