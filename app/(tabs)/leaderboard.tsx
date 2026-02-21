import { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { getCompetitiveLeaderboard, getCasualLeaderboard } from '@/services/profile.service';
import { useAuthStore } from '@/stores/authStore';
import Avatar from '@/components/Avatar';
import { Trophy, Zap, Star, Flame } from 'lucide-react-native';
import { getLevelInfo } from '@/lib/levelSystem';
import type { Level } from '@/lib/levelSystem';

interface LeaderRow {
  rank: number;
  user_id: string;
  username: string;
  display_name: string;
  current_level: Level;
  total_xp: number;
  wins: number;
  losses: number;
  total_reps: number;
  avatar_gender: 'male' | 'female';
  avatar_head: string;
  avatar_torso: string;
  avatar_legs: string;
}

type LeaderboardMode = 'competitive' | 'casual';

const RANK_COLORS = ['#FFB800', '#C0C0C0', '#CD7F32'];
const RANK_ICONS = ['🥇', '🥈', '🥉'];

function LeaderRow({ item, isMe }: { item: LeaderRow; isMe: boolean }) {
  const winRate = item.wins + item.losses > 0 ? Math.round((item.wins / (item.wins + item.losses)) * 100) : 0;
  const levelInfo = getLevelInfo(item.current_level);

  return (
    <View style={[styles.row, isMe && styles.rowHighlight, item.rank <= 3 && styles.rowTop]}>
      <View style={styles.rankBox}>
        {item.rank <= 3 ? (
          <Text style={styles.rankEmoji}>{RANK_ICONS[item.rank - 1]}</Text>
        ) : (
          <Text style={[styles.rankNum, isMe && styles.rankNumMe]}>#{item.rank}</Text>
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
        <View style={styles.nameRow}>
          <Text style={[styles.displayName, isMe && styles.displayNameMe]}>{item.display_name}</Text>
          <View style={[styles.levelBadge, { backgroundColor: levelInfo.color }]}>
            <Text style={styles.levelBadgeText}>Lvl {item.current_level}</Text>
          </View>
        </View>
        <Text style={styles.handle}>@{item.username}</Text>
      </View>
      <View style={styles.statsBlock}>
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
  const [mode, setMode] = useState<LeaderboardMode>('competitive');
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  async function load(selectedMode: LeaderboardMode) {
    try {
      setIsLoading(true);
      const data = selectedMode === 'competitive'
        ? await getCompetitiveLeaderboard(50)
        : await getCasualLeaderboard(50);
      setLeaders(data as LeaderRow[]);
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    load(mode);
  }, [mode]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load(mode);
    setRefreshing(false);
  }, [mode]);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Trophy size={22} color={colors.accent} />
        <Text style={styles.headerTitle}>LEADERBOARD</Text>
      </View>

      {/* Mode toggle */}
      <View style={styles.modeToggle}>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'competitive' && styles.modeButtonActive]}
          onPress={() => setMode('competitive')}
        >
          <Flame size={14} color={mode === 'competitive' ? colors.text : colors.textMuted} />
          <Text style={[styles.modeButtonText, mode === 'competitive' && styles.modeButtonTextActive]}>
            COMPETITIVE
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeButton, mode === 'casual' && styles.modeButtonActive]}
          onPress={() => setMode('casual')}
        >
          <Zap size={14} color={mode === 'casual' ? colors.text : colors.textMuted} />
          <Text style={[styles.modeButtonText, mode === 'casual' && styles.modeButtonTextActive]}>
            CASUAL
          </Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={leaders}
        keyExtractor={(item) => `${item.user_id}-${item.rank}`}
        renderItem={({ item }) => (
          <LeaderRow
            item={item}
            isMe={item.user_id === session?.user?.id}
          />
        )}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Trophy size={40} color={colors.textMuted} />
            <Text style={styles.emptyText}>No players yet. Be the first!</Text>
          </View>
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
  modeToggle: {
    flexDirection: 'row',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.bgHighlight,
  },
  modeButtonActive: {
    backgroundColor: colors.primary,
  },
  modeButtonText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  modeButtonTextActive: {
    color: colors.text,
  },
  list: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, paddingBottom: 80 },
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
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  displayName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  displayNameMe: { color: colors.primary },
  levelBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  levelBadgeText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textInverse,
    fontWeight: '600',
  },
  handle: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  statsBlock: { alignItems: 'flex-end', gap: 3 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  xp: { fontFamily: typography.fontBodyMedium, fontSize: 13, color: colors.accent },
  winRate: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.sm,
  },
  emptyText: { fontFamily: typography.fontBody, fontSize: 15, color: colors.textMuted },
});
