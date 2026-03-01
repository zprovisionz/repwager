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
import { DEV_MODE_MANUAL_COUNT, EXERCISE_LABELS } from '@/lib/config';
import { supabase } from '@/lib/supabase';
import { X, Zap } from 'lucide-react-native';
import type { Match } from '@/types/database';

type MatchPhase = 'loading' | 'waiting' | 'countdown' | 'active' | 'finishing';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { setActiveMatch, updateMyReps, updateOpponentReps, activeMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [phase, setPhase] = useState<MatchPhase>('loading');
  // phaseRef prevents stale closures in subscription callbacks and async functions
  const phaseRef = useRef<MatchPhase>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  // matchRef ensures subscription callback always has current match data
  const matchRef = useRef<Match | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [permission, requestPermission] = useCameraPermissions();
  const countdownAnim = useRef(new Animated.Value(1)).current;
  const repAnim = useRef(new Animated.Value(1)).current;
  const subscriptionRef = useRef<any>(null);
  const repSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep both phase state and ref in sync on every phase transition
  function updatePhase(next: MatchPhase) {
    phaseRef.current = next;
    setPhase(next);
  }

  const isChallenger = matchRef.current?.challenger_id === session?.user?.id;
  const myReps = activeMatch?.myReps ?? 0;
  const timeLeft = activeMatch?.timeLeft ?? 60;

  const handleRepCounted = useCallback((total: number) => {
    updateMyReps(total);
    Animated.sequence([
      Animated.timing(repAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(repAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [updateMyReps, repAnim]);

  const { processFrame, manualIncrement, reset: resetPose } = usePoseDetection({
    exerciseType: match?.exercise_type ?? 'push_ups',
    onRepCounted: handleRepCounted,
    enabled: phase === 'active',
  });

  // Debounced rep sync to DB so both clients can read each other's live rep counts
  useEffect(() => {
    if (phaseRef.current !== 'active' || !matchRef.current) return;
    const field = isChallenger ? 'challenger_reps' : 'opponent_reps';
    if (repSyncTimeoutRef.current) clearTimeout(repSyncTimeoutRef.current);
    repSyncTimeoutRef.current = setTimeout(() => {
      (supabase.from('matches') as any)
        .update({ [field]: myReps })
        .eq('id', matchRef.current!.id)
        .then(() => {});
    }, 500);
    return () => {
      if (repSyncTimeoutRef.current) clearTimeout(repSyncTimeoutRef.current);
    };
  }, [myReps]);

  const handleMatchComplete = useCallback(async () => {
    if (!matchRef.current || !session?.user) return;
    updatePhase('finishing');

    const storeState = useMatchStore.getState().activeMatch;
    const finalReps = storeState?.myReps ?? 0;
    const opponentFinalReps = storeState?.opponentReps ?? 0;

    const currentMatch = matchRef.current;
    const currentIsChallenger = currentMatch.challenger_id === session.user.id;
    const challengerReps = currentIsChallenger ? finalReps : opponentFinalReps;
    const opponentReps = currentIsChallenger ? opponentFinalReps : finalReps;
    const winnerId =
      challengerReps >= opponentReps
        ? currentMatch.challenger_id
        : (currentMatch.opponent_id ?? currentMatch.challenger_id);

    try {
      await completeMatch(currentMatch.id, winnerId, challengerReps, opponentReps);
    } catch (err: any) {
      // Other client already completed the match — fetch the authoritative result
      if (err?.message?.includes('cannot be completed in status')) {
        const finalMatch = await getMatch(currentMatch.id).catch(() => null);
        router.replace({
          pathname: '/match/results',
          params: {
            matchId: currentMatch.id,
            myReps: finalReps.toString(),
            isWinner: (finalMatch?.winner_id === session.user.id).toString(),
            exerciseType: currentMatch.exercise_type,
          },
        });
        return;
      }
      showToast({ type: 'error', title: 'Error completing match' });
      return;
    }

    router.replace({
      pathname: '/match/results',
      params: {
        matchId: currentMatch.id,
        myReps: finalReps.toString(),
        isWinner: (session.user.id === winnerId).toString(),
        exerciseType: currentMatch.exercise_type,
      },
    });
  }, [session, router, showToast]);

  const { start: startTimer } = useMatchTimer({ onComplete: handleMatchComplete });

  useEffect(() => {
    if (!id || !session?.user) return;
    loadMatch();
  }, [id]);

  async function loadMatch() {
    try {
      const m = await getMatch(id!);
      if (!m) throw new Error('Match not found');

      setMatch(m);
      matchRef.current = m;
      setActiveMatch(m);

      if (m.status === 'accepted' || m.status === 'in_progress') {
        updatePhase('waiting');
      }

      subscriptionRef.current = subscribeToMatch(m.id, (updated) => {
        setMatch(updated);
        matchRef.current = updated;

        // Sync opponent's live reps during active phase
        if (phaseRef.current === 'active') {
          const amChallenger = session?.user?.id === updated.challenger_id;
          const opponentDbReps = amChallenger
            ? (updated.opponent_reps ?? 0)
            : (updated.challenger_reps ?? 0);
          updateOpponentReps(opponentDbReps);
        }

        // Only start countdown once — phaseRef prevents the stale-closure double-fire
        if (
          updated.challenger_ready &&
          updated.opponent_ready &&
          phaseRef.current !== 'countdown' &&
          phaseRef.current !== 'active' &&
          phaseRef.current !== 'finishing'
        ) {
          beginCountdown();
        }
      });
    } catch {
      showToast({ type: 'error', title: 'Match not found' });
      router.back();
    }
  }

  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
      if (repSyncTimeoutRef.current) clearTimeout(repSyncTimeoutRef.current);
    };
  }, []);

  async function handleReady() {
    if (!matchRef.current || !session?.user) return;
    try {
      const updated = await setReady(matchRef.current.id, session.user.id, isChallenger);
      setMatch(updated);
      matchRef.current = updated;
      if (updated.challenger_ready && updated.opponent_ready) {
        beginCountdown();
      }
    } catch {
      showToast({ type: 'error', title: 'Could not mark ready' });
    }
  }

  function beginCountdown() {
    // Guard using phaseRef — prevents double-fire from stale subscription closures
    if (
      phaseRef.current === 'countdown' ||
      phaseRef.current === 'active' ||
      phaseRef.current === 'finishing'
    ) {
      return;
    }
    updatePhase('countdown');
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
          updatePhase('active');
          resetPose();
          startTimer();
          if (matchRef.current) {
            startMatch(matchRef.current.id).catch(() => {});
          }
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
                ? match?.challenger_ready
                  ? 'Waiting for opponent...'
                  : 'Tap ready when set!'
                : match?.opponent_ready
                ? 'Waiting for challenger...'
                : 'Tap ready when set!'}
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
              style={[
                styles.readyBtn,
                (isChallenger ? match?.challenger_ready : match?.opponent_ready)
                  ? styles.readyBtnDone
                  : null,
              ]}
              onPress={handleReady}
              disabled={isChallenger ? match?.challenger_ready : match?.opponent_ready}
            >
              <Text style={styles.readyBtnText}>
                {(isChallenger ? match?.challenger_ready : match?.opponent_ready)
                  ? 'READY!'
                  : 'TAP TO READY UP'}
              </Text>
            </TouchableOpacity>
          )}

          {phase === 'active' && __DEV__ && DEV_MODE_MANUAL_COUNT && (
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
