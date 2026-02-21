/**
 * Dev Mode Service
 *
 * Provides utilities for testing and development:
 * - Seed test users with fake profiles
 * - Create and auto-complete fake challenges
 * - Helper functions for rapid iteration
 *
 * Only available when __DEV__ is true
 */

import { supabase } from '@/lib/supabase';
import { STARTING_BALANCE, AVATAR_CLOTHING } from '@/lib/config';

const TEST_USERS = [
  {
    username: 'TestChamp420',
    displayName: 'Test Champ',
    gender: 'male',
    clothing: {
      head: 'head_bandana',
      torso: 'torso_tank',
      legs: 'legs_joggers',
    },
  },
  {
    username: 'SquatQueen',
    displayName: 'Squat Queen',
    gender: 'female',
    clothing: {
      head: 'head_bun',
      torso: 'torso_tank',
      legs: 'legs_shorts',
    },
  },
  {
    username: 'RepDemon',
    displayName: 'Rep Demon',
    gender: 'male',
    clothing: {
      head: 'head_default',
      torso: 'torso_hoodie',
      legs: 'legs_compression',
    },
  },
];

export const devModeService = {
  /**
   * Seed test user profiles into the database
   * Creates 3 fake profiles with clothing unlocks
   * Returns array of created user IDs
   */
  async seedTestUsers(): Promise<string[]> {
    console.log('[DevMode] Seeding test users...');

    const createdIds: string[] = [];

    for (const testUser of TEST_USERS) {
      try {
        // Check if user already exists
        const { data: existingProfile } = await (
          supabase.from('profiles') as any
        )
          .select('id')
          .eq('username', testUser.username)
          .single();

        if (existingProfile) {
          console.log(`[DevMode] User ${testUser.username} already exists`);
          createdIds.push(existingProfile.id);
          continue;
        }

        // For seeding purposes, we insert directly into profiles table
        // In production, users would be created via auth, then new_user_profile RPC
        const { data, error } = await (supabase.from('profiles') as any).insert({
            id: crypto.randomUUID(),
            username: testUser.username,
            display_name: testUser.displayName,
            avatar_gender: testUser.gender,
            avatar_head: testUser.clothing.head,
            avatar_torso: testUser.clothing.torso,
            avatar_legs: testUser.clothing.legs,
            balance: STARTING_BALANCE,
            total_xp: Math.floor(Math.random() * 5000), // Random XP 0-5000
            current_level: 1,
            wins: Math.floor(Math.random() * 20),
            losses: Math.floor(Math.random() * 15),
            total_reps: Math.floor(Math.random() * 2000),
            current_streak: 0,
            longest_streak: Math.floor(Math.random() * 10),
          })
          .select('id')
          .single();

        if (error) {
          console.error(`[DevMode] Failed to seed ${testUser.username}:`, error);
          continue;
        }

        if (data) {
          createdIds.push(data.id);
          console.log(`[DevMode] Created test user: ${testUser.username} (${data.id})`);
        }
      } catch (err) {
        console.error(`[DevMode] Error seeding ${testUser.username}:`, err);
      }
    }

    return createdIds;
  },

  /**
   * Get all test user IDs
   */
  async getTestUserIds(): Promise<string[]> {
    const usernames = TEST_USERS.map((u) => u.username);
    const { data, error } = await (supabase.from('profiles') as any)
      .select('id')
      .in('username', usernames);

    if (error) {
      console.error('[DevMode] Failed to fetch test user IDs:', error);
      return [];
    }

    return (data || []).map((p: any) => p.id);
  },

  /**
   * Create a challenge from a test user to the real user
   * Auto-accepts immediately
   */
  async createFakeChallenge(
    realUserId: string,
    exerciseType: 'push_ups' | 'squats' = 'push_ups',
    wagerAmount: number = 5
  ): Promise<string | null> {
    console.log(`[DevMode] Creating fake challenge for ${realUserId}`);

    try {
      // Get a random test user
      const testUserIds = await this.getTestUserIds();
      if (testUserIds.length === 0) {
        console.error('[DevMode] No test users found. Seed first!');
        return null;
      }

      const testUserId = testUserIds[Math.floor(Math.random() * testUserIds.length)];

      // Create challenge
      const { data: challenge, error: createError } = await (supabase.from('matches') as any).insert({
          challenger_id: testUserId,
          opponent_id: realUserId,
          exercise_type: exerciseType,
          wager_amount: wagerAmount,
          mode: 'competitive',
          status: 'pending',
        })
        .select('id')
        .single();

      if (createError || !challenge) {
        console.error('[DevMode] Failed to create challenge:', createError);
        return null;
      }

      console.log(`[DevMode] Created challenge: ${challenge.id}`);

      // Auto-accept
      const { error: acceptError } = await (supabase.from('matches') as any).update({
          opponent_id: realUserId,
          status: 'accepted',
          opponent_ready: true,
        })
        .eq('id', challenge.id);

      if (acceptError) {
        console.error('[DevMode] Failed to auto-accept:', acceptError);
        return null;
      }

      console.log(`[DevMode] Auto-accepted challenge: ${challenge.id}`);
      return challenge.id;
    } catch (err) {
      console.error('[DevMode] Error creating fake challenge:', err);
      return null;
    }
  },

  /**
   * Auto-complete a match with predetermined rep counts
   * Simulates match completion with fake reps
   */
  async autoCompleteMatch(
    matchId: string,
    winnerReps: number = 50,
    loserReps: number = 35
  ): Promise<boolean> {
    console.log(`[DevMode] Auto-completing match ${matchId}`);

    try {
      // Fetch current match
      const { data: match, error: fetchError } = await (supabase.from('matches') as any)
        .select('*')
        .eq('id', matchId)
        .single();

      if (fetchError || !match) {
        console.error('[DevMode] Match not found:', fetchError);
        return false;
      }

      // Randomize who wins
      const challengerWins = Math.random() > 0.5;
      const winnerId = challengerWins ? match.challenger_id : match.opponent_id;
      const looseerId = challengerWins ? match.opponent_id : match.challenger_id;

      // Update match
      const { error: updateError } = await (supabase.from('matches') as any).update({
          status: 'completed',
          challenger_reps: challengerWins ? winnerReps : loserReps,
          opponent_reps: challengerWins ? loserReps : winnerReps,
          winner_id: winnerId,
          completed_at: new Date().toISOString(),
        })
        .eq('id', matchId);

      if (updateError) {
        console.error('[DevMode] Failed to complete match:', updateError);
        return false;
      }

      console.log(`[DevMode] Completed match: ${matchId}`);
      console.log(`[DevMode]   Winner: ${winnerId}`);
      console.log(`[DevMode]   Winner reps: ${winnerReps}`);
      console.log(`[DevMode]   Loser reps: ${loserReps}`);

      return true;
    } catch (err) {
      console.error('[DevMode] Error auto-completing match:', err);
      return false;
    }
  },

  /**
   * Reset a user's balance to starting amount
   */
  async resetBalance(userId: string): Promise<boolean> {
    try {
      const { error } = await (supabase.from('profiles') as any).update({
        balance: STARTING_BALANCE,
      }).eq('id', userId);

      if (error) {
        console.error('[DevMode] Failed to reset balance:', error);
        return false;
      }

      console.log(`[DevMode] Reset balance for ${userId} to $${STARTING_BALANCE}`);
      return true;
    } catch (err) {
      console.error('[DevMode] Error resetting balance:', err);
      return false;
    }
  },

  /**
   * Get all test user profiles with stats
   */
  async getTestUserProfiles(): Promise<any[]> {
    const usernames = TEST_USERS.map((u) => u.username);
    const { data, error } = await (supabase.from('profiles') as any)
      .select('*')
      .in('username', usernames);

    if (error) {
      console.error('[DevMode] Failed to fetch test profiles:', error);
      return [];
    }

    return data || [];
  },
};
