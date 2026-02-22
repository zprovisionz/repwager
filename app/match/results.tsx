import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { Trophy, Frown, Zap, Clock } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import { checkAndAwardBadges } from '@/services/badge.service';
import { getMatch, subscribeToMatch } from '@/services/match.service';
import { getAsyncPhase, getMinutesUntilDeadline } from '@/services/asyncMatch.service';
import type { Match } from '@/types/database';

function ConfettiPiece({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * 400 - 200).current;
  const rot = useRef(Math.random() * 720).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }).start();
    }, delay);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: color,
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 700] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rot}deg`] }) },
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
      }}
    />
  );
}

const CONFETTI_COLORS = [colors.primary, colors.secondary, colors.accent, colors.success, '#ff6b6b', '#ffd93d'];

export default function ResultsScreen() {
  const { matchId, myReps, isWinner } = useLocalSearchParams<{
    matchId: string;
    myReps: string;
    isWinner: string;
  }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { setActiveMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [deadlineMinutes, setDeadlineMinutes] = useState<number | null>(null);
  const subscriptionRef = useRef<any>(null);
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const won = isWinner === 'true';
  const reps = parseInt(myReps ?? '0');

  const titleAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  // ── Load match and subscribe to updates ──────────────────────────────────
  useEffect(() => {
    if (!matchId) return;

    getMatch(matchId).then((m) => {
      if (!m) return;
      setMatch(m);
      updateDeadline(m);

      // Subscribe so we notice when the opponent submits
      subscriptionRef.current = subscribeToMatch(m.id, (updated) => {
        setMatch(updated);
        updateDeadline(updated);
      });
    });

    return () => {
      subscriptionRef.current?.unsubscribe();
      if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    };
  }, [matchId]);

  function updateDeadline(m: Match) {
    if (!m.submission_deadline) return;
    setDeadlineMinutes(getMinutesUntilDeadline(m));

    if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    deadlineTimerRef.current = setInterval(() => {
      setDeadlineMinutes(getMinutesUntilDeadline(m));
    }, 30_000);
  }

  // ── Entry animations + badge check ───────────────────────────────────────
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.timing(titleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    if (session?.user && profile) {
      checkAndAwardBadges(session.user.id, profile, reps).then((badges) => {
        badges.forEach((b) => {
          showToast({ type: 'badge', title: 'Badge Earned!', message: b.replace(/_/g, ' ') });
        });
      });
      refreshProfile();
    }

    return () => {
      setActiveMatch(null);
    };
  }, []);

  // ── Derived async state ──────────────────────────────────────────────────
  const isChallenger = match?.challenger_id === session?.user?.id;
  const asyncPhase = match ? getAsyncPhase(match) : null;
  const bothSubmitted = asyncPhase === 'COMPLETED' && match?.status === 'completed';

  // Show opponent reps only when the match is fully completed
  const opponentReps: number | null = bothSubmitted
    ? (isChallenger ? (match?.opponent_reps ?? null) : (match?.challenger_reps ?? null))
    : null;

  const opponentSubmittedFirst =
    match &&
    !!(isChallenger ? match.opponent_submitted_at : match.challenger_submitted_at) &&
    !(isChallenger ? match.challenger_submitted_at : match.opponent_submitted_at);

  const confettiPieces =
    won && bothSubmitted
      ? Array.from({ length: 40 }, (_, i) => ({
          delay: i * 60,
          color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        }))
      : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {confettiPieces.map((p, i) => (
        <ConfettiPiece key={i} delay={p.delay} color={p.color} />
      ))}

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* ── Hero section ── */}
        <Animated.View
          style={[styles.heroSection, { opacity: titleAnim, transform: [{ scale: scaleAnim }] }]}
        >
          {bothSubmitted ? (
            won ? (
              <Trophy size={80} color={colors.accent} />
            ) : (
              <Frown size={80} color={colors.textMuted} />
            )
          ) : (
            <Clock size={80} color={colors.primary} />
          )}

          <Text style={[styles.resultTitle, bothSubmitted ? (won ? styles.winTitle : styles.loseTitle) : styles.pendingTitle]}>
            {bothSubmitted ? (won ? 'YOU WON!' : 'YOU LOST') : 'SCORE SUBMITTED'}
          </Text>

          <Text style={styles.repDisplay}>{reps}</Text>
          <Text style={styles.repSub}>YOUR REPS</Text>
        </Animated.View>

        {/* ── Stats card ── */}
        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Zap size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Match ID</Text>
            <Text style={styles.statValue}>#{matchId?.slice(-8)}</Text>
          </View>

          <View style={[styles.statRow, styles.statRowBorder]}>
            <Trophy size={18} color={colors.accent} />
            <Text style={styles.statLabel}>Your Score</Text>
            <Text style={styles.statValue}>{reps} reps</Text>
          </View>

          <View style={[styles.statRow, styles.statRowBorder]}>
            {opponentReps !== null ? (
              <>
                <Trophy size={18} color={colors.textSecondary} />
                <Text style={styles.statLabel}>Opponent Score</Text>
                <Text style={styles.statValue}>{opponentReps} reps</Text>
              </>
            ) : (
              <>
                <Clock size={18} color={colors.textMuted} />
                <Text style={styles.statLabel}>Opponent Score</Text>
                <Text style={styles.statValuePending}>
                  {opponentSubmittedFirst ? 'Submitted — hidden' : 'Opponent score pending...'}
                </Text>
              </>
            )}
          </View>

          {bothSubmitted && (
            <View style={[styles.statRow, styles.statRowBorder]}>
              <Trophy size={18} color={won ? colors.accent : colors.error} />
              <Text style={styles.statLabel}>Result</Text>
              <Text style={[styles.statValue, won ? styles.winColor : styles.loseColor]}>
                {won ? 'Victory' : 'Defeat'}
              </Text>
            </View>
          )}
        </View>

        {/* ── Awaiting opponent banner ── */}
        {!bothSubmitted && (
          <View style={styles.pendingBanner}>
            <Clock size={20} color={colors.primary} />
            <View style={styles.pendingBannerText}>
              <Text style={styles.pendingBannerTitle}>Waiting for opponent</Text>
              <Text style={styles.pendingBannerSub}>
                {deadlineMinutes !== null
                  ? `Opponent has ${
                      deadlineMinutes < 60
                        ? `${deadlineMinutes} min`
                        : `${Math.floor(deadlineMinutes / 60)}h ${deadlineMinutes % 60}m`
                    } to submit their score.`
                  : "You'll be notified when they submit."}
              </Text>
            </View>
          </View>
        )}

        {/* ── Actions ── */}
        <View style={styles.actions}>
          <Button
            label="Back to Home"
            onPress={() => router.replace('/(tabs)')}
            variant="primary"
            size="lg"
            style={styles.actionBtn}
          />
          {bothSubmitted && (
            <Button
              label="View Match"
              onPress={() =>
                router.replace({ pathname: '/theatre/[id]', params: { id: matchId! } })
              }
              variant="outline"
              size="lg"
              style={styles.actionBtn}
            />
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  resultTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 42,
    marginTop: spacing.md,
    letterSpacing: 3,
  },
  winTitle: { color: colors.accent },
  loseTitle: { color: colors.textMuted },
  pendingTitle: { color: colors.primary },
  repDisplay: {
    fontFamily: typography.fontDisplay,
    fontSize: 96,
    color: colors.text,
    marginTop: spacing.lg,
  },
  repSub: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 6,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  statLabel: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  statValuePending: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    fontStyle: 'italic',
  },
  winColor: { color: colors.success },
  loseColor: { color: colors.error },
  pendingBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,212,255,0.08)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.md,
    marginBottom: spacing.xl,
  },
  pendingBannerText: {
    flex: 1,
    gap: spacing.xs,
  },
  pendingBannerTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.primary,
  },
  pendingBannerSub: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  actionBtn: { width: '100%' },
});
