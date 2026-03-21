import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Film, Trophy, Zap, Eye } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuthStore } from '@/stores/authStore';
import { getUserMatches, getPublicTheatreFeed } from '@/services/match.service';
import { playerAnonLabel } from '@/lib/theatreAnon';
import { getProfile } from '@/services/profile.service';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'expo-router';
import type { Match, Profile } from '@/types/database';
import { EXERCISE_LABELS } from '@/lib/config';

interface MatchWithProfiles {
  match: Match;
  challenger: Profile | null;
  opponent: Profile | null;
}

function MatchCard({
  item,
  myUserId,
  onPress,
  anon = false,
}: {
  item: MatchWithProfiles;
  myUserId: string;
  onPress: () => void;
  /** Discover feed: anonymize handles */
  anon?: boolean;
}) {
  const { match, challenger, opponent } = item;
  const iAmChallenger = match.challenger_id === myUserId;
  const myReps = iAmChallenger ? match.challenger_reps : match.opponent_reps;
  const theirReps = iAmChallenger ? match.opponent_reps : match.challenger_reps;
  const repDelta = myReps - theirReps;
  const iWon = match.winner_id === myUserId;
  const other = iAmChallenger ? opponent : challenger;
  const vsLabel =
    anon && challenger
      ? `${playerAnonLabel(match.challenger_id)} vs ${
          match.opponent_id ? playerAnonLabel(match.opponent_id) : '…'
        }`
      : `vs @${other?.username ?? '???'}`;

  const hasVideos =
    match.challenger_video_path || match.opponent_video_path;

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
      <View style={[styles.card, iWon && styles.cardWon]}>
        <View style={styles.cardTop}>
          <View style={styles.cardLeft}>
            <Text style={styles.matchId}>#{match.id.slice(-6).toUpperCase()}</Text>
            <Text style={styles.exercise}>
              {EXERCISE_LABELS[match.exercise_type]}
            </Text>
            <Text style={styles.opponent}>{vsLabel}</Text>
          </View>

          <View style={styles.cardRight}>
            {iWon ? (
              <View style={styles.winBadge}>
                <Trophy size={12} color={colors.accent} />
                <Text style={styles.winText}>WIN</Text>
              </View>
            ) : match.winner_id ? (
              <View style={styles.lossBadge}>
                <Text style={styles.lossText}>LOSS</Text>
              </View>
            ) : (
              <View style={styles.drawBadge}>
                <Text style={styles.drawText}>DRAW</Text>
              </View>
            )}

            <Text style={styles.wager}>{Math.round(match.wager_amount)} RC</Text>
          </View>
        </View>

        <View style={styles.cardBottom}>
          <View style={styles.scoreRow}>
            <View style={styles.scoreBlock}>
              <Text style={[styles.scoreNum, { color: iWon ? colors.success : colors.text }]}>
                {myReps}
              </Text>
              <Text style={styles.scoreSub}>Your reps</Text>
            </View>
            <View style={styles.scoreBlock}>
              <Text
                style={[
                  styles.deltaBadge,
                  repDelta > 0
                    ? styles.deltaPos
                    : repDelta < 0
                    ? styles.deltaNeg
                    : styles.deltaZero,
                ]}
              >
                {repDelta > 0 ? `+${repDelta}` : repDelta}
              </Text>
            </View>
            <View style={styles.scoreBlock}>
              <Text style={styles.scoreNum}>{theirReps}</Text>
              <Text style={styles.scoreSub}>Their reps</Text>
            </View>
          </View>

          <View style={styles.viewRow}>
            {hasVideos && (
              <View style={styles.videoIndicator}>
                <Film size={11} color={colors.primary} />
                <Text style={styles.videoText}>Video</Text>
              </View>
            )}
            {(match.challenger_rep_events?.length > 0 ||
              match.opponent_rep_events?.length > 0) && (
              <View style={styles.videoIndicator}>
                <Zap size={11} color={colors.accent} />
                <Text style={[styles.videoText, { color: colors.accent }]}>Rep data</Text>
              </View>
            )}
            <View style={styles.viewBtn}>
              <Eye size={12} color={colors.bg} />
              <Text style={styles.viewBtnText}>View</Text>
            </View>
          </View>
        </View>

        {match.completed_at && (
          <Text style={styles.dateText}>
            {new Date(match.completed_at).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function TheatreScreen() {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const router = useRouter();
  const [feedTab, setFeedTab] = useState<'discover' | 'mine'>('discover');
  const [itemsDiscover, setItemsDiscover] = useState<MatchWithProfiles[]>([]);
  const [itemsMine, setItemsMine] = useState<MatchWithProfiles[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const enrich = async (matches: Match[]) => {
    return Promise.all(
      matches.map(async (m) => {
        const [c, o] = await Promise.all([
          getProfile(m.challenger_id).catch(() => null),
          m.opponent_id ? getProfile(m.opponent_id).catch(() => null) : Promise.resolve(null),
        ]);
        return { match: m, challenger: c, opponent: o };
      })
    );
  };

  async function load() {
    if (!session?.user) return;
    try {
      const [pub, mine] = await Promise.all([
        getPublicTheatreFeed(40),
        getUserMatches(session.user.id, 'completed'),
      ]);
      const [d, mi] = await Promise.all([enrich(pub), enrich(mine)]);
      setItemsDiscover(d);
      setItemsMine(mi);
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

  const items = feedTab === 'discover' ? itemsDiscover : itemsMine;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Film size={20} color={colors.primary} />
        <Text style={styles.headerTitle}>THEATRE</Text>
        <Text style={styles.headerSub}>{items.length} replays</Text>
      </View>

      <View style={styles.feedTabs}>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'discover' && styles.feedTabActive]}
          onPress={() => setFeedTab('discover')}
        >
          <Text style={[styles.feedTabText, feedTab === 'discover' && styles.feedTabTextActive]}>
            Discover
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.feedTab, feedTab === 'mine' && styles.feedTabActive]}
          onPress={() => setFeedTab('mine')}
        >
          <Text style={[styles.feedTabText, feedTab === 'mine' && styles.feedTabTextActive]}>
            My sessions
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
        {!loading && items.length === 0 ? (
          <View style={styles.empty}>
            <LinearGradient
              colors={['rgba(0,212,255,0.08)', 'transparent']}
              style={styles.emptyGlow}
            />
            <Film size={64} color={colors.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>No replays yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete your first match to unlock{'\n'}
              Theatre replays with frame-by-frame{'\n'}
              rep validation and side-by-side video.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {items.map((item) => (
              <MatchCard
                key={item.match.id}
                item={item}
                myUserId={session?.user?.id ?? ''}
                anon={feedTab === 'discover'}
                onPress={() =>
                  router.push({
                    pathname: '/theatre/[id]',
                    params: { id: item.match.id },
                  })
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
    flex: 1,
  },
  headerSub: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  feedTabs: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  feedTab: {
    flex: 1,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderRadius: radius.sm,
  },
  feedTabActive: { backgroundColor: colors.primary + '33' },
  feedTabText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  feedTabTextActive: { color: colors.text },
  scroll: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingBottom: 100,
    paddingTop: spacing.md,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 80,
    gap: spacing.md,
  },
  emptyGlow: {
    position: 'absolute',
    top: 40,
    width: 200,
    height: 200,
    borderRadius: 100,
  },
  emptyTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 0.5,
    marginTop: spacing.md,
  },
  emptySubtitle: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  list: { gap: spacing.sm },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  cardWon: {
    borderColor: colors.success + '55',
    backgroundColor: 'rgba(0,255,136,0.03)',
  },
  cardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  cardLeft: { gap: 3 },
  cardRight: { alignItems: 'flex-end', gap: spacing.xs },
  matchId: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1.5,
  },
  exercise: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  opponent: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  winText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    color: colors.accent,
    letterSpacing: 1,
  },
  lossBadge: {
    backgroundColor: 'rgba(255,59,48,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.error + '66',
  },
  lossText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    color: colors.error,
    letterSpacing: 1,
  },
  drawBadge: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.border,
  },
  drawText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  wager: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.accent,
  },
  cardBottom: { gap: spacing.sm },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  scoreBlock: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  scoreNum: {
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    color: colors.text,
  },
  scoreSub: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  deltaBadge: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  deltaPos: {
    color: colors.success,
    backgroundColor: colors.success + '22',
  },
  deltaNeg: {
    color: colors.error,
    backgroundColor: colors.error + '22',
  },
  deltaZero: {
    color: colors.textMuted,
    backgroundColor: colors.bgHighlight,
  },
  viewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  videoIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  videoText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.primary,
  },
  viewBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    marginLeft: 'auto',
  },
  viewBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.bg,
  },
  dateText: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
});
