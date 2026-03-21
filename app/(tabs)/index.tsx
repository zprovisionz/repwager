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
import { BarlowText } from '@/components/ui/BarlowText';
import { StatStrip } from '@/components/ui/StatStrip';
import { ChallengeCard } from '@/components/ui/ChallengeCard';
import { CountdownTimer } from '@/components/ui/CountdownTimer';
import { MatchTypeBadge } from '@/components/ui/MatchTypeBadge';
import { ELODiffBadge } from '@/components/ui/ELODiffBadge';
import {
  getUserMatches,
  getOpenChallenges,
  buildMatchDisplay,
} from '@/services/match.service';
import { checkStreakStatus } from '@/services/streak.service';
import { useToastStore } from '@/stores/toastStore';
import Avatar from '@/components/Avatar';
import {
  Zap,
  Flame,
  Trophy,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
  Snowflake,
  Lock,
  Bell,
} from 'lucide-react-native';
import { Colors } from '@/constants/theme';
import { acceptMatch } from '@/services/match.service';

const CASUAL_MATCHES_TO_UNLOCK = 10;
import type { Match, MatchMode } from '@/types/database';
import {
  ACTIVE_MATCH_STATUSES,
  TERMINAL_MATCH_STATUSES,
  RANK_TIER_COLORS,
} from '@/types/database';

function resolveMatchMode(m: Match): MatchMode {
  if (m.match_mode) return m.match_mode;
  return (m.wager_amount ?? 0) === 0 ? 'casual' : 'wager';
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
  const mode = resolveMatchMode(match);

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
    <ChallengeCard
      accentColor={isUrgent ? colors.secondary : config.color}
      onPress={onPress}
      urgent={isUrgent}
    >
        <View style={styles.asyncCardTop}>
          <View style={styles.asyncCardLeft}>
            <View style={styles.asyncBadgeRow}>
              <MatchTypeBadge mode={mode} />
            </View>
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

        <CountdownTimer
          deadlineIso={match.submission_deadline}
          visible={ACTIVE_MATCH_STATUSES.includes(match.status)}
        />

        {match.status === 'expired' && (
          <View style={styles.asyncRefundBadge}>
            <Text style={styles.asyncRefundText}>✓ RepCoins refunded</Text>
          </View>
        )}
    </ChallengeCard>
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
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
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

  const handleAcceptOpen = useCallback(
    async (m: Match) => {
      if (!session?.user || !profile) return;
      const repcoins = (profile as any).repcoins ?? 100;
      if (m.wager_amount > 0 && repcoins < m.wager_amount) {
        showToast({
          type: 'error',
          title: 'Insufficient RepCoins',
          message: `Need ${m.wager_amount} RC`,
        });
        return;
      }
      setAcceptingId(m.id);
      try {
        await acceptMatch(m.id, session.user.id);
        showToast({ type: 'success', title: 'Challenge accepted!', message: 'Record your set.' });
        await load();
        router.push({ pathname: '/match/[id]', params: { id: m.id } });
      } catch (e: any) {
        showToast({ type: 'error', title: e.message ?? 'Could not accept' });
      } finally {
        setAcceptingId(null);
      }
    },
    [session?.user, profile, showToast, load, router]
  );

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
        colors={[colors.primary + '14', colors.bg]}
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
              <BarlowText variant="displayMedium" style={styles.greeting}>
                {profile?.display_name?.split(' ')[0] ?? 'Champ'}
              </BarlowText>
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
            <View style={styles.headerActions}>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push('/(tabs)/notifications')}
              >
                <Bell size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.iconBtn}
                onPress={() => router.push('/challenge/search')}
              >
                <Search size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <StatStrip
            items={[
              {
                label: 'RepCoins',
                value: (profile as any)?.repcoins ?? 100,
                valueColor: Colors.accent.amber,
              },
              {
                label: 'Record',
                value: `${profile?.wins ?? 0}W-${profile?.losses ?? 0}L`,
              },
              {
                label: 'ELO',
                value: (profile as any)?.elo ?? 1000,
                valueColor: Colors.accent.cyan,
              },
              {
                label: 'Streak',
                value: profile?.current_streak ?? 0,
                valueColor: Colors.accent.fire,
                adornment: <StreakIcon profile={profile} />,
              },
            ]}
          />
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
          <BarlowText variant="label" color={colors.textMuted} style={styles.sectionTitle}>
            Active matches
          </BarlowText>
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
          <View style={styles.sectionHeaderRow}>
            <BarlowText variant="label" color={colors.textMuted} style={[styles.sectionTitle, { marginBottom: 0 }]}>
              Feed
            </BarlowText>
            <TouchableOpacity onPress={() => router.push('/challenge' as any)}>
              <Text style={styles.findLinkText}>Find & filter</Text>
            </TouchableOpacity>
          </View>
          {openChallenges.length === 0 ? (
            <View style={styles.emptyDashed}>
              <Zap size={36} color={colors.textMuted} />
              <Text style={styles.emptyTitle}>Post a challenge</Text>
              <Text style={styles.emptySubtitle}>
                No open matches right now — be the first on the board.
              </Text>
              <TouchableOpacity
                style={styles.emptyBtn}
                onPress={() => router.push('/challenge/create')}
              >
                <Text style={styles.emptyBtnText}>Post a Challenge</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.list}>
              {openChallenges.map((m) => {
                const challenger = m.profiles;
                const myElo = (profile as any)?.elo ?? 1000;
                const theirElo = challenger?.elo ?? 1000;
                const mode = resolveMatchMode(m as Match);
                const accent = mode === 'casual' ? colors.primary : colors.accent;
                return (
                  <ChallengeCard
                    key={m.id}
                    accentColor={accent}
                    onPress={() => router.push(`/challenge/${m.id}` as any)}
                  >
                    <View style={styles.openChallengeTop}>
                      <View style={styles.openChallengeMeta}>
                        <View style={styles.openChallengeBadgeRow}>
                          <MatchTypeBadge mode={mode} />
                          <ELODiffBadge myElo={myElo} theirElo={theirElo} />
                        </View>
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
                        <Text style={styles.openTapHint}>Tap for detail</Text>
                        <TouchableOpacity
                          style={[styles.acceptPill, { borderColor: accent }]}
                          disabled={acceptingId === m.id}
                          onPress={() => handleAcceptOpen(m as Match)}
                        >
                          <Text style={[styles.acceptPillText, { color: accent }]}>
                            {acceptingId === m.id ? '…' : 'Accept'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                      <View style={styles.openChallengeWager}>
                        <Text
                          style={[
                            styles.openChallengeWagerAmount,
                            { color: accent },
                          ]}
                        >
                          {mode === 'casual' ? '0 RC' : `${m.wager_amount} RC`}
                        </Text>
                        <Text style={styles.openChallengeWagerLabel}>
                          {mode === 'casual' ? 'casual' : 'wager'}
                        </Text>
                      </View>
                    </View>
                  </ChallengeCard>
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
    fontSize: 22,
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
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
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
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    fontSize: 11,
    letterSpacing: 2,
    marginBottom: spacing.sm,
  },
  findLinkText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.primary,
    letterSpacing: 0.5,
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
  asyncBadgeRow: { marginBottom: 2 },
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
  openChallengeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  openChallengeMeta: { flex: 1, gap: 4 },
  openChallengeBadgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
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
  openTapHint: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    marginTop: 6,
  },
  acceptPill: {
    marginTop: spacing.sm,
    alignSelf: 'flex-start',
    borderWidth: 1.5,
    borderRadius: radius.md,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgElevated,
  },
  acceptPillText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    letterSpacing: 1,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyDashed: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
    marginHorizontal: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
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
