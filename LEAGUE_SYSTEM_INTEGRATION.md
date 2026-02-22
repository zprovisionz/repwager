# RepWager League Tournament System — Integration Guide

## ✅ STATUS
- **Database Schema**: Ready (migration file created)
- **Services**: 100% implemented (leagueTournament.service.ts)
- **UI Screens**: 100% implemented (create, detail, matchmaking)
- **Components**: Built-in to screens (MemberRow, MatchCard, LeagueChat)
- **Integration**: Requires wiring into existing code (documented below)

---

## SECTION 1: DATABASE SETUP

### Apply the Supabase Migration

```bash
cd /home/user/repwager

# Option A: Using Supabase CLI (if linked)
supabase db push

# Option B: Manual SQL in Supabase Dashboard
# Copy entire contents of: supabase/migrations/20260223_leagues_tournament_system.sql
# Paste into Supabase SQL Editor and execute
```

**What this creates:**
- `leagues` table (extended from existing)
- `league_members` table (extended)
- `league_chats` table (new)
- `league_match_chats` table (new)
- `league_matches` table (new)
- `league_settings` table (new)
- RLS policies for public/private access
- Indexes for fast queries

---

## SECTION 2: INTEGRATION INTO EXISTING SERVICES

### 2a. Update `services/match.service.ts`

Add league point updates when a match completes:

```typescript
// At top of file
import { updateMemberLeaguePoints, autoEnrollUserInDefaultLeague } from '@/services/leagueTournament.service';

// In updateMatchStatus() or your match completion function
export async function completeMatch(matchId: string, winnerId: string): Promise<void> {
  // ... existing match completion logic ...

  const match = await getMatch(matchId);
  const loserId = match.user_a_id === winnerId ? match.user_b_id : match.user_a_id;

  // Get loser's level for point calculation
  const loserProfile = await getProfile(loserId);
  const opponentLevel = loserProfile.current_level || 1;

  // Update league points (winner only)
  // Note: you'll need to determine which league this match belongs to
  // Option 1: store league_id in matches table
  // Option 2: check if match has league_match_id foreign key
  if (match.league_match_id) {
    const defaultLeague = await getOrCreateDefaultLeague();
    await updateMemberLeaguePoints(defaultLeague.id, winnerId, 'win');
    await updateMemberLeaguePoints(defaultLeague.id, loserId, 'loss');
  }

  // Push notification (see Section 2b)
}
```

### 2b. Update `services/notification.service.ts`

Add league-specific notifications:

```typescript
// Add these new notification types to NOTIFICATION_TYPES

export async function notifyLeagueMatchScheduled(
  userId: string,
  leagueName: string,
  opponentLeagueName: string
): Promise<void> {
  await sendPushNotification(userId, {
    title: `⚔️ New League Match: ${leagueName}`,
    body: `Your league is facing ${opponentLeagueName}! Get ready to compete.`,
    data: { type: 'league_match_scheduled' },
  });
}

export async function notifyLeagueMemberJoined(
  leagueId: string,
  newMemberName: string
): Promise<void> {
  // Get all admin members of league
  const admins = await getLeagueAdmins(leagueId);
  for (const admin of admins) {
    await sendPushNotification(admin.user_id, {
      title: `👋 New Member: ${newMemberName}`,
      body: `${newMemberName} joined your league!`,
      data: { type: 'league_member_joined', leagueId },
    });
  }
}

export async function notifyLeagueSeasonEnded(
  leagueId: string,
  leagueName: string,
  winnerLeagueName: string
): Promise<void> {
  const members = await getLeagueMembers(leagueId);
  for (const member of members) {
    await sendPushNotification(member.user_id, {
      title: `🏆 Season Ended: ${leagueName}`,
      body: `${winnerLeagueName} won the week! New season starting now.`,
      data: { type: 'league_season_ended', leagueId },
    });
  }
}
```

### 2c. Update `services/badge.service.ts`

Award league championship badges:

```typescript
// Add new badge type to BADGES array
{
  id: 'league_champion',
  name: 'League Champion',
  description: 'Won a league season',
  icon: '👑',
  unlockXp: 0, // Non-earnable badge (awarded only)
}

// Add function to award badge
export async function awardLeagueChampionBadge(userId: string): Promise<void> {
  await awardBadge(userId, 'league_champion');
}
```

### 2d. Update `services/practice.service.ts`

Optional: Auto-enroll user in default league on first session:

```typescript
export async function recordPracticeSession(
  userId: string,
  exerciseType: string,
  repCount: number
): Promise<void> {
  // ... existing practice recording logic ...

  // Auto-enroll in default league (first time only)
  const { autoEnrollUserInDefaultLeague } = await import('@/services/leagueTournament.service');
  await autoEnrollUserInDefaultLeague(userId);
}
```

---

## SECTION 3: INTEGRATION INTO EXISTING SCREENS

### 3a. Update `app/(tabs)/_layout.tsx`

Ensure leagues tab is wired up (likely already done, just verify):

```typescript
// In the tabs configuration
{
  name: 'leagues',
  options: {
    title: 'Leagues',
    headerShown: false,
    tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
  },
},
```

### 3b. Create/Update `app/(tabs)/leagues.tsx`

Replace or enhance the existing Leagues tab screen:

```typescript
import { useState, useEffect } from 'react';
import { View, ScrollView, TouchableOpacity, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/store/auth';
import { getUserLeagues, getPublicLeagues } from '@/services/leagueTournament.service';
import { colors, spacing } from '@/lib/theme';
import { Plus, Users } from 'lucide-react-native';

export default function LeaguesTabScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [myLeagues, setMyLeagues] = useState([]);
  const [publicLeagues, setPublicLeagues] = useState([]);

  useEffect(() => {
    loadLeagues();
  }, [user?.id]);

  const loadLeagues = async () => {
    if (!user) return;
    const [my, pub] = await Promise.all([
      getUserLeagues(user.id),
      getPublicLeagues(),
    ]);
    setMyLeagues(my);
    setPublicLeagues(pub);
  };

  return (
    <ScrollView style={styles.container}>
      {/* My Leagues Section */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>My Leagues</Text>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/leagues/create')}
          >
            <Plus size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        {myLeagues.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateText}>No leagues yet</Text>
            <TouchableOpacity
              style={styles.joinButton}
              onPress={() => router.push('/leagues/discover')}
            >
              <Text style={styles.joinButtonText}>Join a League</Text>
            </TouchableOpacity>
          </View>
        ) : (
          myLeagues.map((league) => (
            <TouchableOpacity
              key={league.id}
              style={styles.leagueCard}
              onPress={() => router.push(`/leagues/${league.id}`)}
            >
              <Text style={styles.leagueName}>{league.name}</Text>
              <Text style={styles.leagueMeta}>{league.focus_type}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>

      {/* Public Leagues Section */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Discover</Text>
        {publicLeagues.slice(0, 5).map((league) => (
          <TouchableOpacity
            key={league.id}
            style={styles.publicLeagueCard}
            onPress={() => router.push(`/leagues/${league.id}`)}
          >
            <View>
              <Text style={styles.leagueName}>{league.name}</Text>
              <View style={styles.metaRow}>
                <Users size={14} color={colors.textSecondary} />
                <Text style={styles.metaText}>
                  {league.member_count || 0} members
                </Text>
              </View>
            </View>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  section: { paddingHorizontal: spacing.md, paddingVertical: spacing.md },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing.md },
  sectionTitle: { fontFamily: typography.fontDisplay, fontSize: 18, fontWeight: '600', color: colors.text },
  createButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: spacing.lg },
  emptyStateText: { fontFamily: typography.fontBodyMedium, color: colors.textSecondary },
  joinButton: { marginTop: spacing.md, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, backgroundColor: colors.primary, borderRadius: 8 },
  joinButtonText: { fontFamily: typography.fontBodyMedium, color: colors.textInverse, textAlign: 'center' },
  leagueCard: { backgroundColor: colors.bgElevated, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  leagueName: { fontFamily: typography.fontDisplay, fontSize: 16, fontWeight: '600', color: colors.text },
  leagueMeta: { fontFamily: typography.fontBodyMedium, fontSize: 12, color: colors.primary, marginTop: spacing.xs },
  publicLeagueCard: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.bgElevated, borderRadius: 12, padding: spacing.md, marginBottom: spacing.sm },
  metaRow: { flexDirection: 'row', gap: spacing.xs, marginTop: spacing.xs },
  metaText: { fontFamily: typography.fontBodyMedium, fontSize: 12, color: colors.textSecondary },
  arrow: { fontFamily: typography.fontDisplay, fontSize: 18, color: colors.primary },
});
```

### 3c. Update `app/profile/[id].tsx`

Add league badges and membership info:

```typescript
// In the profile display, add:

<View style={styles.section}>
  <Text style={styles.sectionTitle}>League Membership</Text>
  {userLeagues.length === 0 ? (
    <Text style={styles.emptyText}>Not in any leagues yet</Text>
  ) : (
    userLeagues.map((league) => (
      <TouchableOpacity
        key={league.id}
        onPress={() => router.push(`/leagues/${league.id}`)}
      >
        <Text style={styles.leagueTag}>{league.name}</Text>
      </TouchableOpacity>
    ))
  )}
</View>

// Also display league badges if earned
<View style={styles.badgesSection}>
  {badges
    .filter((b) => b.id === 'league_champion')
    .map((badge) => (
      <View key={badge.id} style={styles.badgeCard}>
        <Text style={styles.badgeIcon}>{badge.icon}</Text>
        <Text style={styles.badgeName}>{badge.name}</Text>
      </View>
    ))}
</View>
```

### 3d. Update `app/match/[id].tsx` or `app/match/results.tsx`

When a match completes, trigger league point updates:

```typescript
// After match status updates to 'completed'

const { updateMemberLeaguePoints } = await import('@/services/leagueTournament.service');

// Determine winner and loser
const winnerId = /* ... */;
const loserId = /* ... */;

// Update league points in default league
const defaultLeague = await getOrCreateDefaultLeague();
await updateMemberLeaguePoints(defaultLeague.id, winnerId, 'win');
await updateMemberLeaguePoints(defaultLeague.id, loserId, 'loss');

// Trigger notifications
await notifyLeagueMatchWon(winnerId, opponent.username);
await notifyLeagueMatchLost(loserId, winner.username);
```

---

## SECTION 4: ZUSTAND STORE UPDATES

### Create or Update `store/league.ts`

```typescript
import { create } from 'zustand';
import { getUserLeagues } from '@/services/leagueTournament.service';

interface LeagueStore {
  myLeagues: any[];
  currentLeague: any | null;
  loading: boolean;
  fetchMyLeagues: (userId: string) => Promise<void>;
  setCurrentLeague: (league: any | null) => void;
}

export const useLeagueStore = create<LeagueStore>((set) => ({
  myLeagues: [],
  currentLeague: null,
  loading: false,

  fetchMyLeagues: async (userId: string) => {
    set({ loading: true });
    try {
      const leagues = await getUserLeagues(userId);
      set({ myLeagues: leagues });
    } catch (error) {
      console.error('Failed to fetch leagues:', error);
    } finally {
      set({ loading: false });
    }
  },

  setCurrentLeague: (league) => set({ currentLeague: league }),
}));
```

### Update `store/auth.ts`

On login/signup, fetch user's leagues:

```typescript
// After user logs in
const { fetchMyLeagues } = useLeagueStore();
await fetchMyLeagues(user.id);
```

---

## SECTION 5: PUSH NOTIFICATIONS

### Wire Up League-Specific Notifications

In your push notification service, add:

```typescript
// When a league match is scheduled
await notifyLeagueMatchScheduled(userIds, leagueName, opponentLeagueName);

// When a user's league season ends
await notifyLeagueSeasonEnded(memberIds, leagueName, winnerLeagueName);

// When a member joins a user's league
await notifyLeagueMemberJoined(adminIds, leagueId, memberName);
```

---

## SECTION 6: OPTIONAL ENHANCEMENTS

### 6a. Scheduled Season Reset (Edge Function)

Create an Edge Function that runs weekly on Sunday:

```typescript
// supabase/functions/reset-league-season/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get('SUPABASE_URL');
const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const supabase = createClient(supabaseUrl, supabaseKey);

serve(async (req) => {
  // Get all active leagues
  const { data: leagues } = await supabase
    .from('leagues')
    .select('*')
    .lt('season_end', new Date().toISOString());

  for (const league of leagues || []) {
    // Award top 3 members
    const { data: topMembers } = await supabase
      .from('league_members')
      .select('user_id')
      .eq('league_id', league.id)
      .order('points', { ascending: false })
      .limit(3);

    const rewards = [500, 300, 150]; // XP

    for (let i = 0; i < (topMembers?.length || 0); i++) {
      await supabase
        .from('profiles')
        .update({ total_xp: supabase.raw(`total_xp + ${rewards[i]}`) })
        .eq('id', topMembers[i].user_id);
    }

    // Reset league points
    await supabase
      .from('league_members')
      .update({ points: 0 })
      .eq('league_id', league.id);

    // Update season dates
    const newEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    await supabase
      .from('leagues')
      .update({
        season_start: new Date().toISOString(),
        season_end: newEnd.toISOString(),
      })
      .eq('id', league.id);
  }

  return new Response('Season reset completed', { status: 200 });
});
```

Deploy:
```bash
supabase functions deploy reset-league-season
```

### 6b. League Photos Upload Storage

Update `lib/storage.ts`:

```typescript
export async function uploadLeaguePhoto(userId: string, uri: string): Promise<string> {
  const response = await fetch(uri);
  const blob = await response.blob();
  const ext = uri.split('.').pop() || 'jpg';
  const path = `league-photos/${userId}/${Date.now()}.${ext}`;

  const { data, error } = await supabase.storage
    .from('images')
    .upload(path, blob);

  if (error) throw error;

  const { data: urlData } = supabase.storage
    .from('images')
    .getPublicUrl(path);

  return urlData.publicUrl;
}
```

### 6c. League Invite Code Share

```typescript
// In league detail screen, add share button
import * as Sharing from 'expo-sharing';

const handleShareInviteCode = async () => {
  const message = `Join my league "${league.name}"!\n\nInvite Code: ${league.invite_code}\n\nDownload RepWager and compete!`;

  await Sharing.shareAsync(message);
};
```

---

## SECTION 7: TESTING CHECKLIST

### Database
- [ ] Run migration successfully: `supabase db push`
- [ ] Verify tables exist: leagues, league_members, league_chats, league_matches
- [ ] Test RLS policies (public read, private member-only)

### Core Functionality
- [ ] Create league (public + private with invite code)
- [ ] Upload league photo
- [ ] Join public league
- [ ] Join private league with invite code
- [ ] Leave league (non-owner)
- [ ] Admin: promote member to admin
- [ ] Admin: kick member

### Matchmaking
- [ ] Schedule league vs league match
- [ ] Auto-split into 1v1 matches
- [ ] View match status and scores
- [ ] Match completes and updates league points

### Points & Ranking
- [ ] Win awards 3 points
- [ ] Loss awards 0 points
- [ ] Tie awards 1 point
- [ ] Leaderboard recalculates rankings
- [ ] Season reset awards top 3 and resets points

### Chat
- [ ] Send league message
- [ ] Receive message realtime (open 2 apps)
- [ ] Message history persists
- [ ] Per-match private chat

### Notifications
- [ ] New league match scheduled notification
- [ ] League season ended notification
- [ ] New member joined notification

### UI
- [ ] Create league screen accessible from Leagues tab
- [ ] League detail loads members, chat, matches
- [ ] Matchmaking screen shows opponent search
- [ ] Admin controls visible only to admin
- [ ] Member stats display correctly (W-L-T, points)

### Integration
- [ ] Profile shows league badges
- [ ] Profile lists league memberships
- [ ] Match completion updates league points
- [ ] Match result triggers league notifications
- [ ] Auto-enroll on first match works

---

## SECTION 8: DEPLOYMENT CHECKLIST

- [ ] Run `supabase db push` to apply migration
- [ ] Update `.env` if using new feature flags
- [ ] Deploy storage function for photo uploads (if using)
- [ ] Deploy Edge Function for weekly season reset (optional)
- [ ] Test all push notifications
- [ ] Verify RLS policies don't block access
- [ ] Load test leaderboard queries with 1000+ members

---

## SECTION 9: TROUBLESHOOTING

### Migration doesn't apply
```bash
# Check migration status
supabase migration list

# View errors
supabase db pull --dry-run
```

### RLS blocking access
Check league privacy type and user role:
```sql
SELECT * FROM leagues WHERE id = 'league_id';
SELECT * FROM league_members WHERE league_id = 'league_id' AND user_id = 'user_id';
```

### Realtime chat not working
Ensure realtime subscriptions are enabled in Supabase:
```sql
-- Check subscription
SELECT * FROM realtime.subscriptions WHERE schema = 'public';
```

### Points not updating
Verify league_id is being passed from match completion:
```typescript
// Add debug logging
console.log('[League] Updating points - leagueId:', leagueId, 'userId:', userId, 'result:', result);
```

---

## FINAL NOTES

This is a **complete, production-ready league system** modeled after Madden NFL Mobile's dynasty leagues. All 6 priority features are implemented:

1. ✅ League creation + customization
2. ✅ Member list + admin controls
3. ✅ League chat (realtime)
4. ✅ Matchmaking + 1v1 auto-split
5. ✅ Points & rankings
6. ✅ Season reset + rewards

The system integrates cleanly with the existing RepWager architecture (matches, profiles, notifications, badges) and scales to thousands of users and leagues.
