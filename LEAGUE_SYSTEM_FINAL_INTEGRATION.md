# RepWager League System: COMPLETE Integration Guide
## With Playoffs + Prestige Features

---

## PHASE 1: DATABASE SETUP (5 minutes)

### 1.1 Apply Migrations

```bash
cd /home/user/repwager

# Apply both league migrations in sequence
supabase db push
# This applies:
# - 20260223_leagues_tournament_system.sql (initial schema)
# - 20260224_league_playoffs_prestige.sql (enhancements)
```

### 1.2 Verify Tables

```sql
-- Check in Supabase SQL Editor:
SELECT * FROM leagues LIMIT 1;           -- Should have playoff_* columns
SELECT * FROM league_members LIMIT 1;    -- Should have league_level, league_title, league_xp
SELECT * FROM playoff_matches LIMIT 1;   -- Should exist (initially empty)
SELECT * FROM user_league_badges LIMIT 1; -- Should exist (initially empty)
```

---

## PHASE 2: SERVICE INTEGRATION (30 minutes)

### 2.1 Update `services/notification.service.ts`

Add these notification functions (reference existing functions as pattern):

```typescript
// At top with other imports
import { notifyLeagueMemberJoined, notifyLeagueMatchScheduled, notifyLeagueSeasonEnded } from '@/services/leagueTournament.service';

// Add these functions
export async function notifyLeagueMatchScheduled(
  userIds: string[],
  leagueName: string,
  opponentLeagueName: string,
  matchId: string
): Promise<void> {
  for (const userId of userIds) {
    try {
      await sendPushNotification(userId, {
        title: `⚔️ League Match: ${leagueName} vs ${opponentLeagueName}`,
        body: 'Your league is facing a new opponent! Get ready to compete.',
        data: { type: 'league_match_scheduled', matchId },
      });
    } catch (err) {
      console.warn('[Notification] Failed to send league match notification:', err);
    }
  }
}

export async function notifyLeaguePlayoffAdvance(
  userId: string,
  leagueName: string,
  roundName: string
): Promise<void> {
  try {
    await sendPushNotification(userId, {
      title: `🏆 Playoffs Advancing: ${leagueName}`,
      body: `You advanced to the ${roundName}!`,
      data: { type: 'league_playoff_advance', leagueName },
    });
  } catch (err) {
    console.warn('[Notification] Failed to send playoff advance notification:', err);
  }
}

export async function notifyLeagueLevelUp(
  userId: string,
  leagueName: string,
  newLevel: number
): Promise<void> {
  try {
    await sendPushNotification(userId, {
      title: `⭐ League Level Up in ${leagueName}`,
      body: `Congratulations! You reached Level ${newLevel}. New title unlocked!`,
      data: { type: 'league_level_up', leagueName, newLevel },
    });
  } catch (err) {
    console.warn('[Notification] Failed to send level up notification:', err);
  }
}
```

### 2.2 Update `services/badge.service.ts`

Add league badge awards (after existing badge definitions):

```typescript
// Add to BADGES array:
{
  id: 'league_mvp',
  name: 'League MVP',
  description: 'Highest points in league this week',
  icon: '🏆',
  unlock_xp: 0, // Non-earnable, awarded only
},
{
  id: 'league_playoff_champion',
  name: 'Playoff Champion',
  description: 'Won playoff bracket',
  icon: '👑',
  unlock_xp: 0,
},
{
  id: 'league_veteran',
  name: 'League Veteran',
  description: 'Reached level 3 in league',
  icon: '⭐',
  unlock_xp: 0,
}

// Add award function:
export async function awardLeagueBadge(
  userId: string,
  badgeId: string,
  leagueId?: string
): Promise<boolean> {
  try {
    // Award to global profile badges
    await awardBadge(userId, badgeId);

    // Also track in league-specific badges if leagueId provided
    if (leagueId) {
      const { awardLeagueBadge } = await import('@/services/leagueTournament.service');
      await awardLeagueBadge(userId, leagueId, badgeId);
    }

    return true;
  } catch (err) {
    console.warn('[Badge] Failed to award league badge:', err);
    return false;
  }
}
```

### 2.3 Update `services/practice.service.ts`

Add auto-enrollment on first practice (in `recordPracticeSession`):

```typescript
import { autoEnrollUserInDefaultLeague } from '@/services/leagueTournament.service';

export async function recordPracticeSession(
  userId: string,
  exerciseType: string,
  repCount: number
): Promise<void> {
  // ... existing practice recording logic ...

  // Auto-enroll user in default league (first time only)
  try {
    await autoEnrollUserInDefaultLeague(userId);
  } catch (err) {
    console.warn('[Practice] Failed to enroll in league:', err);
    // Don't fail the practice session if league enrollment fails
  }
}
```

### 2.4 Verify `services/match.service.ts` (Already integrated)

The match service already has `updateMatchLeagueStats()` which we enhanced to include:
- League point awards
- League XP + prestige progression
- Debug logging

**No changes needed** — already integrated in previous commit.

---

## PHASE 3: STORE SETUP (10 minutes)

### 3.1 Update `store/authStore.ts` or `_layout.tsx`

On user login, initialize league store:

```typescript
// In authStore or app/_layout.tsx after user logs in:
import { useLeagueStore } from '@/store/leagueStore';

// After setting session/user:
if (session?.user?.id) {
  const { fetchMyLeagues } = useLeagueStore.getState();
  // Load leagues in background (don't await, let it populate gradually)
  fetchMyLeagues(session.user.id).catch(err =>
    console.warn('[League] Failed to fetch leagues:', err)
  );
}
```

### 3.2 Verify Store Exists

The Zustand store (`store/leagueStore.ts`) is already created with:
- `myLeagues`: User's joined leagues
- `currentLeague`: Currently selected league
- `prestige`: Cached prestige data (level, title, badges)
- `fetchMyLeagues()`: Load all user leagues
- `loadPrestige()`: Load individual prestige
- `setCurrentLeague()`: Select league for viewing

---

## PHASE 4: UI INTEGRATION (20 minutes)

### 4.1 Verify Leagues Tab Screen

File: `app/(tabs)/leagues.tsx`

Already updated with:
- ✅ Prestige display (level, title badges)
- ✅ "My Leagues" vs "Discover" sections
- ✅ Crown icon for level 3+ users
- ✅ Focus type badges
- ✅ Create league button
- ✅ Integration with leagueStore
- ✅ Prestige map loading

**No additional changes needed.**

### 4.2 Update `app/(tabs)/_layout.tsx` (Verify Leagues Tab)

Ensure the leagues tab is properly configured:

```typescript
{
  name: 'leagues',
  options: {
    title: 'Leagues',
    headerShown: false,
    tabBarIcon: ({ color }) => <Trophy size={24} color={color} />,
  },
}
```

### 4.3 Optional: Update `app/profile/[id].tsx`

Add league membership + prestige display to user profile:

```typescript
// In profile screen, add this section:

<View style={styles.section}>
  <Text style={styles.sectionTitle}>League Prestige</Text>
  {userLeaguePrestige.map((prestige, idx) => (
    <View key={idx} style={styles.prestigeItem}>
      <View style={styles.prestigeBadges}>
        <Text style={styles.levelBadge}>Lvl {prestige.level}</Text>
        {prestige.title && (
          <Text style={styles.titleText}>{prestige.title}</Text>
        )}
      </View>
      {prestige.badges.length > 0 && (
        <View style={styles.earnedBadges}>
          {prestige.badges.map((badgeId) => (
            <Text key={badgeId} style={styles.badgeIcon}>
              {getBadgeIcon(badgeId)}
            </Text>
          ))}
        </View>
      )}
    </View>
  ))}
</View>
```

---

## PHASE 5: FEATURE-SPECIFIC SETUP (15 minutes)

### 5.1 Playoff Bracket Generation

When season resets (currently manual, can be automated):

```typescript
// After resetLeagueSeason() completes, call:
import { generatePlayoffBracket } from '@/services/leagueTournament.service';

await generatePlayoffBracket(leagueId);
// This auto-creates top 8 (or 16) single-elimination bracket
```

### 5.2 Prestige Level Display (Already Integrated)

Prestige is automatically loaded and displayed in:
- ✅ Leagues tab (level badge next to league name)
- ✅ Member roster (in `app/leagues/[id].tsx`)
- ✅ League chat (can show level next to username)

**No additional setup needed.**

### 5.3 Push Notifications (Ready to Trigger)

Add these calls at the right moments:

```typescript
// When match completes and user levels up:
if (leveledUp) {
  await notifyLeagueLevelUp(userId, leagueName, newLevel);
}

// When playoff bracket is created:
const leagueMembers = await getLeagueMembers(leagueId);
for (const member of leagueMembers) {
  await notifyLeaguePlayoffStart(member.user_id, leagueName);
}

// When user advances in playoffs:
if (playoffAdvance) {
  await notifyLeaguePlayoffAdvance(userId, leagueName, nextRoundName);
}
```

---

## PHASE 6: FINAL CHECKLIST (Testing)

### Database
- [ ] Run `supabase db push` without errors
- [ ] Verify all new tables exist in Supabase
- [ ] Check RLS policies are in place (SELECT test)

### Services
- [ ] Import league functions in match.service.ts working
- [ ] `updateMatchLeagueStats()` called when match completes
- [ ] `awardLeagueXp()` increments league_xp column
- [ ] `generatePlayoffBracket()` creates bracket matches
- [ ] Console logs show "[League Integration]" messages

### Store
- [ ] Zustand store initializes on app startup
- [ ] `fetchMyLeagues()` populates myLeagues on login
- [ ] `loadPrestige()` caches level/title/badges
- [ ] leagueStore state accessible from any component

### UI
- [ ] Leagues tab loads and shows "My Leagues"
- [ ] Prestige badges visible (level + title)
- [ ] Create League button navigates to form
- [ ] League detail screen opens when tapping card
- [ ] Member roster shows prestige levels
- [ ] Crown icon shows for level 3+ members

### Features
- [ ] Match winner gains 3 league points
- [ ] Match winner gains 50 league XP
- [ ] League levels auto-calculate (1-5)
- [ ] Titles auto-assign at level milestones
- [ ] Playoff bracket displays when clicked
- [ ] Playoff matches have higher stakes marker

### Notifications
- [ ] Push notification on level up
- [ ] Push notification on playoff advancement
- [ ] Push notification on season end
- [ ] Push notification on new match scheduled

---

## PHASE 7: PRODUCTION DEPLOYMENT

### Pre-Launch
- [ ] Test all 10 phases above
- [ ] Verify RLS doesn't block queries for members
- [ ] Check indexes are created (fast queries)
- [ ] Monitor performance: `SELECT COUNT(*) FROM league_members` < 100ms

### Deployment
```bash
# 1. Backup Supabase database
supabase db download --file backup.sql

# 2. Apply migrations
supabase db push

# 3. Verify on staging
# (run full test checklist)

# 4. Deploy app to production
npm run build && npm run deploy

# 5. Monitor logs for errors
supabase logs --tail
```

### Post-Launch
- [ ] Monitor for RLS permission errors
- [ ] Check prestige calculations are correct
- [ ] Verify playoff brackets generate on Sunday reset
- [ ] Track user engagement (leagues created, members joined)

---

## QUICK REFERENCE: Key Files Modified

| File | Changes | Status |
|------|---------|--------|
| `supabase/migrations/20260224_league_playoffs_prestige.sql` | NEW | ✅ Created |
| `services/leagueTournament.service.ts` | +6 new functions (playoff, prestige) | ✅ Updated |
| `services/match.service.ts` | Enhanced `updateMatchLeagueStats()` | ✅ Updated |
| `services/notification.service.ts` | +3 new notification functions | 🟡 Ready to add |
| `services/badge.service.ts` | +1 new award function | 🟡 Ready to add |
| `services/practice.service.ts` | +auto-enroll call | 🟡 Ready to add |
| `store/leagueStore.ts` | NEW (Zustand store) | ✅ Created |
| `app/(tabs)/leagues.tsx` | Enhanced with prestige display | ✅ Updated |
| `app/(tabs)/_layout.tsx` | Verify leagues tab config | 🟡 Verify |
| `app/profile/[id].tsx` | Optional prestige section | 🟡 Optional |

---

## TROUBLESHOOTING

### Issue: RLS blocks league queries
**Solution**: Check user is in `league_members` table:
```sql
SELECT * FROM league_members WHERE user_id = 'user_id' AND league_id = 'league_id';
```
If empty, call `joinLeague()` first.

### Issue: Prestige not showing on UI
**Solution**: Verify `loadPrestige()` is called:
```typescript
useEffect(() => {
  const { loadPrestige } = useLeagueStore();
  loadPrestige(userId, leagueId);
}, [userId, leagueId]);
```

### Issue: Playoff bracket not generating
**Solution**: Call `generatePlayoffBracket()` after season reset:
```typescript
const reset = await resetLeagueSeason(leagueId, userId);
if (reset) {
  await generatePlayoffBracket(leagueId);
}
```

### Issue: League XP not updating
**Solution**: Verify `updateMatchLeagueStats()` is called in match results:
```typescript
await updateMatchLeagueStats(winnerId, opponentLevel, true);
```

---

## SUCCESS CRITERIA

Your league system is **production-ready** when:

✅ Database migrations apply without errors
✅ All new tables created with proper RLS
✅ Services can award points, XP, badges
✅ UI displays prestige levels + titles
✅ Playoff brackets auto-generate
✅ Notifications trigger on milestones
✅ All tests pass (see Phase 6 checklist)

---

## NEXT STEPS

1. **Now**: Apply migrations (`supabase db push`)
2. **Next 30 min**: Complete Phases 2-4 (services + store)
3. **Next 20 min**: Test UI integration (Phase 5)
4. **Then**: Run full test checklist (Phase 6)
5. **Finally**: Deploy to production with monitoring

**Total time**: ~2 hours from start to production-ready.

---

Generated: 2026-02-22 | Session: claude/review-repwager-codebase-pgnIh
