export function calculateEloChange(playerElo: number, opponentElo: number, didWin: boolean, k = 32): number {
  const expected = 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
  const actual = didWin ? 1 : 0;
  return Math.round(k * (actual - expected));
}

export function getRankTier(elo: number): string {
  if (elo >= 2200) return 'goggins';
  if (elo >= 1800) return 'elite';
  if (elo >= 1500) return 'advanced';
  if (elo >= 1200) return 'intermediate';
  return 'rookie';
}

export function isGOGGINSEligible(elo: number, rankedMatches: number, rankPercentile: number, totalUsers: number): boolean {
  return elo >= 2200 && rankedMatches >= 50 && rankPercentile <= 0.01 && totalUsers >= 100;
}
