import type { RankTier } from '@/types/database';
import { RANK_TIER_TAGLINES, RANK_TIERS } from '@/types/database';

export function calculateEloChange(playerElo: number, opponentElo: number, didWin: boolean, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = didWin ? 1 : 0;
  return Math.round(k * (actual - expected));
}

/** ELO → canonical ladder tier (see `RANK_TIERS` in types/database). */
export function getRankTier(elo: number): RankTier {
  if (elo >= 2200) return 'GOGGINS';
  if (elo >= 2000) return 'Apex';
  if (elo >= 1850) return 'Legend';
  if (elo >= 1700) return 'Unbreakable';
  if (elo >= 1550) return 'Savage';
  if (elo >= 1400) return 'Beast';
  if (elo >= 1300) return 'Iron';
  if (elo >= 1200) return 'Grinder';
  if (elo >= 1100) return 'Contender';
  return 'Rookie';
}

export function getRankTierTagline(tier: RankTier): string {
  return RANK_TIER_TAGLINES[tier] ?? '';
}

/** Tier order index 0..n for progress UI */
export function getRankTierIndex(tier: RankTier): number {
  return RANK_TIERS.indexOf(tier);
}

/** ELO band floor for each tier (Rookie starts at 0). */
const ELO_FLOORS: Record<RankTier, number> = {
  Rookie: 0,
  Contender: 1100,
  Grinder: 1200,
  Iron: 1300,
  Beast: 1400,
  Savage: 1550,
  Unbreakable: 1700,
  Legend: 1850,
  Apex: 2000,
  GOGGINS: 2200,
};

/** Progress bar: current tier, next threshold, fill 0–100 within band. */
export function getEloProgress(elo: number): {
  tier: RankTier;
  nextAt: number | null;
  pct: number;
} {
  const tier = getRankTier(elo);
  const idx = getRankTierIndex(tier);
  const nextTier = idx < RANK_TIERS.length - 1 ? RANK_TIERS[idx + 1] : null;
  const floor = ELO_FLOORS[tier];
  const nextAt = nextTier ? ELO_FLOORS[nextTier] : null;
  if (nextAt === null) {
    return { tier, nextAt: null, pct: 100 };
  }
  const span = nextAt - floor;
  const pct = span <= 0 ? 100 : Math.min(100, Math.max(0, ((elo - floor) / span) * 100));
  return { tier, nextAt, pct };
}

export function isGOGGINSEligible(elo: number, rankedMatches: number, rankPercentile: number, totalUsers: number): boolean {
  return elo >= 2200 && rankedMatches >= 50 && rankPercentile <= 0.01 && totalUsers >= 100;
}
