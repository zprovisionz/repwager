import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  getUserMatches,
  getOpenChallenges,
  acceptMatch,
  buildMatchDisplay,
} from '@/services/match.service';
import { checkStreakStatus } from '@/services/streak.service';
import { useToastStore } from '@/stores/toastStore';
import Avatar from '@/components/Avatar';
import {
  Plus,
  Zap,
  Flame,
  Target,
  Trophy,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Snowflake,
  Lock,
} from 'lucide-react-native';

const CASUAL_MATCHES_TO_UNLOCK = 10;
import type { Match } from '@/types/database';
import {
  ACTIVE_MATCH_STATUSES,
  TERMINAL_MATCH_STATUSES,
  RANK_TIER_COLORS,
} from '@/types/database';

function formatTimeRemaining(seconds: number): string {
  if (seconds <= 0) return 'Expired';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function AsyncMatchCard({
  match,
  myUserId,
  onPress,
}: {
  match: Match;
  myUserId: string;
  onPress: () => void;
}) {
  const display = buildMatchDisplay(match, myUserId);
  const [timeStr, setTimeStr] = useState(
    display.timeRemainingSeconds !== null
      ? formatTimeRemaining(display.timeRemainingSeconds)
      : null
  );

  useEffect(() => {
    if (!match.submission_deadline) return;
    const interval = setInterval(() => {
      const remaining = Math.floor(
        (new Date(match.submission_deadline!).getTime() - Date.now()) / 1000
      );
      setTimeStr(remaining > 0 ? formatTimeRemaining(remaining) : 'Expired');
    }, 1000);
    return () => clearInterval(interval);
  }, [match.submission_deadline]);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    accepted: {
      label: 'Record Now',
      color: colors.primary,
      icon: <Zap size={13} color={colors.primary} />,
    },
    challenger_submitted: {
      label: display.iAmChallenger ? 'Waiting...' : 'Opponent Ready',
      color: display.iAmChallenger ? colors.accent : colors.secondary,
      icon: display.iAmChallenger
        ? <Clock size={13} color={colors.accent} />
        : <Zap size={13} color={colors.secondary} />,
    },
    opponent_submitted: {
      label: display.iAmChallenger ? 'Opponent Ready' : 'Waiting...',
      color: display.iAmChallenger ? colors.secondary : colors.accent,
      icon: display.iAmChallenger
        ? <Zap size={13} color={colors.secondary} />
        : <Clock size={13} color={colors.accent} />,
    },
    completed: {
      label: 'View Results',
      color: colors.success,
      icon: <CheckCircle size={13} color={colors.success} />,
    },
    expired: {
      label: 'Refunded',
      color: colors.textMuted,
      icon: <AlertCircle size={13} color={colors.textMuted} />,
    },
    disputed: {
      label: 'Disputed',
      color: colors.warning,
      icon: <AlertCircle size={13} color={colors.warning} />,
    },
    pending: {
      label: 'Open',
      color: colors.accent,
      icon: <Clock size={13} color={colors.accent} />,
    },
    cancelled: {
      label: 'Cancelled',
      color: colors.textMuted,
      icon: <AlertCircle size={13} color={colors.textMuted} />,
    },
  };

  const config = statusConfig[match.status] ?? statusConfig.pending;

  const isUrgent =
    display.timeRemainingSeconds !== null &&
    display.timeRemainingSeconds < 1800 &&
    !display.iHaveSubmitted &&
    ACTIVE_MATCH_STATUSES.includes(match.status);

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View
        style={[
          styles.asyncCard,
          { borderLeftColor: isUrgent ? colors.secondary : config.color },
          isUrgent && styles.asyncCardUrgent,
        ]}
      >
        <View style={styles.asyncCardTop}>
          <View style={styles.asyncCardLeft}>
            <View style={styles.asyncExerciseRow}>
              <Zap size={13} color={colors.primary} />
              <Text style={styles.asyncExercise}>Push-Ups</Text>
            </View>
            <Text style={styles.asyncWager}>{match.wager_amount} RC</Text>
          </View>

          <View style={styles.asyncCardRight}>
            <View
              style={[
                styles.asyncStatusBadge,
                {
                  backgroundColor: config.color + '22',
                  borderColor: config.color,
                },
              ]}
            >
              {config.icon}
              <Text style={[styles.asyncStatusText, { color: config.color }]}>
                {config.label}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.asyncProgressRow}>
          <View style={styles.asyncPlayerStatus}>
            <View
              style={[
                styles.asyncDot,
                {
                  backgroundColor: display.iHaveSubmitted
                    ? colors.success
                    : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.asyncPlayerLabel}>You</Text>
            {display.iHaveSubmitted && display.myReps !== null && (
              <Text style={styles.asyncReps}>{display.myReps} reps</Text>
            )}
          </View>

          <Text style={styles.asyncVs}>vs</Text>

          <View style={styles.asyncPlayerStatus}>
            <View
              style={[
                styles.asyncDot,
                {
                  backgroundColor: display.opponentHasSubmitted
                    ? colors.success
                    : colors.textMuted,
                },
              ]}
            />
            <Text style={styles.asyncPlayerLabel}>Opponent</Text>
            {display.isRevealed && display.opponentReps !== null && (
              <Text style={styles.asyncReps}>
                {display.opponentReps} reps
              </Text>
            )}
          </View>
        </View>

        {timeStr && ACTIVE_MATCH_STATUSES.includes(match.status) && (
          <View style={styles.asyncTimer}>
            <Clock
              size={11}
              color={isUrgent ? colors.secondary : colors.textMuted}
            />
            <Text
              style={[
                styles.asyncTimerText,
                isUrgent && { color: colors.secondary },
              ]}
            >
              {timeStr} remaining
            </Text>
          </View>
        )}

        {match.status === 'expired' && (
          <View style={styles.asyncRefundBadge}>
            <Text style={styles.asyncRefundText}>✓ RepCoins refunded</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

function StreakIcon({ profile }: { profile: any }) {
  const status = profile
    ? checkStreakStatus({
        current_streak: profile.current_streak ?? 0,
        last_active_date: profile.last_active_date ?? null,
        streak_frozen_until: (profile as any).streak_frozen_until,
      })
    : null;

  if (status?.isFrozen) {
    return <Snowflake size={14} color="#4FC3F7" />;
  }
  return <Flame size={14} color={colors.secondary} />;
}

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [myMatches, setMyMatches] = useState<Match[]>([]);
  const [openChallenges, setOpenChallenges] = useState<any[]>([]);
  const [tab, setTab] = useState<'open' | 'mine'>('open');
  const [refreshing, setRefreshing] = useState(false);
  const [accepting, setAccepting] = useState<string | null>(null);

  async function load() {
    if (!session?.user) return;
    try {
      const [mine, open] = await Promise.all([
        getUserMatches(session.user.id, 'all'),
        getOpenChallenges(session.user.id),
      ]);
      setMyMatches(mine);
      setOpenChallenges(open);
    } catch {}
  }

  useEffect(() => {
    load();
  }, [session?.user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([load(), refreshProfile()]);
    setRefreshing(false);
  }, [refreshProfile]);

  async function handleAccept(match: any) {
    if (!session?.user || !profile) return;
    const repcoins = (profile as any).repcoins ?? 100;
    if (repcoins < match.wager_amount) {
      showToast({
        type: 'error',
        title: 'Insufficient RepCoins',
        message: `Need ${match.wager_amount} RC`,
      });
      return;
    }
    setAccepting(match.id);
    try {
      await acceptMatch(match.id, session.user.id);
      showToast({
        type: 'success',
        title: 'Challenge Accepted!',
        message: 'You have 2 hours to record your set.',
      });
      await Promise.all([load(), refreshProfile()]);
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Could not accept',
        message: e.message,
      });
    } finally {
      setAccepting(null);
    }
  }

  const activeMatches = myMatches.filter((m) =>
    ACTIVE_MATCH_STATUSES.includes(m.status)
  );
  const pastMatches = myMatches.filter((m) =>
    TERMINAL_MATCH_STATUSES.includes(m.status)
  );

  const casualMatchCount = pastMatches.filter((m) => (m.wager_amount ?? 0) === 0 && m.status === 'completed').length;
  const wagersUnlocked = casualMatchCount >= CASUAL_MATCHES_TO_UNLOCK;

  const rankColor =
    profile?.rank_tier
      ? (RANK_TIER_COLORS as Record<string, string>)[profile.rank_tier] ?? colors.primary
      : colors.primary;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: 100 }}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.primary}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={['#00D4FF12', colors.bg]}
        style={styles.header}
      >
        <View
          style={[
            styles.headerInner,
            { paddingTop: insets.top + spacing.sm },
          ]}
        >
          <View style={styles.profileRow}>
            <Avatar
              gender={profile?.avatar_gender ?? 'male'}
              head={profile?.avatar_head}
              torso={profile?.avatar_torso}
              legs={profile?.avatar_legs}
              size={52}
            />
            <View style={styles.profileText}>
              <Text style={styles.greeting}>
                {profile?.display_name?.split(' ')[0] ?? 'Champ'}
              </Text>
              <View style={styles.rankRow}>
                <View
                  style={[
                    styles.rankPill,
                    { borderColor: rankColor + '60' },
                  ]}
                >
                  <Text style={[styles.rankText, { color: rankColor }]}>
                    {profile?.rank_tier ?? 'Rookie'}
                  </Text>
                </View>
              </View>
            </View>
            <TouchableOpacity
              style={styles.searchBtn}
              onPress={() => router.push('/challenge/search')}
            >
              <Search size={18} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {(profile as any)?.repcoins ?? 100}
              </Text>
              <Text style={styles.statLabel}>RepCoins</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {profile?.wins ?? 0}W-{profile?.losses ?? 0}L
              </Text>
              <Text style={styles.statLabel}>Record</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <Text style={styles.statValue}>
                {(profile as any)?.elo ?? 1000}
              </Text>
              <Text style={styles.statLabel}>ELO</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBlock}>
              <StreakIcon profile={profile} />
              <Text style={styles.statValue}>
                {profile?.current_streak ?? 0}
              </Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {!wagersUnlocked && (
        <View style={styles.casualProgressCard}>
          <View style={styles.casualProgressHeader}>
            <Lock size={14} color={colors.accent} />
            <Text style={styles.casualProgressTitle}>Unlock Wager Matches</Text>
          </View>
          <Text style={styles.casualProgressSub}>
            {casualMatchCount}/{CASUAL_MATCHES_TO_UNLOCK} casual matches completed
          </Text>
          <View style={styles.casualProgressBar}>
            <View
              style={[
                styles.casualProgressFill,
                {
                  width: `${Math.min((casualMatchCount / CASUAL_MATCHES_TO_UNLOCK) * 100, 100)}%`,
                },
              ]}
            />
          </View>
        </View>
      )}

      {activeMatches.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ACTIVE MATCHES</Text>
          <View style={styles.list}>
            {activeMatches.map((m) => (
              <AsyncMatchCard
                key={m.id}
                match={m}
                myUserId={session?.user?.id ?? ''}
                onPress={() =>
                  router.push({
                    pathname: '/match/[id]',
                    params: { id: m.id },
                  })
                }
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
          <Text
            style={[
              styles.tabBtnText,
              tab === 'open' && styles.tabBtnTextActive,
            ]}
          >
            Open Challenges
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          onPress={() => setTab('mine')}
        >
          <Text
            style={[
              styles.tabBtnText,
              tab === 'mine' && styles.tabBtnTextActive,
            ]}
          >
            My History
          </Text>
        </TouchableOpacity>
      </View>

      {tab === 'open' && (
        <View style={styles.section}>
          {openChallenges.length === 0 ? (
            <View style={styles.empty}>
              <Zap size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No open challenges</Text>
              <Text style={styles.emptySubtitle}>
                Be the first — create a challenge!
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/challenge/create')}
              >
                <Text style={styles.emptyBtnText}>Create Challenge</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {openChallenges.map((m) => {
                const challenger = m.profiles;
                return (
                  <View key={m.id} style={styles.openChallengeCard}>
                    <View style={styles.openChallengeTop}>
                      <View>
                        <Text style={styles.openChallengeName}>
                          @{challenger?.username ?? '???'}
                        </Text>
                        {challenger?.rank_tier && (
                          <Text
                            style={[
                              styles.openChallengeRank,
                              {
                                color:
                                  (RANK_TIER_COLORS as Record<string, string>)[
                                    challenger.rank_tier
                                  ] ?? colors.textMuted,
                              },
                            ]}
                          >
                            {challenger.rank_tier}
                          </Text>
                        )}
                      </View>
                      <View style={styles.openChallengeWager}>
                        <Text style={styles.openChallengeWagerAmount}>
                          {m.wager_amount} RC
                        </Text>
                        <Text style={styles.openChallengeWagerLabel}>
                          wager
                        </Text>
                      </View>
                    </View>

                    <TouchableOpacity
                      style={[
                        styles.acceptBtn,
                        accepting === m.id && styles.acceptBtnLoading,
                      ]}
                      onPress={() => handleAccept(m)}
                      disabled={accepting === m.id}
                    >
                      <Text style={styles.acceptBtnText}>
                        {accepting === m.id
                          ? 'Accepting...'
                          : `Accept — ${m.wager_amount} RC`}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}
        </View>
      )}

      {tab === 'mine' && (
        <View style={styles.section}>
          {pastMatches.length === 0 ? (
            <View style={styles.empty}>
              <Trophy size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>No matches yet</Text>
              <Text style={styles.emptySubtitle}>
                Accept or create a challenge to start
              </Text>
            </View>
          ) : (
            <View style={styles.list}>
              {pastMatches.map((m) => (
                <AsyncMatchCard
                  key={m.id}
                  match={m}
                  myUserId={session?.user?.id ?? ''}
                  onPress={() =>
                    router.push({
                      pathname: '/theatre/[id]',
                      params: { id: m.id },
                    })
                  }
                />
              ))}
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  casualProgressCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: 6,
  },
  casualProgressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  casualProgressTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.accent,
  },
  casualProgressSub: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  casualProgressBar: {
    height: 5,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  casualProgressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: radius.full,
  },
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
  rankRow: { flexDirection: 'row', marginTop: 4 },
  rankPill: {
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  rankText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    letterSpacing: 1,
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
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
    gap: 3,
  },
  statDivider: { width: 1, backgroundColor: colors.border },
  statValue: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.text,
  },
  statLabel: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  section: { paddingHorizontal: spacing.md, marginTop: spacing.md },
  sectionTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
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
  asyncCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.sm,
  },
  asyncCardUrgent: {
    backgroundColor: 'rgba(255,45,120,0.04)',
  },
  asyncCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  asyncCardLeft: { gap: 3 },
  asyncCardRight: {},
  asyncExerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  asyncExercise: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
  },
  asyncWager: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.accent,
  },
  asyncStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
  },
  asyncStatusText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
  },
  asyncProgressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  asyncPlayerStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  asyncDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  asyncPlayerLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  asyncReps: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.success,
  },
  asyncVs: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.textMuted,
    marginHorizontal: spacing.sm,
  },
  asyncTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  asyncTimerText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  asyncRefundBadge: {
    backgroundColor: 'rgba(0,255,136,0.08)',
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  asyncRefundText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.success,
  },
  openChallengeCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  openChallengeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  openChallengeName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.text,
  },
  openChallengeRank: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    marginTop: 2,
  },
  openChallengeWager: { alignItems: 'flex-end' },
  openChallengeWagerAmount: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.accent,
  },
  openChallengeWagerLabel: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  acceptBtn: {
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
});
