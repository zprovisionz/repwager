import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { getPublicLeagues, getMyLeagues } from '@/services/league.service';
import type { League } from '@/services/league.service';
import { Users, Plus, Globe, Lock, ChevronRight, Zap } from 'lucide-react-native';

const FOCUS_LABEL: Record<string, string> = {
  push_ups: 'Push-Ups',
  squats: 'Squats',
  mixed: 'Mixed',
};

function LeagueCard({ league, onPress }: { league: League; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={styles.card}>
        <View style={styles.cardLeft}>
          <View style={styles.cardIcon}>
            <Zap size={20} color={colors.primary} />
          </View>
          <View style={styles.cardInfo}>
            <Text style={styles.cardName}>{league.name}</Text>
            <View style={styles.cardMeta}>
              <Users size={12} color={colors.textMuted} />
              <Text style={styles.cardMetaText}>{league.member_count} members</Text>
              <View style={styles.focusBadge}>
                <Text style={styles.focusBadgeText}>{FOCUS_LABEL[league.focus]}</Text>
              </View>
              {league.privacy !== 'public' && (
                <Lock size={11} color={colors.textMuted} />
              )}
            </View>
            {league.description && (
              <Text style={styles.cardDesc} numberOfLines={1}>
                {league.description}
              </Text>
            )}
          </View>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </View>
    </TouchableOpacity>
  );
}

export default function LeaguesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useAuthStore();
  const [tab, setTab] = useState<'discover' | 'mine'>('discover');
  const [publicLeagues, setPublicLeagues] = useState<League[]>([]);
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    if (!session?.user) return;
    try {
      const [pub, mine] = await Promise.all([
        getPublicLeagues(),
        getMyLeagues(session.user.id),
      ]);
      setPublicLeagues(pub);
      setMyLeagues(mine);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [session?.user?.id]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [session?.user?.id]);

  const displayed = tab === 'discover' ? publicLeagues : myLeagues;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Users size={20} color={colors.primary} />
          <Text style={styles.headerTitle}>LEAGUES</Text>
        </View>
        <TouchableOpacity
          style={styles.createBtn}
          onPress={() => router.push('/leagues/create')}
        >
          <Plus size={16} color={colors.bg} />
          <Text style={styles.createBtnText}>Create</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.tabRow}>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'discover' && styles.tabBtnActive]}
          onPress={() => setTab('discover')}
        >
          <Globe size={14} color={tab === 'discover' ? colors.bg : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'discover' && styles.tabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabBtn, tab === 'mine' && styles.tabBtnActive]}
          onPress={() => setTab('mine')}
        >
          <Users size={14} color={tab === 'mine' ? colors.bg : colors.textMuted} />
          <Text style={[styles.tabText, tab === 'mine' && styles.tabTextActive]}>
            My Leagues
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        {!loading && displayed.length === 0 ? (
          <View style={styles.empty}>
            <Users size={48} color={colors.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>
              {tab === 'discover' ? 'No public leagues yet' : 'You haven\'t joined any leagues'}
            </Text>
            <Text style={styles.emptySubtitle}>
              {tab === 'discover'
                ? 'Be the first to create a league!'
                : 'Join a league from Discover or create your own.'}
            </Text>
            <TouchableOpacity
              style={styles.emptyBtn}
              onPress={() =>
                tab === 'discover' ? router.push('/leagues/create') : setTab('discover')
              }
            >
              <Text style={styles.emptyBtnText}>
                {tab === 'discover' ? 'Create League' : 'Browse Leagues'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.list}>
            {displayed.map((league) => (
              <LeagueCard
                key={league.id}
                league={league}
                onPress={() =>
                  router.push({ pathname: '/leagues/[id]', params: { id: league.id } })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 3,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  createBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.bg,
  },
  tabRow: {
    flexDirection: 'row',
    margin: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    paddingVertical: spacing.sm - 2,
    borderRadius: radius.md,
  },
  tabBtnActive: { backgroundColor: colors.primary },
  tabText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  tabTextActive: { color: colors.bg },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: 80,
  },
  list: { gap: spacing.sm },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary + '1A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  cardInfo: { flex: 1, gap: 4 },
  cardName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.text,
  },
  cardMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  cardMetaText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  focusBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  focusBadgeText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textSecondary,
  },
  cardDesc: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 17,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  emptyBtn: {
    marginTop: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
  },
  emptyBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.bg,
  },
});
