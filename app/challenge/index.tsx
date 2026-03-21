import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { getOpenChallenges } from '@/services/match.service';
import { ChallengeCard } from '@/components/ui/ChallengeCard';
import { MatchTypeBadge } from '@/components/ui/MatchTypeBadge';
import { ELODiffBadge } from '@/components/ui/ELODiffBadge';
import { BarlowText } from '@/components/ui/BarlowText';
import { ChevronLeft, SlidersHorizontal } from 'lucide-react-native';
import type { Match, MatchMode } from '@/types/database';
import { RANK_TIER_COLORS } from '@/types/database';

function resolveMatchMode(m: Match): MatchMode {
  if (m.match_mode) return m.match_mode;
  return (m.wager_amount ?? 0) === 0 ? 'casual' : 'wager';
}

type SortKey = 'newest' | 'wager_high' | 'wager_low';
type FilterMode = 'all' | 'casual' | 'wager';

export default function ChallengeFindScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const [rows, setRows] = useState<(Match & { profiles: any })[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [sort, setSort] = useState<SortKey>('newest');
  const [filter, setFilter] = useState<FilterMode>('all');

  const load = useCallback(async () => {
    if (!session?.user) return;
    try {
      const data = await getOpenChallenges(session.user.id, 50);
      setRows(data);
    } catch {
      setRows([]);
    }
  }, [session?.user?.id]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, [load]);

  const filtered = useMemo(() => {
    let list = [...rows];
    if (filter === 'casual') list = list.filter((m) => resolveMatchMode(m) === 'casual');
    if (filter === 'wager') list = list.filter((m) => resolveMatchMode(m) === 'wager');
    list.sort((a, b) => {
      if (sort === 'newest') {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sort === 'wager_high') return (b.wager_amount ?? 0) - (a.wager_amount ?? 0);
      return (a.wager_amount ?? 0) - (b.wager_amount ?? 0);
    });
    return list;
  }, [rows, sort, filter]);

  const myElo = (profile as any)?.elo ?? 1000;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <BarlowText variant="displayMedium" style={styles.title}>
          Find a match
        </BarlowText>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.toolbar}>
        <SlidersHorizontal size={16} color={colors.textMuted} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(['all', 'casual', 'wager'] as const).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.chip, filter === f && styles.chipActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.chipText, filter === f && styles.chipTextActive]}>
                {f === 'all' ? 'All' : f === 'casual' ? 'Casual' : 'Wager'}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <View style={styles.sortRow}>
        <Text style={styles.sortLabel}>Sort</Text>
        {(['newest', 'wager_high', 'wager_low'] as const).map((s) => (
          <TouchableOpacity key={s} style={[styles.sortChip, sort === s && styles.sortChipActive]} onPress={() => setSort(s)}>
            <Text style={[styles.sortChipText, sort === s && styles.sortChipTextActive]}>
              {s === 'newest' ? 'Newest' : s === 'wager_high' ? 'Pot ↑' : 'Pot ↓'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
      >
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>No matches match filters</Text>
            <Text style={styles.emptySub}>Create your own or widen filters.</Text>
          </View>
        ) : (
          filtered.map((m) => {
            const challenger = m.profiles;
            const theirElo = challenger?.elo ?? 1000;
            const mode = resolveMatchMode(m);
            const accent = mode === 'casual' ? colors.primary : colors.accent;
            return (
              <ChallengeCard
                key={m.id}
                accentColor={accent}
                onPress={() => router.push(`/challenge/${m.id}` as any)}
              >
                <View style={styles.cardTop}>
                  <View style={styles.meta}>
                    <View style={styles.badgeRow}>
                      <MatchTypeBadge mode={mode} />
                      <ELODiffBadge myElo={myElo} theirElo={theirElo} />
                    </View>
                    <Text style={styles.name}>@{challenger?.username ?? '???'}</Text>
                    {challenger?.rank_tier && (
                      <Text
                        style={[
                          styles.rank,
                          {
                            color:
                              (RANK_TIER_COLORS as Record<string, string>)[challenger.rank_tier] ??
                              colors.textMuted,
                          },
                        ]}
                      >
                        {challenger.rank_tier}
                      </Text>
                    )}
                  </View>
                  <View style={styles.pot}>
                    <Text style={[styles.potAmt, { color: accent }]}>
                      {mode === 'casual' ? '0 RC' : `${m.wager_amount} RC`}
                    </Text>
                  </View>
                </View>
              </ChallengeCard>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { width: 40 },
  title: { fontSize: 18, color: colors.text },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  chips: { gap: spacing.sm, paddingVertical: 4 },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: 'rgba(0,196,212,0.1)' },
  chipText: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textMuted },
  chipTextActive: { color: colors.primary, fontFamily: typography.fontBodyBold },
  sortRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sortLabel: { fontFamily: typography.fontBodyBold, fontSize: 11, color: colors.textMuted, width: 36 },
  sortChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sortChipActive: { borderColor: colors.secondary },
  sortChipText: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
  sortChipTextActive: { color: colors.secondary },
  scroll: { paddingHorizontal: spacing.md, paddingBottom: 120, gap: spacing.sm },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between' },
  meta: { flex: 1, gap: 4 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  name: { fontFamily: typography.fontBodyBold, fontSize: 15, color: colors.text },
  rank: { fontFamily: typography.fontBodyMedium, fontSize: 12 },
  pot: { alignItems: 'flex-end' },
  potAmt: { fontFamily: typography.fontDisplay, fontSize: 18 },
  empty: { paddingVertical: spacing.xxl, alignItems: 'center' },
  emptyTitle: { fontFamily: typography.fontBodyBold, fontSize: 16, color: colors.text },
  emptySub: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textMuted, marginTop: 4 },
});
