import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch, startMatch, completeMatch, setReady, subscribeToMatch } from '@/services/match.service';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { EXERCISE_LABELS } from '@/lib/config';
import { X, Zap } from 'lucide-react-native';
import type { Match } from '@/types/database';

type MatchPhase = 'loading' | 'waiting' | 'countdown' | 'active' | 'finishing';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const { setActiveMatch, updateMyReps, activeMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [phase, setPhase] = useState<MatchPhase>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [permission, requestPermission] = useCameraPermissions();
  const countdownAnim = useRef(new Animated.Value(1)).current;

  console.log('[MatchScreen] render — phase:', phase, '| permission:', permission ? `granted=${permission.granted} canAsk=${permission.canAskAgain}` : 'null (loading)');
  const repAnim = useRef(new Animated.Value(1)).current;
  const subscriptionRef = useRef<any>(null);

  const isChallenger = match?.challenger_id === session?.user?.id;
  const myReps = activeMatch?.myReps ?? 0;
  const timeLeft = activeMatch?.timeLeft ?? 60;

  const handleRepCounted = useCallback((total: number) => {
    console.log('[MatchScreen] handleRepCounted — total:', total);
    updateMyReps(total);
    Animated.sequence([
      Animated.timing(repAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(repAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [updateMyReps, repAnim]);

  const { repCount, isReady: poseReady, processFrame, manualIncrement, reset: resetPose } = usePoseDetection({
    exerciseType: match?.exercise_type ?? 'push_ups',
    onRepCounted: handleRepCounted,
    enabled: phase === 'active',
  });

  const handleMatchComplete = useCallback(async () => {
    if (!match || !session?.user) return;
    setPhase('finishing');

    const finalReps = useMatchStore.getState().activeMatch?.myReps ?? 0;
    const challengerReps = isChallenger ? finalReps : (activeMatch?.opponentReps ?? 0);
    const opponentReps = isChallenger ? (activeMatch?.opponentReps ?? 0) : finalReps;

    try {
      const winnerId = challengerReps >= opponentReps ? match.challenger_id : (match.opponent_id ?? match.challenger_id);
      await completeMatch(match.id, winnerId, challengerReps, opponentReps);

      router.replace({
        pathname: '/match/results',
        params: {
          matchId: match.id,
          myReps: finalReps.toString(),
          isWinner: (session.user.id === winnerId).toString(),
        },
      });
    } catch (err) {
      showToast({ type: 'error', title: 'Error completing match' });
    }
  }, [match, session, isChallenger, activeMatch, router, showToast]);

  const { start: startTimer } = useMatchTimer({ onComplete: handleMatchComplete });

  useEffect(() => {
    if (!id || !session?.user) return;
    loadMatch();
  }, [id]);

  async function loadMatch() {
    console.log('[MatchScreen] loadMatch — id:', id, '| user:', session?.user?.id);
    try {
      const m = await getMatch(id!);
      if (!m) throw new Error('Match not found');
      console.log('[MatchScreen] loadMatch — fetched match:', { id: m.id, status: m.status, exercise: m.exercise_type, challengerReady: m.challenger_ready, opponentReady: m.opponent_ready });
      setMatch(m);
      setActiveMatch(m);

      if (m.status === 'accepted' || m.status === 'in_progress') {
        setPhase('waiting');
      }

      subscriptionRef.current = subscribeToMatch(m.id, (updated) => {
        console.log('[MatchScreen] subscribeToMatch update — status:', updated.status, '| challengerReady:', updated.challenger_ready, '| opponentReady:', updated.opponent_ready);
        setMatch(updated);
        if (updated.challenger_ready && updated.opponent_ready && phase !== 'active') {
          console.log('[MatchScreen] both players ready — starting countdown');
          beginCountdown();
        }
      });
    } catch (err) {
      console.error('[MatchScreen] loadMatch error:', err);
      showToast({ type: 'error', title: 'Match not found' });
      router.back();
    }
  }

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  async function handleReady() {
    if (!match || !session?.user) return;
    console.log('[MatchScreen] handleReady — matchId:', match.id, '| isChallenger:', isChallenger);
    try {
      const updated = await setReady(match.id, session.user.id, isChallenger);
      console.log('[MatchScreen] handleReady — updated ready flags:', { challengerReady: updated.challenger_ready, opponentReady: updated.opponent_ready });
      setMatch(updated);
      if (updated.challenger_ready && updated.opponent_ready) {
        console.log('[MatchScreen] handleReady — both ready, starting countdown');
        beginCountdown();
      }
    } catch (err) {
      console.error('[MatchScreen] handleReady error:', err);
      showToast({ type: 'error', title: 'Could not mark ready' });
    }
  }

  function beginCountdown() {
    console.log('[MatchScreen] beginCountdown — starting 3…2…1');
    setPhase('countdown');
    setCountdown(3);
    let count = 3;
    const tick = () => {
      Animated.sequence([
        Animated.timing(countdownAnim, { toValue: 1.5, duration: 200, useNativeDriver: true }),
        Animated.timing(countdownAnim, { toValue: 0.8, duration: 700, useNativeDriver: true }),
      ]).start();

      if (count > 1) {
        count--;
        setCountdown(count);
        setTimeout(tick, 1000);
      } else {
        setTimeout(() => {
          console.log('[MatchScreen] beginCountdown — GO! setting phase=active');
          setPhase('active');
          resetPose();
          startTimer();
          if (match) startMatch(match.id).catch((err) => console.error('[MatchScreen] startMatch error:', err));
        }, 1000);
      }
    };
    tick();
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.permText}>Camera access is needed to count reps.</Text>
        <TouchableOpacity style={styles.permBtn} onPress={requestPermission}>
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.fill}>
      {Platform.OS !== 'web' ? (
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.webCamFallback]}>
          <Zap size={48} color={colors.primary} />
          <Text style={styles.webCamText}>Camera preview on device</Text>
        </View>
      )}

      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View style={[styles.topBar, { paddingTop: insets.top + spacing.sm }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.text} />
          </TouchableOpacity>
          <View style={styles.exerciseBadge}>
            <Text style={styles.exerciseLabel}>
              {match ? EXERCISE_LABELS[match.exercise_type] : '---'}
            </Text>
          </View>
          <View style={styles.wagerBadge}>
            <Text style={styles.wagerLabel}>${match?.wager_amount?.toFixed(2) ?? '0.00'}</Text>
          </View>
        </View>

        {phase === 'active' && (
          <View style={styles.timerRow}>
            <Text style={[styles.timer, timeLeft <= 10 ? styles.timerUrgent : null]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}

        {phase === 'countdown' && (
          <View style={styles.countdownWrap}>
            <Animated.Text style={[styles.countdownNum, { transform: [{ scale: countdownAnim }] }]}>
              {countdown}
            </Animated.Text>
            <Text style={styles.countdownLabel}>GET READY</Text>
          </View>
        )}

        {phase === 'waiting' && (
          <View style={styles.waitingWrap}>
            <Text style={styles.waitingTitle}>
              {isChallenger
                ? match?.challenger_ready ? 'Waiting for opponent...' : 'Tap ready when set!'
                : match?.opponent_ready ? 'Waiting for challenger...' : 'Tap ready when set!'}
            </Text>
          </View>
        )}

        {phase === 'loading' && (
          <View style={styles.waitingWrap}>
            <Text style={styles.waitingTitle}>Loading match...</Text>
          </View>
        )}

        {phase === 'active' && (
          <View style={styles.repCountWrap}>
            <Animated.Text style={[styles.repCount, { transform: [{ scale: repAnim }] }]}>
              {myReps}
            </Animated.Text>
            <Text style={styles.repLabel}>REPS</Text>
          </View>
        )}

        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {phase === 'waiting' && (
            <TouchableOpacity
              style={[styles.readyBtn, (isChallenger ? match?.challenger_ready : match?.opponent_ready) ? styles.readyBtnDone : null]}
              onPress={handleReady}
              disabled={isChallenger ? match?.challenger_ready : match?.opponent_ready}
            >
              <Text style={styles.readyBtnText}>
                {(isChallenger ? match?.challenger_ready : match?.opponent_ready) ? 'READY!' : 'TAP TO READY UP'}
              </Text>
            </TouchableOpacity>
          )}

          {phase === 'active' && (
            <TouchableOpacity style={styles.devBtn} onPress={manualIncrement}>
              <Text style={styles.devBtnText}>TAP TO COUNT REP</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  center: { alignItems: 'center', justifyContent: 'center' },
  overlay: { flex: 1 },
  webCamFallback: {
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
  },
  webCamText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(8,12,20,0.7)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseBadge: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  exerciseLabel: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.primary,
    letterSpacing: 1,
  },
  wagerBadge: {
    backgroundColor: 'rgba(255,184,0,0.2)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  wagerLabel: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.accent,
    letterSpacing: 1,
  },
  timerRow: {
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  timer: {
    fontFamily: typography.fontDisplay,
    fontSize: 52,
    color: colors.text,
    letterSpacing: 2,
  },
  timerUrgent: {
    color: colors.error,
  },
  countdownWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  countdownNum: {
    fontFamily: typography.fontDisplay,
    fontSize: 120,
    color: colors.primary,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  countdownLabel: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 4,
    marginTop: spacing.sm,
  },
  waitingWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
  },
  waitingTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
  },
  repCountWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repCount: {
    fontFamily: typography.fontDisplay,
    fontSize: 120,
    color: colors.success,
    textShadowColor: colors.success,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  repLabel: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 18,
    color: colors.successDark,
    letterSpacing: 6,
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(8,12,20,0.7)',
  },
  readyBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  readyBtnDone: {
    backgroundColor: colors.success,
  },
  readyBtnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textInverse,
    letterSpacing: 2,
  },
  devBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  devBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.text,
  },
  permText: {
    fontFamily: typography.fontBody,
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
  permBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.sm + 4,
    paddingHorizontal: spacing.xl,
  },
  permBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.textInverse,
  },
});
