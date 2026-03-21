import { useEffect, useState, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
  runOnJS,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { BarlowText } from '@/components/ui/BarlowText';
import { useAuthStore } from '@/stores/authStore';
import { LinearGradient } from 'expo-linear-gradient';
import { Trophy, Frown, Film, Share2, RotateCcw } from 'lucide-react-native';
import ViewShot from 'react-native-view-shot';
import ShareCard from '@/components/ShareCard';
import { generateShareCard, shareImage } from '@/services/share.service';
import type { RefObject } from 'react';
import { RANK_TIER_COLORS, RANK_TIER_TAGLINES, RANK_TIERS, type RankTier } from '@/types/database';

const { width: SW, height: SH } = Dimensions.get('window');

const CONFETTI_COLORS = ['#00D4FF', '#FF2D78', '#FFB800', '#00FF88', '#A78BFA'];
function rankUpSplashInfo(tierRaw: string): { label: string; tagline: string; color: string } {
  const key = RANK_TIERS.find((t) => t.toLowerCase() === tierRaw.trim().toLowerCase());
  const tier: RankTier = key ?? 'Rookie';
  return {
    label: tier.toUpperCase(),
    tagline: RANK_TIER_TAGLINES[tier],
    color: RANK_TIER_COLORS[tier],
  };
}

interface ConfettiPiece {
  id: number;
  x: number;
  color: string;
  size: number;
  delay: number;
}

function ConfettoPiece({ piece }: { piece: ConfettiPiece }) {
  const y = useSharedValue(-20);
  const opacity = useSharedValue(1);
  const rotate = useSharedValue(0);
  const scaleX = useSharedValue(1);

  useEffect(() => {
    const duration = 1800 + piece.delay;
    setTimeout(() => {
      y.value = withTiming(SH + 60, { duration, easing: Easing.out(Easing.quad) });
      rotate.value = withRepeat(withTiming(360, { duration: 700 }), -1, false);
      scaleX.value = withRepeat(withSequence(withTiming(-1, { duration: 300 }), withTiming(1, { duration: 300 })), -1, true);
      opacity.value = withTiming(0, { duration, easing: Easing.in(Easing.quad) });
    }, piece.delay);
  }, []);

  const style = useAnimatedStyle(() => ({
    position: 'absolute',
    left: piece.x,
    top: y.value,
    width: piece.size,
    height: piece.size / 2,
    backgroundColor: piece.color,
    borderRadius: 2,
    opacity: opacity.value,
    transform: [{ rotate: `${rotate.value}deg` }, { scaleX: scaleX.value }],
  }));

  return <Animated.View style={style} />;
}

function FloatingCounter({ text, color, delay }: { text: string; color: string; delay: number }) {
  const y = useSharedValue(0);
  const opacity = useSharedValue(0);

  useEffect(() => {
    setTimeout(() => {
      opacity.value = withTiming(1, { duration: 200 });
      y.value = withTiming(-80, { duration: 1800, easing: Easing.out(Easing.cubic) });
      setTimeout(() => {
        opacity.value = withTiming(0, { duration: 400 });
      }, 1400);
    }, delay);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: y.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.floatingCounter, style]}>
      <Text style={[styles.floatingCounterText, { color }]}>{text}</Text>
    </Animated.View>
  );
}

function ScoreCard({
  label,
  reps,
  isWinner,
  color,
  flipDelay,
}: {
  label: string;
  reps: number;
  isWinner: boolean;
  color: string;
  flipDelay: number;
}) {
  const flip = useSharedValue(0);
  const scale = useSharedValue(0.9);

  useEffect(() => {
    const t = setTimeout(() => {
      flip.value = withTiming(1, { duration: 600 });
      scale.value = withSpring(1, { damping: 10 });
    }, flipDelay);
    return () => clearTimeout(t);
  }, []);

  const frontStyle = useAnimatedStyle(() => ({
    opacity: flip.value < 0.5 ? 1 : 0,
    transform: [{ rotateY: `${flip.value * 90}deg` }],
  }));

  const backStyle = useAnimatedStyle(() => ({
    opacity: flip.value >= 0.5 ? 1 : 0,
    transform: [{ rotateY: `${(1 - flip.value) * 90}deg` }],
  }));

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.scoreCard, containerStyle]}>
      <Animated.View style={[styles.scoreCardFace, styles.scoreCardFront, frontStyle]}>
        <Text style={styles.scoreCardHiddenLabel}>{label}</Text>
        <Text style={styles.scoreCardHiddenReps}>?</Text>
      </Animated.View>

      <Animated.View
        style={[
          styles.scoreCardFace,
          styles.scoreCardBack,
          { borderColor: isWinner ? color : colors.border },
          backStyle,
        ]}
      >
        <Text style={[styles.scoreCardLabel, { color }]}>{label}</Text>
        <Text style={[styles.scoreCardReps, { color }]}>{reps}</Text>
        <Text style={styles.scoreCardRepsLabel}>reps</Text>
        {isWinner && (
          <View style={[styles.winnerTag, { backgroundColor: color + '22', borderColor: color }]}>
            <Text style={[styles.winnerTagText, { color }]}>WINNER</Text>
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );
}

function RankUpSplash({ tier, onDone }: { tier: string; onDone: () => void }) {
  const info = rankUpSplashInfo(tier);
  const scale = useSharedValue(0.4);
  const opacity = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 8 });
    opacity.value = withTiming(1, { duration: 400 });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    const t = setTimeout(() => {
      opacity.value = withTiming(0, { duration: 500 });
      setTimeout(() => runOnJS(onDone)(), 500);
    }, 2800);
    return () => clearTimeout(t);
  }, []);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
      <View style={styles.rankUpBg} />
      <Animated.View style={[styles.rankUpCard, style]}>
        <Text style={styles.rankUpHeadline}>RANK UP!</Text>
        <Text style={[styles.rankUpTier, { color: info.color }]}>{info.label}</Text>
        <Text style={styles.rankUpTagline}>{info.tagline}</Text>
      </Animated.View>
    </View>
  );
}

export default function RevealScreen() {
  const { matchId, myReps, opponentReps, isWinner, newRankTier } =
    useLocalSearchParams<{
      matchId: string;
      myReps: string;
      opponentReps: string;
      isWinner: string;
      newRankTier?: string;
    }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refreshProfile, profile } = useAuthStore();

  const won = isWinner === 'true';
  const myScore = parseInt(myReps ?? '0', 10);
  const opponentScore = parseInt(opponentReps ?? '0', 10);

  const [revealCountdown, setRevealCountdown] = useState(3);
  const [revealPhase, setRevealPhase] = useState<'counting' | 'flipping' | 'revealed'>('counting');
  const [sharing, setSharing] = useState(false);
  const [showRankUp, setShowRankUp] = useState(false);
  const [rankUpDismissed, setRankUpDismissed] = useState(false);
  const [showCounters, setShowCounters] = useState(false);

  const shareCardRef = useRef<ViewShot>(null) as RefObject<ViewShot>;

  const countdownScale = useSharedValue(1);
  const outcomeOpacity = useSharedValue(0);

  const countdownStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownScale.value }],
  }));

  const outcomeStyle = useAnimatedStyle(() => ({
    opacity: outcomeOpacity.value,
  }));

  const confettiPieces = useMemo<ConfettiPiece[]>(() => {
    if (!won) return [];
    return Array.from({ length: 40 }, (_, i) => ({
      id: i,
      x: Math.random() * SW,
      color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      size: 8 + Math.random() * 8,
      delay: Math.random() * 1200,
    }));
  }, [won]);

  useEffect(() => {
    refreshProfile();

    let count = 3;
    const tick = () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      countdownScale.value = withSequence(
        withSpring(1.6, { damping: 6 }),
        withTiming(0.8, { duration: 500 })
      );

      if (count > 1) {
        count--;
        setRevealCountdown(count);
        setTimeout(tick, 900);
      } else {
        setTimeout(() => {
          setRevealPhase('flipping');
          Haptics.notificationAsync(
            won
              ? Haptics.NotificationFeedbackType.Success
              : Haptics.NotificationFeedbackType.Warning
          );

          setTimeout(() => {
            setRevealPhase('revealed');
            outcomeOpacity.value = withSpring(1, { damping: 12 });
            setShowCounters(true);

            if (won && newRankTier) {
              setTimeout(() => setShowRankUp(true), 1600);
            }
          }, 1000);
        }, 600);
      }
    };

    const t = setTimeout(tick, 400);
    return () => clearTimeout(t);
  }, []);

  async function handleShare() {
    if (!profile || sharing) return;
    setSharing(true);
    try {
      const uri = await generateShareCard(shareCardRef);
      if (uri) {
        await shareImage(uri, 'Check out my RepWager result!');
      }
    } catch {
    } finally {
      setSharing(false);
    }
  }

  function handleRematch() {
    router.push({
      pathname: '/challenge/create',
      params: { rematch_of: matchId ?? '' },
    });
  }

  const rcEarned = won ? 20 : 0;
  const xpEarned = won ? 50 : 15;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={
          won
            ? ['rgba(0,212,255,0.12)', colors.bg, colors.bg]
            : ['rgba(255,45,120,0.08)', colors.bg, colors.bg]
        }
        style={StyleSheet.absoluteFill}
      />

      {won && revealPhase === 'revealed' && confettiPieces.map((p) => (
        <ConfettoPiece key={p.id} piece={p} />
      ))}

      {revealPhase === 'counting' && (
        <View style={styles.countdownContainer}>
          <Text style={styles.revealLabel}>Revealing in</Text>
          <Animated.Text style={[styles.revealCountdown, countdownStyle]}>
            {revealCountdown}
          </Animated.Text>
        </View>
      )}

      {revealPhase !== 'counting' && (
        <View style={styles.cardsContainer}>
          <Text style={styles.bothSubmittedLabel}>Both players submitted</Text>

          <View style={styles.cardsRow}>
            <ScoreCard
              label="You"
              reps={myScore}
              isWinner={won}
              color={colors.primary}
              flipDelay={0}
            />
            <Text style={styles.vsLabel}>VS</Text>
            <ScoreCard
              label="Them"
              reps={opponentScore}
              isWinner={!won}
              color={colors.secondary}
              flipDelay={150}
            />
          </View>

          <View style={styles.floatingCountersRow}>
            {showCounters && won && (
              <>
                <FloatingCounter text={`+${rcEarned} RC`} color={colors.accent} delay={200} />
                <FloatingCounter text={`+${xpEarned} XP`} color={colors.primary} delay={500} />
              </>
            )}
            {showCounters && !won && (
              <FloatingCounter text={`+${xpEarned} XP`} color={colors.textSecondary} delay={200} />
            )}
          </View>

          <Animated.View style={[styles.outcomeContainer, outcomeStyle]}>
            {revealPhase === 'revealed' && (
              <>
                <View style={styles.outcomeIcon}>
                  {won ? (
                    <Trophy size={36} color={colors.success} />
                  ) : (
                    <Frown size={36} color={colors.textMuted} />
                  )}
                </View>

                <BarlowText
                  variant="display"
                  style={[
                    styles.outcomeTitle,
                    { color: won ? colors.success : colors.error },
                  ]}
                >
                  {won ? 'VICTORY' : 'DEFEAT'}
                </BarlowText>

                {!won && (
                  <Text style={styles.lossLine}>
                    You were {Math.abs(opponentScore - myScore)} rep
                    {Math.abs(opponentScore - myScore) !== 1 ? 's' : ''}{' '}
                    short. Rematch now — close the gap.
                  </Text>
                )}

                <View style={styles.actions}>
                  <TouchableOpacity
                    style={styles.rematchBtn}
                    onPress={handleRematch}
                  >
                    <RotateCcw size={16} color={colors.text} />
                    <Text style={styles.rematchBtnText}>Rematch</Text>
                  </TouchableOpacity>

                  {profile && (
                    <TouchableOpacity
                      style={styles.shareBtn}
                      onPress={handleShare}
                      disabled={sharing}
                    >
                      <Share2 size={16} color={colors.accent} />
                      <Text style={styles.shareBtnText}>
                        {sharing ? 'Sharing...' : 'Share Result'}
                      </Text>
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    style={styles.theatreBtn}
                    onPress={() =>
                      router.replace({
                        pathname: '/theatre/[id]',
                        params: { id: matchId! },
                      })
                    }
                  >
                    <Film size={16} color={colors.primary} />
                    <Text style={styles.theatreBtnText}>View in Theatre</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.homeBtn}
                    onPress={() => router.replace('/(tabs)')}
                  >
                    <Text style={styles.homeBtnText}>Back to Home</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </Animated.View>
        </View>
      )}

      {showRankUp && !rankUpDismissed && newRankTier && (
        <RankUpSplash tier={newRankTier} onDone={() => setRankUpDismissed(true)} />
      )}

      {profile && (
        <ViewShot ref={shareCardRef} options={{ format: 'png', quality: 1.0 }} style={styles.shareCardHidden}>
          <ShareCard
            profile={profile}
            matchResult={
              revealPhase === 'revealed'
                ? {
                    myReps: myScore,
                    opponentReps: opponentScore,
                    won,
                    exerciseLabel: 'Push-Ups',
                  }
                : undefined
            }
          />
        </ViewShot>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  countdownContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  revealLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  revealCountdown: {
    fontFamily: typography.fontDisplay,
    fontSize: 120,
    color: colors.primary,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  cardsContainer: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.lg,
    paddingTop: spacing.xxl,
  },
  bothSubmittedLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  cardsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  vsLabel: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  scoreCard: { width: 140, height: 180, position: 'relative' },
  scoreCardFace: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backfaceVisibility: 'hidden',
  },
  scoreCardFront: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
  },
  scoreCardBack: { backgroundColor: colors.bgCard, borderWidth: 2 },
  scoreCardHiddenLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  scoreCardHiddenReps: {
    fontFamily: typography.fontDisplay,
    fontSize: 64,
    color: colors.textMuted,
  },
  scoreCardLabel: { fontFamily: typography.fontBodyMedium, fontSize: 13, letterSpacing: 1 },
  scoreCardReps: { fontFamily: typography.fontDisplay, fontSize: 64 },
  scoreCardRepsLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  winnerTag: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    marginTop: 4,
  },
  winnerTagText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 1 },
  floatingCountersRow: {
    flexDirection: 'row',
    gap: spacing.xl,
    height: 40,
    alignItems: 'flex-end',
  },
  floatingCounter: {
    alignItems: 'center',
  },
  floatingCounterText: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    letterSpacing: 1,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  outcomeContainer: { alignItems: 'center', gap: spacing.md, width: '100%' },
  outcomeIcon: {},
  outcomeTitle: { fontFamily: typography.fontDisplay, fontSize: 32, letterSpacing: 3 },
  lossLine: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: spacing.lg,
  },
  actions: { width: '100%', gap: spacing.sm, marginTop: spacing.md },
  rematchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  rematchBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent + '60',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  shareBtnText: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.accent },
  theatreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary + '40',
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
  },
  theatreBtnText: { fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.primary },
  homeBtn: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
  },
  homeBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  shareCardHidden: {
    position: 'absolute',
    left: -9999,
    top: 0,
    width: 320,
  },
  rankUpBg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.75)',
  },
  rankUpCard: {
    position: 'absolute',
    alignSelf: 'center',
    top: '35%',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.xl,
    minWidth: 260,
  },
  rankUpHeadline: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 13,
    color: colors.textMuted,
    letterSpacing: 4,
  },
  rankUpTier: {
    fontFamily: typography.fontDisplay,
    fontSize: 36,
    letterSpacing: 3,
  },
  rankUpTagline: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
});
