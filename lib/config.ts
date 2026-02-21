// ─── DEV MODE ───────────────────────────────────────────────────────────────
export const DEV_MODE_ENABLED = __DEV__;
export const DEV_AUTO_MATCH_ENABLED = DEV_MODE_ENABLED && true;
export const DEV_MODE_MANUAL_COUNT = false;

// ─── LEVELING SYSTEM ────────────────────────────────────────────────────────
export const LEVEL_THRESHOLDS = {
  1: 0,
  2: 1000,
  3: 3000,
  4: 7000,
  5: 15000,
  6: 30000,
  7: 60000,
  8: 120000,
  9: 240000,
  10: 500000,
} as const;

export const XP_MULTIPLIER = {
  casual: 1.0,
  competitive: 1.5,
} as const;

// ─── MATCH CONFIG ───────────────────────────────────────────────────────────
export const MATCH_DURATION_SECONDS = 60;
export const RAKE_PERCENTAGE = 0.10;
export const STARTING_BALANCE = 100.00;
export const REP_DEBOUNCE_MS = 500;

export const MIN_WAGER = 1;
export const MAX_WAGER = 50;

export const SQUAT_LOCKOUT_ANGLE = 120;
export const PUSH_UP_ELBOW_LOCKOUT_ANGLE = 160;
export const PUSH_UP_BOTTOM_ANGLE = 90;
export const SQUAT_BOTTOM_ANGLE = 90;

// ─── FORM VALIDATION THRESHOLDS ─────────────────────────────────────────
export const PUSH_UP_MIN_LOCKOUT_ANGLE = 155; // Minimum lockout (allow slight bend)
export const PUSH_UP_MAX_BOTTOM_ANGLE = 100; // Maximum bottom angle (prevent half reps)
export const PUSH_UP_MIN_RANGE = 60; // Minimum angle change per rep
export const PUSH_UP_BODY_ALIGNMENT_MIN = 160; // Straight body check (shoulder-hip-knee)
export const PUSH_UP_KNEE_DOWN_DETECTION = 0.65; // Hip height ratio (knees-down push-ups)

export const SQUAT_MIN_DEPTH = 85; // Minimum squat depth (knee angle)
export const SQUAT_MAX_DEPTH = 50; // Maximum depth (full squat)
export const SQUAT_KNEE_TRACKING_TOLERANCE = 20; // Max deviation between left/right knees

export const SYMMETRY_TOLERANCE = 20; // Max angle difference between left/right sides
export const FORM_QUALITY_MIN_THRESHOLD = 75; // Minimum form quality percentage (0-100) to count rep
export const POSE_CONFIDENCE_MIN = 0.6; // Minimum keypoint confidence (0-1, increased from 0.3)

export const EXERCISE_LABELS: Record<string, string> = {
  push_ups: 'Push-Ups',
  squats: 'Squats',
};

export const AVATAR_CLOTHING = {
  male: {
    head: [
      { id: 'head_default', label: 'Basic Cap', unlockXp: 0 },
      { id: 'head_bandana', label: 'Bandana', unlockXp: 200 },
      { id: 'head_headband', label: 'Headband', unlockXp: 500 },
    ],
    torso: [
      { id: 'torso_default', label: 'Basic Tee', unlockXp: 0 },
      { id: 'torso_tank', label: 'Tank Top', unlockXp: 150 },
      { id: 'torso_hoodie', label: 'Hoodie', unlockXp: 400 },
    ],
    legs: [
      { id: 'legs_default', label: 'Shorts', unlockXp: 0 },
      { id: 'legs_joggers', label: 'Joggers', unlockXp: 200 },
      { id: 'legs_compression', label: 'Compression', unlockXp: 450 },
    ],
  },
  female: {
    head: [
      { id: 'head_default', label: 'Ponytail', unlockXp: 0 },
      { id: 'head_bandana', label: 'Bandana', unlockXp: 200 },
      { id: 'head_bun', label: 'Top Bun', unlockXp: 500 },
    ],
    torso: [
      { id: 'torso_default', label: 'Sports Bra', unlockXp: 0 },
      { id: 'torso_tank', label: 'Tank Top', unlockXp: 150 },
      { id: 'torso_hoodie', label: 'Zip Hoodie', unlockXp: 400 },
    ],
    legs: [
      { id: 'legs_default', label: 'Leggings', unlockXp: 0 },
      { id: 'legs_shorts', label: 'Shorts', unlockXp: 200 },
      { id: 'legs_compression', label: 'Pro Tights', unlockXp: 450 },
    ],
  },
};
