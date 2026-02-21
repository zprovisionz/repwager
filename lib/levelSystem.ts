/**
 * Leveling System Utilities
 *
 * Provides functions for level calculations, XP thresholds, and level progression
 */

import { LEVEL_THRESHOLDS } from '@/lib/config';

export type Level = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

/**
 * Calculate the level from total XP
 */
export function calculateLevel(totalXp: number): Level {
  if (totalXp >= LEVEL_THRESHOLDS[10]) return 10;
  if (totalXp >= LEVEL_THRESHOLDS[9]) return 9;
  if (totalXp >= LEVEL_THRESHOLDS[8]) return 8;
  if (totalXp >= LEVEL_THRESHOLDS[7]) return 7;
  if (totalXp >= LEVEL_THRESHOLDS[6]) return 6;
  if (totalXp >= LEVEL_THRESHOLDS[5]) return 5;
  if (totalXp >= LEVEL_THRESHOLDS[4]) return 4;
  if (totalXp >= LEVEL_THRESHOLDS[3]) return 3;
  if (totalXp >= LEVEL_THRESHOLDS[2]) return 2;
  return 1;
}

/**
 * Get XP needed to reach a specific level
 */
export function getXpForLevel(level: Level): number {
  return LEVEL_THRESHOLDS[level];
}

/**
 * Get XP needed to reach the next level
 */
export function getXpForNextLevel(currentLevel: Level): number {
  if (currentLevel === 10) return LEVEL_THRESHOLDS[10];
  const nextLevel = (currentLevel + 1) as Level;
  return LEVEL_THRESHOLDS[nextLevel];
}

/**
 * Get XP progress to the next level
 * Returns an object with current, next, and progress percentage
 */
export function getLevelProgress(totalXp: number, currentLevel: Level) {
  const currentLevelXp = LEVEL_THRESHOLDS[currentLevel];
  const nextLevelXp = currentLevel === 10 ? currentLevelXp : LEVEL_THRESHOLDS[(currentLevel + 1) as Level];

  const xpInCurrentLevel = totalXp - currentLevelXp;
  const xpNeededForNextLevel = nextLevelXp - currentLevelXp;
  const progress = Math.min(100, (xpInCurrentLevel / xpNeededForNextLevel) * 100);

  return {
    xpInCurrentLevel,
    xpNeededForNextLevel,
    progress: Math.round(progress),
    xpRemaining: Math.max(0, nextLevelXp - totalXp),
  };
}

/**
 * Get level information including color and description
 */
export function getLevelInfo(level: Level) {
  const colors: Record<Level, string> = {
    1: '#8A9DC0', // textSecondary
    2: '#00FF88', // success
    3: '#00D4FF', // primary
    4: '#00D4FF', // primary
    5: '#FF2D78', // secondary
    6: '#FFB800', // accent
    7: '#FF8C00', // warning
    8: '#FF3B30', // error
    9: '#9D4EDD', // purple
    10: '#FFD700', // gold
  };

  const titles: Record<Level, string> = {
    1: 'Newcomer',
    2: 'Trainee',
    3: 'Athlete',
    4: 'Champion',
    5: 'Legend',
    6: 'Master',
    7: 'Grandmaster',
    8: 'Ascended',
    9: 'Mythic',
    10: 'Eternal',
  };

  const descriptions: Record<Level, string> = {
    1: 'Just starting your journey',
    2: 'Growing stronger every day',
    3: 'Building serious skills',
    4: 'Becoming a real contender',
    5: 'Known across the platform',
    6: 'Setting the standard',
    7: 'Pushing the boundaries',
    8: 'Transcending limits',
    9: 'Legendary status',
    10: 'Peak of perfection',
  };

  return {
    level,
    color: colors[level],
    title: titles[level],
    description: descriptions[level],
    maxLevel: level === 10,
  };
}

/**
 * Check if a user leveled up
 */
export function didLevelUp(previousXp: number, newXp: number, previousLevel: Level): boolean {
  const newLevel = calculateLevel(newXp);
  return newLevel > previousLevel;
}

/**
 * Get XP breakdown from match completion
 */
export function getXpBreakdown(matchMode: 'casual' | 'competitive', baseXp: number) {
  const multipliers = {
    casual: 1.0,
    competitive: 1.5,
  };

  const xpGained = Math.round(baseXp * multipliers[matchMode]);

  return {
    base: baseXp,
    multiplier: multipliers[matchMode],
    total: xpGained,
    mode: matchMode,
  };
}

/**
 * Get suggested next goal XP
 */
export function getNextMilestone(totalXp: number): { xp: number; level: Level; xpNeeded: number } {
  const currentLevel = calculateLevel(totalXp);
  const nextLevel = (currentLevel === 10 ? 10 : (currentLevel + 1)) as Level;
  const nextMilestoneXp = LEVEL_THRESHOLDS[nextLevel];

  return {
    xp: nextMilestoneXp,
    level: nextLevel,
    xpNeeded: Math.max(0, nextMilestoneXp - totalXp),
  };
}
