import { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, FlatList, RefreshControl, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  getPublicLeagues,
  getLeagueMembers,
  getUserLeagueRank,
  joinLeague,
  subscribeToLeagueMembers,
  type League,
  type LeagueMemb,
} from '@/services/league.service';
import Avatar from '@/components/Avatar';
import { Trophy, Medal, TrendingUp, Zap } from 'lucide-react-native';

export default function LeaguesScreen() {
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [leagues, setLeagues] = useState<League[]>([]);
  const [selectedLeague, setSelectedLeague] = useState<League | null>(null);
  const [members, setMembers] = useState<LeagueMemb[]>([]);
  const [userRank, setUserRank] = useState<{ rank: number; points: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const subscriptionRef = useRef<any>(null);

  async function loadLeagues() {
    try {
      const data = await getPublicLeagues();
      setLeagues(data);
      if (data.length > 0) {
        await loadLeagueDetails(data[0]);
      }
    } catch (err) {
      console.error('[leagues] loadLeagues error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  async function loadLeagueDetails(league: League) {
    try {
      setSelectedLeague(league);

      // Load members
      const memberData = await getLeagueMembers(league.id);
      setMembers(memberData);

      // Load user's rank
      if (session?.user) {
        const rank = await getUserLeagueRank(session.user.id, league.id);
        setUserRank(rank);
      }

      // Subscribe to realtime updates
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
      subscriptionRef.current = subscribeToLeagueMembers(league.id, (updated) => {
        setMembers(updated);
      });
    } catch (err) {
      console.error('[leagues] loadLeagueDetails error:', err);
    }
  }

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (selectedLeague) {
      await loadLeagueDetails(selectedLeague);
    }
  }, [selectedLeague]);

  async function handleJoinLeague() {
    if (!session?.user || !selectedLeague) return;
    setJoining(true);
    try {
      await joinLeague(session.user.id, selectedLeague.id);
      showToast({ type: 'success', title: 'Joined league!', message: 'Welcome to the competition.' });
      await loadLeagueDetails(selectedLeague);
    } catch (err) {
      showToast({ type: 'error', title: 'Failed to join', message: (err as Error).message });
    } finally {
      setJoining(false);
    }
  }

  useEffect(() => {
    loadLeagues();
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  if (loading) {
    return (
      <View style={[styles.container, styles.centerContent]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const isMember = userRank !== null;
  const top3 = members.slice(0, 3);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Trophy size={28} color={colors.primary} />
          <Text style={styles.headerTitle}>Leagues</Text>
        </View>

        {/* LEAGUES LIST */}
        {leagues.length > 0 ? (
          <>
            <View style={styles.leaguesList}>
              {leagues.map((league) => (
                <TouchableOpacity
                  key={league.id}
                  style={[
                    styles.leagueCard,
                    selectedLeague?.id === league.id && styles.leagueCardActive,
                  ]}
                  onPress={() => loadLeagueDetails(league)}
                >
                  <View style={styles.leagueCardContent}>
                    <Text style={styles.leagueName}>{league.name}</Text>
                    <Text style={styles.leagueType}>{league.type === 'PUBLIC' ? 'Public' : 'Private'}</Text>
                  </View>
                  {isMember && userRank && (
                    <View style={styles.userRankBadge}>
                      <Text style={styles.userRankText}>#{userRank.rank}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {selectedLeague && (
              <>
                {/* SEASON INFO */}
                <View style={styles.seasonCard}>
                  <Zap size={16} color={colors.accent} />
                  <Text style={styles.seasonText}>Season: {selectedLeague.season}</Text>
                </View>

                {/* REWARDS */}
                <Text style={styles.sectionTitle}>Top Rewards</Text>
                <View style={styles.rewardsRow}>
                  {[
                    { rank: 1, emoji: '🥇', xp: 'Gold Badge' },
                    { rank: 2, emoji: '🥈', xp: '+500 XP' },
                    { rank: 3, emoji: '🥉', xp: '+250 XP' },
                  ].map((reward) => (
                    <View key={reward.rank} style={styles.rewardCard}>
                      <Text style={styles.rewardEmoji}>{reward.emoji}</Text>
                      <Text style={styles.rewardLabel}>#{reward.rank}</Text>
                      <Text style={styles.rewardAmount}>{reward.xp}</Text>
                    </View>
                  ))}
                </View>

                {/* USER STATUS */}
                {isMember ? (
                  <View style={styles.memberCard}>
                    <View style={styles.memberRow}>
                      <Text style={styles.memberLabel}>Your Rank</Text>
                      <Text style={styles.memberValue}>#{userRank?.rank}</Text>
                    </View>
                    <View style={styles.memberRow}>
                      <Text style={styles.memberLabel}>Points</Text>
                      <Text style={styles.memberValue}>{userRank?.points}</Text>
                    </View>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={handleJoinLeague}
                    disabled={joining}
                  >
                    {joining ? (
                      <ActivityIndicator size="small" color={colors.textInverse} />
                    ) : (
                      <Text style={styles.joinBtnText}>JOIN LEAGUE</Text>
                    )}
                  </TouchableOpacity>
                )}

                {/* LEADERBOARD */}
                <Text style={styles.sectionTitle}>Leaderboard</Text>
                <View style={styles.leaderboardCard}>
                  <FlatList
                    data={members}
                    keyExtractor={(item) => item.id}
                    scrollEnabled={false}
                    renderItem={({ item, index }) => (
                      <View
                        style={[
                          styles.rankRow,
                          index < members.length - 1 && styles.rankRowBorder,
                          item.user_id === session?.user?.id && styles.rankRowActive,
                        ]}
                      >
                        <View style={styles.rankLeft}>
                          <Text style={styles.rankNumber}>#{item.rank}</Text>
                          {item.rank <= 3 && (
                            <Text style={styles.rankMedal}>
                              {item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉'}
                            </Text>
                          )}
                        </View>
                        <View style={styles.rankCenter}>
                          <Text style={styles.rankName}>{item.profile?.display_name || 'Unknown'}</Text>
                        </View>
                        <Text style={styles.rankPoints}>{item.points} pts</Text>
                      </View>
                    )}
                  />
                </View>
              </>
            )}
          </>
        ) : (
          <View style={styles.emptyState}>
            <Trophy size={48} color={colors.primary} />
            <Text style={styles.emptyTitle}>No Leagues Yet</Text>
            <Text style={styles.emptyText}>Check back soon for seasonal competitions.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scrollContent: { paddingHorizontal: spacing.md, paddingBottom: 80 },
  centerContent: { justifyContent: 'center', alignItems: 'center' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginVertical: spacing.md,
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    color: colors.text,
  },

  leaguesList: { gap: spacing.sm, marginBottom: spacing.lg },
  leagueCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueCardActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '15',
  },
  leagueCardContent: { flex: 1 },
  leagueName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.text,
  },
  leagueType: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
  userRankBadge: {
    backgroundColor: colors.primary,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  userRankText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.textInverse,
  },

  seasonCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seasonText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.text,
  },

  sectionTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.text,
    marginBottom: spacing.md,
    marginTop: spacing.lg,
  },

  rewardsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  rewardCard: {
    flex: 1,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rewardEmoji: { fontSize: 28 },
  rewardLabel: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.textSecondary,
  },
  rewardAmount: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },

  memberCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberLabel: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  memberValue: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.primary,
  },

  joinBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  joinBtnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textInverse,
    letterSpacing: 2,
  },

  leaderboardCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
  },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  rankRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rankRowActive: {
    backgroundColor: colors.primary + '10',
  },
  rankLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minWidth: 50,
  },
  rankNumber: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  rankMedal: {
    fontSize: 16,
  },
  rankCenter: {
    flex: 1,
    marginLeft: spacing.md,
  },
  rankName: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  rankPoints: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.accent,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: spacing.xxl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.text,
  },
  emptyText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
