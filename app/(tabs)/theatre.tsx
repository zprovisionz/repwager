import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '@/stores/authStore';
import { theatreService, type TheatreFilter } from '@/services/theatre.service';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Avatar from '@/components/Avatar';
import { Trophy, Skull, Zap, Play, DollarSign, Clock } from 'lucide-react-native';
import type { TheatreMatch } from '@/types/theatre';
import { EXERCISE_LABELS } from '@/lib/config';

const FILTERS: { key: TheatreFilter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'wins', label: 'Wins' },
  { key: 'losses', label: 'Losses' },
  { key: 'push_ups', label: 'Push-up' },
  { key: 'squats', label: 'Squat' },
  { key: 'disputed', label: 'Disputed' },
];

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function OutcomeIcon({ outcome }: { outcome: 'win' | 'loss' | 'disputed' }) {
  if (outcome === 'win') return <Trophy size={16} color={colors.accent} />;
  if (outcome === 'loss') return <Skull size={16} color={colors.secondary} />;
  return <Zap size={16} color={colors.warning} />;
}

function outcomeColor(outcome: 'win' | 'loss' | 'disputed'): string {
  if (outcome === 'win') return colors.accent;
  if (outcome === 'loss') return colors.secondary;
  return colors.warning;
}

function TheatreMatchCard({ match, onPress }: { match: TheatreMatch; onPress: () => void }) {
  const borderColor = outcomeColor(match.outcome);
  return (
    <View style={[styles.card, { borderLeftColor: borderColor }]}>
      <View style={styles.cardTop}>
        {/* Opponent info */}
        <View style={styles.opponentRow}>
          {match.opponentAvatar && (
            <Avatar
              gender={match.opponentAvatar.gender}
              head={match.opponentAvatar.head}
              torso={match.opponentAvatar.torso}
              legs={match.opponentAvatar.legs}
              size={36}
            />
          )}
          <View style={styles.opponentInfo}>
            <Text style={styles.opponentName} numberOfLines={1}>
              {match.opponentName}
            </Text>
            <View style={styles.badgeRow}>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{EXERCISE_LABELS[match.exerciseType]}</Text>
              </View>
              <View style={[styles.badge, { borderColor: match.mode === 'competitive' ? colors.secondary : colors.textMuted }]}>
                <Text style={[styles.badgeText, { color: match.mode === 'competitive' ? colors.secondary : colors.textMuted }]}>
                  {match.mode === 'competitive' ? 'Competitive' : 'Casual'}
                </Text>
              </View>
            </View>
          </View>
        </View>

        {/* Outcome badge */}
        <View style={[styles.outcomeBadge, { borderColor, backgroundColor: borderColor + '18' }]}>
          <OutcomeIcon outcome={match.outcome} />
          <Text style={[styles.outcomeText, { color: borderColor }]}>
            {match.outcome === 'win' ? 'WIN' : match.outcome === 'loss' ? 'LOSS' : 'DISPUTED'}
          </Text>
        </View>
      </View>

      <View style={styles.cardMid}>
        {/* Rep scores */}
        <Text style={styles.repScore}>
          You: <Text style={styles.repNum}>{match.myReps}</Text> reps
          {'  '}vs{'  '}
          <Text style={styles.repNum}>{match.opponentReps}</Text> reps
        </Text>

        {/* Wager */}
        {!!match.wagerAmount && (
          <View style={styles.wagerRow}>
            <DollarSign size={12} color={colors.accent} />
            <Text style={styles.wagerText}>{match.wagerAmount.toFixed(2)}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBottom}>
        <View style={styles.timeRow}>
          <Clock size={12} color={colors.textMuted} />
          <Text style={styles.timeText}>{timeAgo(match.matchDate)}</Text>
        </View>
        <TouchableOpacity style={styles.reviewBtn} onPress={onPress} activeOpacity={0.8}>
          <Play size={12} color={colors.bg} fill={colors.bg} />
          <Text style={styles.reviewText}>Review</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function TheatreScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();

  const [filter, setFilter] = useState<TheatreFilter>('all');
  const [matches, setMatches] = useState<TheatreMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!session?.user?.id) return;
    try {
      const data = await theatreService.getCompletedMatches(session.user.id, filter);
      setMatches(data);
    } catch {}
    finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [session?.user?.id, filter]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const handleReview = (id: string) => {
    router.push({ pathname: '/theatre/[id]', params: { id } });
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>THEATRE</Text>
        <Text style={styles.headerSub}>Your match replays</Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            onPress={() => setFilter(f.key)}
            style={[
              styles.chip,
              filter === f.key && styles.chipActive,
            ]}
          >
            <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Match list */}
      {loading ? (
        <View style={styles.center}>
          <Text style={styles.loadingText}>Loading replays...</Text>
        </View>
      ) : matches.length === 0 ? (
        <View style={styles.center}>
          <Play size={48} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>No replays yet</Text>
          <Text style={styles.emptyBody}>Complete a match to review it here.</Text>
        </View>
      ) : (
        <FlatList
          data={matches}
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
          renderItem={({ item }) => (
            <TheatreMatchCard
              match={item}
              onPress={() => handleReview(item.id)}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  header: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 2,
  },
  headerSub: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    marginTop: 2,
  },
  filters: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  chipActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  chipText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textMuted,
  },
  chipTextActive: {
    color: colors.primary,
  },
  list: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.xl,
  },
  loadingText: { fontFamily: typography.fontBody, fontSize: 15, color: colors.textMuted },
  emptyTitle: { fontFamily: typography.fontBodyBold, fontSize: 18, color: colors.text, textAlign: 'center' },
  emptyBody: { fontFamily: typography.fontBody, fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Card styles
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  opponentRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  opponentInfo: { flex: 1, gap: 4 },
  opponentName: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  badgeRow: { flexDirection: 'row', gap: spacing.xs },
  badge: {
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  badgeText: { fontFamily: typography.fontBodyMedium, fontSize: 10, color: colors.primary, letterSpacing: 0.3 },
  outcomeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  outcomeText: { fontFamily: typography.fontBodyBold, fontSize: 11, letterSpacing: 0.5 },
  cardMid: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  repScore: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textSecondary },
  repNum: { fontFamily: typography.fontBodyBold, color: colors.text },
  wagerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wagerText: { fontFamily: typography.fontDisplayMedium, fontSize: 14, color: colors.accent },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timeText: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textMuted },
  reviewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  reviewText: { fontFamily: typography.fontBodyBold, fontSize: 13, color: colors.bg },
});
