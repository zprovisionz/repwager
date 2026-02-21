#!/usr/bin/env node

/**
 * Seed Script
 *
 * Populates the database with test users for development
 * Usage: npm run seed
 *
 * Creates 3 fake profiles with:
 * - Realistic usernames and avatars
 * - Starting balance of $100
 * - Some unlocked clothing items
 * - Random XP and stats for variety
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

async function seed() {
  console.log('🌱 Seeding test users...\n');

  let successCount = 0;
  let skippedCount = 0;

  for (const testUser of TEST_USERS) {
    try {
      // Check if user already exists
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', testUser.username)
        .single();

      if (existingProfile) {
        console.log(`⏭️  Skipped: ${testUser.username} (already exists)`);
        skippedCount++;
        continue;
      }

      // Insert test user
      const { data, error } = await supabase
        .from('profiles')
        .insert({
          id: crypto.randomUUID(),
          username: testUser.username,
          display_name: testUser.displayName,
          avatar_gender: testUser.gender,
          avatar_head: testUser.clothing.head,
          avatar_torso: testUser.clothing.torso,
          avatar_legs: testUser.clothing.legs,
          balance: 100.00,
          total_xp: Math.floor(Math.random() * 5000),
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
        console.error(`❌ Failed: ${testUser.username} - ${error.message}`);
        continue;
      }

      console.log(`✅ Created: ${testUser.username} (${data?.id?.slice(0, 8)}...)`);
      successCount++;
    } catch (err) {
      console.error(`❌ Error with ${testUser.username}:`, err);
    }
  }

  console.log(`\n📊 Seed Summary:`);
  console.log(`   ✅ Created: ${successCount}`);
  console.log(`   ⏭️  Skipped: ${skippedCount}`);
  console.log(`   📝 Total: ${successCount + skippedCount}\n`);

  if (successCount > 0) {
    console.log('🎉 Seed completed successfully!');
  }
}

seed().catch((err) => {
  console.error('💥 Seed failed:', err);
  process.exit(1);
});
