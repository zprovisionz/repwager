export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export interface RepEvent {
  rep: number;
  valid: boolean;
  elbowAngle: number;
  shoulderAngle: number;
  timestamp: number;
  formNote?: string;
}

export interface SubmitRepsResult {
  match_id: string;
  status: MatchStatus;
  revealed: boolean;
  my_reps: number;
  opponent_reps: number | null;
  winner_id: string | null;
  scores_revealed_at: string | null;
}

export interface MatchDisplay {
  match: Match;
  myReps: number | null;
  opponentReps: number | null;
  iHaveSubmitted: boolean;
  opponentHasSubmitted: boolean;
  timeRemainingSeconds: number | null;
  isExpired: boolean;
  isRevealed: boolean;
  iAmChallenger: boolean;
}

export type MatchStatus =
  | 'pending'
  | 'accepted'
  | 'challenger_submitted'
  | 'opponent_submitted'
  | 'completed'
  | 'expired'
  | 'disputed'
  | 'cancelled';

export type MatchMode = 'wager' | 'casual';

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
          repcoins: number;
          elo: number;
          rank_tier: string;
          provisional_matches_remaining: number;
          has_completed_onboarding: boolean;
          casual_matches_count: number;
          freeze_count: number;
          streak_frozen_until: string | null;
          expo_push_token: string | null;
          push_enabled: boolean;
          total_xp: number;
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
          status: MatchStatus;
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
          submission_deadline: string | null;
          challenger_submitted_at: string | null;
          opponent_submitted_at: string | null;
          scores_revealed_at: string | null;
          challenger_video_path: string | null;
          opponent_video_path: string | null;
          challenger_rep_events: RepEvent[];
          opponent_rep_events: RepEvent[];
          match_mode: MatchMode;
          rematch_of: string | null;
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
          type:
            | 'wager_hold'
            | 'wager_win'
            | 'wager_loss'
            | 'rake_deduction'
            | 'starting_balance'
            | 'refund';
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
          type:
            | 'match_challenge'
            | 'match_accepted'
            | 'match_completed'
            | 'badge_earned'
            | 'dispute_filed'
            | 'dispute_resolved'
            | 'match_expiring'
            | 'rematch_received'
            | 'rank_up'
            | 'streak_reminder';
          title: string;
          body: string;
          data: Json;
          read: boolean;
          created_at: string;
        };
        Insert: Omit<Database['public']['Tables']['notifications']['Row'], 'id' | 'created_at'>;
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
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
      submit_reps: {
        Args: {
          p_match_id: string;
          p_user_id: string;
          p_reps: number;
          p_rep_events?: RepEvent[];
        };
        Returns: SubmitRepsResult;
      };
      expire_matches: {
        Args: Record<string, never>;
        Returns: number;
      };
      cancel_match: {
        Args: { p_match_id: string };
        Returns: Database['public']['Tables']['matches']['Row'];
      };
      search_profiles: {
        Args: {
          p_query: string;
          p_limit?: number;
          p_exclude_user_id?: string;
        };
        Returns: Array<{
          id: string;
          username: string;
          display_name: string;
          avatar_gender: string;
          avatar_head: string;
          avatar_torso: string;
          avatar_legs: string;
          wins: number;
          losses: number;
          total_xp: number;
          elo: number;
          rank_tier: string;
        }>;
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

export type ProfileSearchResult = {
  id: string;
  username: string;
  display_name: string;
  avatar_gender: string;
  avatar_head: string;
  avatar_torso: string;
  avatar_legs: string;
  wins: number;
  losses: number;
  total_xp: number;
  elo: number;
  rank_tier: string;
};

export const RANK_TIERS = [
  'Rookie',
  'Contender',
  'Grinder',
  'Iron',
  'Beast',
  'Savage',
  'Unbreakable',
  'Legend',
  'Apex',
  'GOGGINS',
] as const;

export type RankTier = (typeof RANK_TIERS)[number];

export const RANK_TIER_TAGLINES: Record<RankTier, string> = {
  Rookie: 'Every legend started here.',
  Contender: "You're hungry. Stay that way.",
  Grinder: 'The work is starting to show.',
  Iron: "You don't break. You bend others.",
  Beast: 'Most people quit before this.',
  Savage: 'Pain is your warm-up.',
  Unbreakable: 'They tried. They failed.',
  Legend: 'Your name means something now.',
  Apex: 'One tier away from immortality.',
  GOGGINS: 'Pain is temporary. Quitting is forever.',
};

export const RANK_TIER_COLORS: Record<RankTier, string> = {
  Rookie: '#8A9DC0',
  Contender: '#4FC3F7',
  Grinder: '#29B6F6',
  Iron: '#78909C',
  Beast: '#FF7043',
  Savage: '#FF5722',
  Unbreakable: '#AB47BC',
  Legend: '#FFB800',
  Apex: '#FF2D78',
  GOGGINS: '#00D4FF',
};

export const ACTIVE_MATCH_STATUSES: MatchStatus[] = [
  'accepted',
  'challenger_submitted',
  'opponent_submitted',
];

export const TERMINAL_MATCH_STATUSES: MatchStatus[] = [
  'completed',
  'expired',
  'disputed',
  'cancelled',
];
