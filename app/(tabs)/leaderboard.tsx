import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { getLeaderboard } from '@/services/profile.service';
import { useAuthStore } from '@/stores/authStore';
import Avatar from '@/components/Avatar';
import EmptyState from '@/components/EmptyState';
import { Trophy, Star } from 'lucide-react-native';

interface LeaderRow {
  id: string;
  username: string;
  display_name: string;
  wins: number;
  losses: number;
  total_reps: number;
  total_xp: number;
  avatar_gender: 'male' | 'female';
  avatar_head: string;
  avatar_torso: string;
  avatar_legs: string;
  elo?: number;
  rank_tier?: string;
}

const RANK_COLORS = ['#FFB800', '#C0C0C0', '#CD7F32'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

function LeaderRow({ item, rank, isMe }: { item: LeaderRow; rank: number; isMe: boolean }) {
  const winRate = item.wins + item.losses > 0 ? Math.round((item.wins / (item.wins + item.losses)) * 100) : 0;
  return (
    <View style={[styles.row, isMe && styles.rowHighlight, rank <= 3 && styles.rowTop]}>
      <View style={styles.rankBox}>
        {rank <= 3 ? (
          <Text style={styles.rankEmoji}>{RANK_ICONS[rank - 1]}</Text>
        ) : (
          <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>#{rank}</Text>
        )}
      </View>
      <Avatar
        gender={item.avatar_gender}
        head={item.avatar_head}
        torso={item.avatar_torso}
        legs={item.avatar_legs}
        size={44}
      />
      <View style={styles.nameBlock}>
        <Text style={[styles.displayName, isMe && styles.displayNameMe]}>{item.display_name}</Text>
        <Text style={styles.handle}>@{item.username}</Text>
      </View>
      <View style={styles.statsBlock}>
        <Text style={styles.elo}>{(item.elo ?? 1000).toLocaleString()} ELO</Text>
        <View style={styles.xpRow}>
          <Star size={12} color={colors.accent} />
          <Text style={styles.xp}>{item.total_xp.toLocaleString()} XP</Text>
        </View>
        <Text style={styles.winRate}>{winRate}% WR</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [leaders, setLeaders] = useState<LeaderRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    try {
      const data = await getLeaderboard(50);
      setLeaders(data as LeaderRow[]);
    } catch {}
  }

  useEffect(() => { load(); }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Trophy size={22} color={colors.accent} />
        <Text style={styles.headerTitle}>LEADERBOARD</Text>
      </View>
      <View style={styles.gogginsBanner}>
        <Text style={styles.gogginsBannerText}>{'GOGGINS unlocks when >=100 active users and top 1% meet 2200+ ELO.'}</Text>
      </View>

      <FlatList
        data={leaders}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <LeaderRow
            item={item}
            rank={index + 1}
            isMe={item.id === session?.user?.id}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={<Trophy size={52} color={colors.textMuted} strokeWidth={1} />}
            title="No competitors yet"
            subtitle="The leaderboard awakens when brave souls dare to compete. Be the first to claim your rank."
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 3,
  },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: 80 },
  gogginsBanner: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,184,0,0.08)',
  },
  gogginsBannerText: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    marginBottom: spacing.xs,
  },
  rowHighlight: {
    backgroundColor: 'rgba(0,212,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.2)',
  },
  rowTop: {
    backgroundColor: 'rgba(255,184,0,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,184,0,0.15)',
  },
  rankBox: { width: 32, alignItems: 'center' },
  rankEmoji: { fontSize: 20 },
  rankNum: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  rankNumMe: { color: colors.primary },
  nameBlock: { flex: 1 },
  displayName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  displayNameMe: { color: colors.primary },
  handle: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  statsBlock: { alignItems: 'flex-end', gap: 3 },
  elo: { fontFamily: typography.fontDisplayMedium, fontSize: 12, color: colors.primary },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp: { fontFamily: typography.fontBodyMedium, fontSize: 13, color: colors.accent },
  winRate: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
});
