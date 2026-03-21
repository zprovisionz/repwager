/** Public Theatre labels — no raw usernames in discover feed. */
export function playerAnonLabel(userId: string): string {
  const tail = userId.replace(/-/g, '').slice(-4).toUpperCase();
  return `Player #${tail}`;
}
