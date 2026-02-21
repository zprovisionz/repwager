/**
 * Dev Console Helpers
 *
 * Exposes dev utilities to the global scope via window.dev
 * Only available when __DEV__ is true
 *
 * Usage in console:
 *   window.dev.seedData()
 *   window.dev.getTestUserIds()
 *   window.dev.createChallenge(userId, 'push_ups', 5)
 *   window.dev.autoCompleteMatch(matchId, 50, 35)
 *   window.dev.resetBalance(userId)
 */

import { devModeService } from '@/services/devMode.service';
import { DEV_MODE_ENABLED } from '@/lib/config';

export function setupDevConsole() {
  if (!DEV_MODE_ENABLED) return;

  // Expose dev helpers to global window object
  (globalThis as any).dev = {
    seedData: () => {
      console.log('[DevConsole] Running seedData...');
      return devModeService.seedTestUsers();
    },

    getTestUserIds: () => {
      console.log('[DevConsole] Fetching test user IDs...');
      return devModeService.getTestUserIds();
    },

    createChallenge: (
      userId: string,
      exerciseType: 'push_ups' | 'squats' = 'push_ups',
      wagerAmount: number = 5
    ) => {
      console.log(
        `[DevConsole] Creating challenge: userId=${userId}, exercise=${exerciseType}, wager=${wagerAmount}`
      );
      return devModeService.createFakeChallenge(userId, exerciseType, wagerAmount);
    },

    autoCompleteMatch: (matchId: string, winnerReps: number = 50, loserReps: number = 35) => {
      console.log(
        `[DevConsole] Auto-completing match: ${matchId}, winner=${winnerReps}, loser=${loserReps}`
      );
      return devModeService.autoCompleteMatch(matchId, winnerReps, loserReps);
    },

    resetBalance: (userId: string) => {
      console.log(`[DevConsole] Resetting balance for user: ${userId}`);
      return devModeService.resetBalance(userId);
    },

    getTestProfiles: () => {
      console.log('[DevConsole] Fetching test user profiles...');
      return devModeService.getTestUserProfiles();
    },

    help: () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║              RepWager Dev Console Helpers                  ║
╚════════════════════════════════════════════════════════════╝

Available commands (type in console):

📊 Data Management:
  • dev.seedData()                    - Create 3 test users
  • dev.getTestUserIds()              - Get all test user IDs
  • dev.getTestProfiles()             - Get all test user profiles

🎮 Challenge Management:
  • dev.createChallenge(userId, 'push_ups', 5)
    - Create auto-accepted challenge from test user

  • dev.autoCompleteMatch(matchId, 50, 35)
    - Auto-complete match with fake reps

💰 User Management:
  • dev.resetBalance(userId)          - Reset user balance to $100

📖 Other:
  • dev.help()                        - Show this message

Example workflow:
  1. dev.seedData()              // Create test users
  2. dev.createChallenge(YOUR_ID) // Create a challenge
  3. // Auto-accept should happen, or wait for opponent
  4. dev.autoCompleteMatch(MATCH_ID) // Complete the match
      `);
    },
  };

  console.log(
    '%c🔧 Dev Console Ready!',
    'color: #00ff00; font-weight: bold; font-size: 14px'
  );
  console.log('%cType: dev.help() for available commands', 'color: #888; font-size: 12px');
}
