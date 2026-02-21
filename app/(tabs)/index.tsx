import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { getUserMatches, getOpenChallenges, acceptMatch } from '@/services/match.service';
import { useToastStore } from '@/stores/toastStore';
import MatchCard from '@/components/MatchCard';
import Avatar from '@/components/Avatar';
import { Plus, Zap, DollarSign, Flame, Target, Trophy, Bell } from 'lucide-react-native';
import type { Match } from '@/types/database';

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
        getUserMatches(session.user.id),
        getOpenChallenges(),
      ]);
      setMyMatches(mine);
      setOpenChallenges(open.filter((m: any) => m.challenger_id !== session.user.id));
    } catch {}
  }

  useEffect(() => { load(); }, []);

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

  // Categorize active matches by async submission state
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

  return (
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
              <Text style={styles.statValue}>{profile?.current_streak ?? 0}</Text>
              <Text style={styles.statLabel}>Streak</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

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
