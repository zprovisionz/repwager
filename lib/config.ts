export const DEV_MODE_MANUAL_COUNT = false;

export const MATCH_DURATION_SECONDS = 60;
export const RAKE_PERCENTAGE = 0.10;
export const STARTING_BALANCE = 100.00;
export const REP_DEBOUNCE_MS = 500;

export const MIN_WAGER = 1;
export const MAX_WAGER = 50;

export const PUSH_UP_ELBOW_LOCKOUT_ANGLE = 160;
export const PUSH_UP_BOTTOM_ANGLE = 90;
export const SQUAT_BOTTOM_ANGLE = 90;

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
