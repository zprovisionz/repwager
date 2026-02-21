import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { Trophy, Frown, Zap, Share2 } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import { checkAndAwardBadges } from '@/services/badge.service';
import { getMatch } from '@/services/match.service';
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
  const { matchId, myReps, isWinner } = useLocalSearchParams<{ matchId: string; myReps: string; isWinner: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { setActiveMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [match, setMatch] = useState<Match | null>(null);

  const won = isWinner === 'true';
  const reps = parseInt(myReps ?? '0');

  const titleAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.timing(titleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    if (matchId) {
      getMatch(matchId).then((m) => {
        if (m) setMatch(m);
      });
    }

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
  }, [matchId, session?.user?.id]);

  const confettiPieces = won
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
        <Animated.View style={[styles.heroSection, { opacity: titleAnim, transform: [{ scale: scaleAnim }] }]}>
          {won ? (
            <Trophy size={80} color={colors.accent} />
          ) : (
            <Frown size={80} color={colors.textMuted} />
          )}
          <Text style={[styles.resultTitle, won ? styles.winTitle : styles.loseTitle]}>
            {won ? 'YOU WON!' : 'YOU LOST'}
          </Text>
          <Text style={styles.repDisplay}>{reps}</Text>
          <Text style={styles.repSub}>REPS</Text>
        </Animated.View>

        {match && (
          <View style={styles.scoreComparison}>
            <View style={styles.scoreColumn}>
              <Text style={styles.scoreColumnLabel}>Your Reps</Text>
              <Text style={[styles.scoreColumnValue, won && styles.winColor]}>{match.challenger_id === session?.user?.id ? match.challenger_reps : match.opponent_reps}</Text>
            </View>
            <Text style={styles.vsText}>vs</Text>
            <View style={styles.scoreColumn}>
              <Text style={styles.scoreColumnLabel}>Opponent Reps</Text>
              <Text style={[styles.scoreColumnValue, !won && styles.winColor]}>{match.challenger_id === session?.user?.id ? match.opponent_reps : match.challenger_reps}</Text>
            </View>
          </View>
        )}

        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Zap size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Match ID</Text>
            <Text style={styles.statValue}>#{matchId?.slice(-8)}</Text>
          </View>
          <View style={[styles.statRow, styles.statRowBorder]}>
            <Trophy size={18} color={colors.accent} />
            <Text style={styles.statLabel}>Result</Text>
            <Text style={[styles.statValue, won ? styles.winColor : styles.loseColor]}>
              {won ? 'Victory' : 'Defeat'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Back to Home"
            onPress={() => router.replace('/(tabs)')}
            variant="primary"
            size="lg"
            style={styles.actionBtn}
          />
          <Button
            label="View Match"
            onPress={() => router.replace({ pathname: '/theatre/[id]', params: { id: matchId! } })}
            variant="outline"
            size="lg"
            style={styles.actionBtn}
          />
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
  scoreComparison: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  scoreColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreColumnLabel: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  scoreColumnValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 48,
    color: colors.text,
  },
  vsText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
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
  winColor: { color: colors.success },
  loseColor: { color: colors.error },
  actions: {
    width: '100%',
    gap: spacing.sm,
  },
  actionBtn: { width: '100%' },
});
