/*
  Leagues Tab Screen (Enhanced)

  Main hub for league discovery, membership, and prestige:
  - My Leagues: Joined leagues with prestige display
  - Discover: Public leagues to join
  - Features: Create league, view detail, playoffs, prestige levels
*/

import { useEffect, useState, useRef } from 'react';
import {
  View,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useLeagueStore } from '@/store/leagueStore';
import {
  getPublicLeagues,
  getUserLeagues,
  getLeaguePrestige,
  type League,
} from '@/services/leagueTournament.service';
import { Trophy, Plus, Sparkles, Crown, Zap } from 'lucide-react-native';

export default function LeaguesTabScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const {
    myLeagues,
    loading,
    fetchMyLeagues,
    setCurrentLeague,
  } = useLeagueStore();

  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingPublic, setLoadingPublic] = useState(false);
  const [prestigeMap, setPrestigeMap] = useState<{ [leagueId: string]: any }>({});

  useEffect(() => {
    if (session?.user?.id) {
      loadData();
    }
  }, [session?.user?.id]);

  const loadData = async () => {
    if (!session?.user?.id) return;
    await fetchMyLeagues(session.user.id);
    await loadPublic();
    await loadPrestige();
  };

  const loadPublic = async () => {
    try {
      setLoadingPublic(true);
      const leagues = await getPublicLeagues({ search: '' });
      setPublicLeagues(leagues.slice(0, 6)); // Show top 6
    } catch (error) {
      console.error('Failed to load public leagues:', error);
    } finally {
      setLoadingPublic(false);
    }
  };

  const loadPrestige = async () => {
    if (!session?.user?.id) return;
    try {
      const prestige: { [key: string]: any } = {};
      for (const league of myLeagues) {
        const p = await getLeaguePrestige(session.user.id, league.id);
        if (p) prestige[league.id] = p;
      }
      setPrestigeMap(prestige);
    } catch (error) {
      console.error('Failed to load prestige:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const handleLeagueTap = (league: League) => {
    setCurrentLeague(league);
    router.push(`/leagues/${league.id}`);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Trophy size={28} color={colors.primary} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Leagues</Text>
              <Text style={styles.subtitle}>
                {myLeagues.length} {myLeagues.length === 1 ? 'league' : 'leagues'}
              </Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.createButton}
            onPress={() => router.push('/leagues/create')}
          >
            <Plus size={20} color={colors.textInverse} />
          </TouchableOpacity>
        </View>

        {/* My Leagues Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Leagues</Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : myLeagues.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyIcon}>🏟️</Text>
              <Text style={styles.emptyTitle}>No Leagues Yet</Text>
              <Text style={styles.emptyText}>
                Create a league or join one to start competing!
              </Text>
              <TouchableOpacity
                style={styles.emptyButton}
                onPress={() => router.push('/leagues/create')}
              >
                <Text style={styles.emptyButtonText}>Create League</Text>
              </TouchableOpacity>
            </View>
          ) : (
            myLeagues.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                prestige={prestigeMap[league.id]}
                onPress={() => handleLeagueTap(league)}
              />
            ))
          )}
        </View>

        {/* Discover Section */}
        <View style={styles.section}>
          <View style={styles.discoverHeader}>
            <Text style={styles.sectionTitle}>Discover</Text>
            <TouchableOpacity
              onPress={() => router.push('/leagues/discover')}
            >
              <Text style={styles.seeAllLink}>See All →</Text>
            </TouchableOpacity>
          </View>

          {loadingPublic ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : publicLeagues.length === 0 ? (
            <Text style={styles.noLeaguesText}>No public leagues available</Text>
          ) : (
            publicLeagues.map((league) => (
              <PublicLeagueCard
                key={league.id}
                league={league}
                onPress={() => handleLeagueTap(league)}
              />
            ))
          )}
        </View>

        {/* Tips Section */}
        <View style={styles.section}>
          <View style={styles.tipsCard}>
            <Sparkles size={20} color={colors.primary} />
            <View style={styles.tipsContent}>
              <Text style={styles.tipsTitle}>Earn Prestige</Text>
              <Text style={styles.tipsText}>
                Complete league matches to level up and unlock exclusive badges!
              </Text>
            </View>
          </View>
        </View>

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

function LeagueCard({
  league,
  prestige,
  onPress,
}: {
  league: League;
  prestige?: any;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.myLeagueCard} onPress={onPress}>
      <View style={styles.leagueCardHeader}>
        <View style={styles.leagueCardInfo}>
          <View style={styles.leagueNameRow}>
            <Text style={styles.leagueName}>{league.name}</Text>
            {prestige?.level && prestige.level >= 3 && (
              <Crown size={16} color={colors.accent} />
            )}
          </View>

          <View style={styles.leagueMetaRow}>
            <View style={styles.focusTypeBadge}>
              <Text style={styles.focusTypeText}>{league.focus_type}</Text>
            </View>

            {prestige && (
              <View style={styles.prestigeBadge}>
                <Zap size={12} color={colors.primary} />
                <Text style={styles.prestigeText}>Lvl {prestige.level}</Text>
              </View>
            )}

            {league.privacy === 'private' && (
              <Text style={styles.privateBadgeText}>🔒</Text>
            )}
          </View>
        </View>
      </View>

      <View style={styles.leagueCardFooter}>
        <Text style={styles.leagueCardMeta}>
          {league.member_count || 0} / {league.max_members} members
        </Text>
        <Text style={styles.arrowIcon}>→</Text>
      </View>
    </TouchableOpacity>
  );
}

function PublicLeagueCard({
  league,
  onPress,
}: {
  league: League;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.publicLeagueCard} onPress={onPress}>
      <View>
        <Text style={styles.publicLeagueName}>{league.name}</Text>
        <Text style={styles.publicLeagueType}>{league.focus_type}</Text>
      </View>
      <Text style={styles.joinArrow}>→</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: {
    gap: spacing.xs,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
  },
  subtitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  createButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  discoverHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  seeAllLink: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.primary,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: spacing.lg,
  },
  emptyCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  emptyText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  emptyButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.textInverse,
  },
  myLeagueCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  leagueCardHeader: {
    marginBottom: spacing.md,
  },
  leagueCardInfo: {
    flex: 1,
  },
  leagueNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  leagueName: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  leagueMetaRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  focusTypeBadge: {
    backgroundColor: colors.primary + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  focusTypeText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.primary,
    fontWeight: '600',
  },
  prestigeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent + '20',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  prestigeText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.accent,
    fontWeight: '600',
  },
  privateBadgeText: {
    fontSize: 12,
  },
  leagueCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  leagueCardMeta: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  arrowIcon: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },
  publicLeagueCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  publicLeagueName: {
    fontFamily: typography.fontDisplay,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  publicLeagueType: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  joinArrow: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.primary,
  },
  noLeaguesText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.md,
  },
  tipsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.primary + '40',
  },
  tipsContent: {
    flex: 1,
    gap: spacing.xs,
  },
  tipsTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  tipsText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
});
