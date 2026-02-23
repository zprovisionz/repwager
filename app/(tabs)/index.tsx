import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, FlatList } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { getUserMatches, getOpenChallenges, acceptMatch, getHotMatches } from '@/services/match.service';
import { getUserLeaderboardRank, markOnboardingShown } from '@/services/profile.service';
import { getStreakStatus } from '@/services/streak.service';
import { useToastStore } from '@/stores/toastStore';
import MatchCard from '@/components/MatchCard';
import Avatar from '@/components/Avatar';
import OnboardingModal from '@/components/OnboardingModal';
import QuickPracticeModal from '@/components/QuickPracticeModal';
import { Plus, Zap, DollarSign, Flame, Target, Trophy, Dumbbell, TrendingUp, ChevronRight, Bell, Shield } from 'lucide-react-native';
import type { Match } from '@/types/database';

const COMPETITIVE_UNLOCK_THRESHOLD = 10;

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [openChallenges, setOpenChallenges] = useState<any[]>([]);
  const [hotMatches, setHotMatches] = useState<any[]>([]);
  const [myRank, setMyRank] = useState<number | null>(null);
  const [streakStatus, setStreakStatus] = useState<{
    currentStreak: number;
    longestStreak: number;
    freezeAvailable: boolean;
    freezeUsedAt: string | null;
  } | null>(null);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showPractice, setShowPractice] = useState(false);

  async function load() {
    if (!session?.user) return;
    try {
      const [mine, open, hot, rank, streak] = await Promise.all([
        getUserMatches(session.user.id),
        getOpenChallenges(),
        getHotMatches(6),
        getUserLeaderboardRank(session.user.id),
        getStreakStatus(session.user.id),
      ]);
      setMyMatches(mine);
      setOpenChallenges(open.filter((m: any) => m.challenger_id !== session.user.id));
      setHotMatches(hot.filter((m: any) => m.challenger_id !== session.user.id));
      setMyRank(rank);
      setStreakStatus(streak);
    } catch (error) {
      console.error('[HomeScreen] Failed to load matches:', error);
      showToast({ type: 'error', title: 'Failed to load matches' });
    }
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (profile && profile.onboarding_shown === false) {
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, [profile?.onboarding_shown]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshProfile()]);
    setRefreshing(false);
  }, []);

  async function handleAccept(match: any) {
    if (!session?.user || !profile) return;
    if (profile.balance < match.wager_amount) {
      showToast({ type: 'error', title: 'Insufficient balance', message: `Need $${match.wager_amount.toFixed(2)}` });
      return;
    }
    setAccepting(match.id);
    try {
      const accepted = await acceptMatch(match.id, session.user.id);
      showToast({ type: 'success', title: 'Challenge Accepted!', message: 'Get ready to compete.' });
      await refreshProfile();
      router.push({ pathname: '/match/[id]', params: { id: accepted.id } });
    } catch (e: any) {
      showToast({ type: 'error', title: 'Could not accept', message: e.message });
    } finally {
      setAccepting(null);
    }
  }

  function handleOnboardingDismiss() {
    setShowOnboarding(false);
    if (session?.user) markOnboardingShown(session.user.id);
  }

  const inProgressMatches = myMatches.filter((m) => ['accepted', 'in_progress'].includes(m.status));

  const yourTurnMatches = inProgressMatches.filter((m) => {
    const isChallenger = m.challenger_id === session?.user?.id;
    const userSubmitted = isChallenger ? m.challenger_ready : m.opponent_ready;
    return !userSubmitted;
  });

  const waitingMatches = inProgressMatches.filter((m) => {
    const isChallenger = m.challenger_id === session?.user?.id;
    const userSubmitted = isChallenger ? m.challenger_ready : m.opponent_ready;
    const opponentSubmitted = isChallenger ? m.opponent_ready : m.challenger_ready;
    return userSubmitted && !opponentSubmitted;
  });

  const pastMatches = myMatches.filter((m) => ['completed', 'disputed', 'cancelled'].includes(m.status));

  const casualCount = profile?.casual_match_count ?? 0;
  const unlockProgress = Math.min(casualCount / COMPETITIVE_UNLOCK_THRESHOLD, 1);
  const competitiveUnlocked = casualCount >= COMPETITIVE_UNLOCK_THRESHOLD;
  const showUnlockBar = !competitiveUnlocked;

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{ paddingBottom: 80 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={['#00D4FF15', colors.bg]} style={styles.header}>
          <View style={[styles.headerInner, { paddingTop: insets.top + spacing.sm }]}>
            <View style={styles.profileRow}>
              <Avatar gender={profile?.avatar_gender ?? 'male'} head={profile?.avatar_head} torso={profile?.avatar_torso} legs={profile?.avatar_legs} size={52} />
              <View style={styles.profileText}>
                <Text style={styles.greeting}>Hey, {profile?.display_name?.split(' ')[0] ?? 'Champ'}</Text>
                <Text style={styles.username}>@{profile?.username}</Text>
              </View>
              <View style={styles.actionButtons}>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/leaderboard')}>
                  <Trophy size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.iconBtn} onPress={() => router.push('/(tabs)/notifications')}>
                  <Bell size={20} color={colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.newBtn} onPress={() => router.push('/challenge/create')}>
                  <Plus size={20} color={colors.textInverse} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statBlock}>
                <DollarSign size={16} color={colors.accent} />
                <Text style={styles.statValue}>${profile?.balance.toFixed(2) ?? '0.00'}</Text>
                <Text style={styles.statLabel}>Balance</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Target size={16} color={colors.success} />
                <Text style={styles.statValue}>{profile?.wins ?? 0}W / {profile?.losses ?? 0}L</Text>
                <Text style={styles.statLabel}>Record</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBlock}>
                <Flame size={16} color={colors.secondary} />
                <View style={styles.streakValueRow}>
                  <Text style={styles.statValue}>{profile?.current_streak ?? 0}</Text>
                  {streakStatus?.freezeAvailable && (
                    <Shield size={14} color={colors.success} style={styles.freezeIcon} />
                  )}
                </View>
                <Text style={styles.statLabel}>Streak</Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        {/* RANK CALLOUT */}
        {myRank !== null && (
          <TouchableOpacity style={styles.rankBanner} onPress={() => router.push('/(tabs)/leaderboard')}>
            <Trophy size={16} color={myRank <= 3 ? colors.secondary : colors.textSecondary} />
            <Text style={styles.rankText}>
              {myRank <= 3
                ? `You're #${myRank} — in the badge zone!`
                : `You're #${myRank} — top 3 earns a badge!`}
            </Text>
            <ChevronRight size={14} color={colors.textMuted} />
          </TouchableOpacity>
        )}

        {/* CASUAL → COMPETITIVE UNLOCK BAR */}
        {showUnlockBar && (
          <View style={styles.unlockCard}>
            <View style={styles.unlockHeader}>
              <TrendingUp size={16} color={colors.primary} />
              <Text style={styles.unlockTitle}>Unlock Competitive Mode</Text>
              <Text style={styles.unlockCount}>{casualCount}/{COMPETITIVE_UNLOCK_THRESHOLD}</Text>
            </View>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${unlockProgress * 100}%` }]} />
            </View>
            <Text style={styles.unlockHint}>Complete {COMPETITIVE_UNLOCK_THRESHOLD - casualCount} more casual matches to unlock real-money wagers</Text>
          </View>
        )}

        {/* QUICK PRACTICE BUTTON */}
        <View style={styles.quickPracticeWrap}>
          <TouchableOpacity style={styles.quickPracticeBtn} onPress={() => setShowPractice(true)}>
            <Dumbbell size={20} color={colors.textInverse} />
            <Text style={styles.quickPracticeText}>Quick Practice</Text>
            <Text style={styles.quickPracticeHint}>60s · No wager</Text>
          </TouchableOpacity>
        </View>

        {/* HOT MATCHES */}
        {hotMatches.length > 0 && (
          <View style={styles.hotSection}>
            <Text style={styles.sectionTitle}>HOT MATCHES</Text>
            <FlatList
              data={hotMatches}
              horizontal
              showsHorizontalScrollIndicator={false}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.hotList}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.hotCard}
                  onPress={() => handleAccept(item)}
                  disabled={accepting === item.id}
                >
                  <View style={styles.hotCardTop}>
                    <Text style={styles.hotWager}>${item.wager_amount.toFixed(0)}</Text>
                    <View style={[styles.hotModeBadge, item.mode === 'casual' && styles.hotModeBadgeCasual]}>
                      <Text style={styles.hotModeText}>{item.mode === 'casual' ? 'CASUAL' : 'COMP'}</Text>
                    </View>
                  </View>
                  <Text style={styles.hotExercise}>{item.exercise_type === 'push_ups' ? 'Push-Ups' : 'Squats'}</Text>
                  <Text style={styles.hotHandle}>vs @{item.profiles?.username ?? '???'}</Text>
                  <View style={styles.hotAcceptRow}>
                    <Text style={styles.hotAcceptText}>{accepting === item.id ? 'Accepting...' : 'Accept'}</Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* YOUR TURN SECTION */}
        {yourTurnMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>YOUR TURN TO RECORD</Text>
            <View style={styles.list}>
              {yourTurnMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  myUserId={session?.user?.id}
                  onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
                  submissionState="notSubmitted"
                />
              ))}
            </View>
          </View>
        )}

        {/* WAITING SECTION */}
        {waitingMatches.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>WAITING FOR OPPONENT</Text>
            <View style={styles.list}>
              {waitingMatches.map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  myUserId={session?.user?.id}
                  onPress={() => router.push({ pathname: '/match/[id]', params: { id: m.id } })}
                  submissionState="waitingForOpponent"
                />
              ))}
            </View>
          </View>
        )}

        <View style={styles.tabRow}>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'open' && styles.tabBtnActive]}
            onPress={() => setTab('open')}
          >
            <Text style={[styles.tabBtnText, tab === 'open' && styles.tabBtnTextActive]}>Open Challenges</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
            onPress={() => setTab('mine')}
          >
            <Text style={[styles.tabBtnText, tab === 'mine' && styles.tabBtnTextActive]}>Match Results</Text>
          </TouchableOpacity>
        </View>

        {tab === 'open' && (
          <View style={styles.section}>
            {openChallenges.length === 0 ? (
              <View style={styles.empty}>
                <Zap size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No open challenges</Text>
                <Text style={styles.emptySubtitle}>Be the first — create a challenge!</Text>
                <TouchableOpacity style={styles.emptyBtn} onPress={() => router.push('/challenge/create')}>
                  <Text style={styles.emptyBtnText}>Create Challenge</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.list}>
                {openChallenges.map((m) => (
                  <View key={m.id}>
                    <MatchCard match={m} myUserId={session?.user?.id} showChallenger />
                    <TouchableOpacity
                      style={[styles.acceptBtn, accepting === m.id && styles.acceptBtnLoading]}
                      onPress={() => handleAccept(m)}
                      disabled={accepting === m.id}
                    >
                      <Text style={styles.acceptBtnText}>{accepting === m.id ? 'Accepting...' : `Accept — $${m.wager_amount.toFixed(2)}`}</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}

        {tab === 'mine' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>MATCH RESULTS</Text>
            {pastMatches.length === 0 ? (
              <View style={styles.empty}>
                <Trophy size={36} color={colors.textMuted} />
                <Text style={styles.emptyTitle}>No matches completed yet</Text>
                <Text style={styles.emptySubtitle}>Complete some challenges to see your results</Text>
              </View>
            ) : (
              <View style={styles.list}>
                {pastMatches.map((m) => (
                  <MatchCard
                    key={m.id}
                    match={m}
                    myUserId={session?.user?.id}
                    onPress={() => router.push({ pathname: '/theatre/[id]', params: { id: m.id } })}
                    submissionState="completed"
                  />
                ))}
              </View>
            )}
          </View>
        )}
      </ScrollView>

      <OnboardingModal visible={showOnboarding} onDismiss={handleOnboardingDismiss} />
      <QuickPracticeModal visible={showPractice} onClose={() => setShowPractice(false)} />
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: { paddingBottom: spacing.md },
  headerInner: { paddingHorizontal: spacing.md },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.lg,
  },
  profileText: { flex: 1 },
  greeting: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.5,
  },
  username: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  newBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 5,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 15,
    color: colors.text,
  },
  statLabel: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  streakValueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  freezeIcon: {
    marginLeft: 2,
  },
  rankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rankText: {
    flex: 1,
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  unlockCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  unlockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  unlockTitle: {
    flex: 1,
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  unlockCount: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 12,
    color: colors.primary,
  },
  progressTrack: {
    height: 6,
    backgroundColor: colors.bgElevated,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: 3,
  },
  unlockHint: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  quickPracticeWrap: {
    paddingHorizontal: spacing.md,
    marginTop: spacing.md,
  },
  quickPracticeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  quickPracticeText: {
    flex: 1,
    fontFamily: typography.fontDisplayMedium,
    fontSize: 15,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
  quickPracticeHint: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: 'rgba(0,0,0,0.5)',
  },
  hotSection: {
    marginTop: spacing.lg,
  },
  hotList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  hotCard: {
    width: 140,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  hotCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  hotWager: {
    fontFamily: typography.fontDisplay,
    fontSize: 22,
    color: colors.accent,
  },
  hotModeBadge: {
    backgroundColor: colors.primary,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hotModeBadgeCasual: {
    backgroundColor: colors.bgElevated,
  },
  hotModeText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 9,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  hotExercise: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.text,
  },
  hotHandle: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  hotAcceptRow: {
    marginTop: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingVertical: spacing.xs,
    alignItems: 'center',
  },
  hotAcceptText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.textInverse,
  },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  list: { gap: spacing.sm },
  tabRow: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginTop: spacing.lg,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.md - 2,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabBtnTextActive: { color: colors.textInverse },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptySubtitle: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textMuted,
  },
  emptyBtn: {
    marginTop: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  emptyBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.textInverse,
  },
  acceptBtn: {
    marginTop: spacing.xs,
    backgroundColor: colors.success,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  acceptBtnLoading: { opacity: 0.6 },
  acceptBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.textInverse,
  },
});
