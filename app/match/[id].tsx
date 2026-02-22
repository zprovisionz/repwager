import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch, startMatch, setReady, subscribeToMatch } from '@/services/match.service';
import {
  getAsyncPhase,
  submitMatchScore,
  getMinutesUntilDeadline,
  type AsyncPhase,
} from '@/services/asyncMatch.service';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { EXERCISE_LABELS } from '@/lib/config';
import { X, Zap, Clock } from 'lucide-react-native';
import type { Match } from '@/types/database';

type MatchPhase =
  | 'loading'
  | 'waiting'
  | 'countdown'
  | 'active'
  | 'finishing'
  | 'submission_window';

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
  const [deadlineMinutes, setDeadlineMinutes] = useState<number | null>(null);
  const [permission, requestPermission] = useCameraPermissions();

  const countdownAnim = useRef(new Animated.Value(1)).current;
  const repAnim = useRef(new Animated.Value(1)).current;
  const subscriptionRef = useRef<any>(null);
  const deadlineTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  console.log('[MatchScreen] render — phase:', phase, '| permission:', permission ? `granted=${permission.granted} canAsk=${permission.canAskAgain}` : 'null (loading)');

  const isChallenger = match?.challenger_id === session?.user?.id;
  const myReps = activeMatch?.myReps ?? 0;
  const timeLeft = activeMatch?.timeLeft ?? 60;

  // ── Derived async state ──────────────────────────────────────────────────
  const asyncPhase: AsyncPhase = match ? getAsyncPhase(match) : 'PENDING';

  const mySubmittedAt = match
    ? (isChallenger ? match.challenger_submitted_at : match.opponent_submitted_at)
    : null;
  const opponentSubmittedAt = match
    ? (isChallenger ? match.opponent_submitted_at : match.challenger_submitted_at)
    : null;

  const opponentSubmittedButIHavent = !!opponentSubmittedAt && !mySubmittedAt;

  // ── Deadline countdown ticker ────────────────────────────────────────────
  useEffect(() => {
    if (phase !== 'submission_window' || !match?.submission_deadline) return;

    const tick = () => setDeadlineMinutes(getMinutesUntilDeadline(match));
    tick();
    deadlineTimerRef.current = setInterval(tick, 30_000);

    return () => {
      if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    };
  }, [phase, match?.submission_deadline]);

  // ── Rep animation ────────────────────────────────────────────────────────
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

  // ── Timer complete: submit via async RPC instead of completing synchronously ──
  const handleMatchComplete = useCallback(async () => {
    if (!match || !session?.user) return;
    setPhase('finishing');

    const finalReps = useMatchStore.getState().activeMatch?.myReps ?? 0;

    try {
      const updated = await submitMatchScore(match.id, session.user.id, finalReps);
      setMatch(updated);
      setActiveMatch(updated);

      const newAsyncPhase = getAsyncPhase(updated);

      if (newAsyncPhase === 'COMPLETED') {
        // Both players have now submitted — go straight to results
        const opponentRepsValue = isChallenger ? updated.opponent_reps : updated.challenger_reps;
        const winnerId = updated.winner_id;
        router.replace({
          pathname: '/match/results',
          params: {
            matchId: match.id,
            myReps: finalReps.toString(),
            isWinner: (session.user.id === winnerId).toString(),
          },
        });
      } else {
        // Waiting for opponent — enter submission window phase
        setDeadlineMinutes(getMinutesUntilDeadline(updated));
        setPhase('submission_window');
      }
    } catch (err: any) {
      console.error('[MatchScreen] submitMatchScore error:', err);
      showToast({ type: 'error', title: err?.message ?? 'Error submitting score' });
      setPhase('active');
    }
  }, [match, session, isChallenger, router, showToast]);

  const { start: startTimer } = useMatchTimer({ onComplete: handleMatchComplete });

  // ── Load match on mount ──────────────────────────────────────────────────
  useEffect(() => {
    if (!id || !session?.user) return;
    loadMatch();
  }, [id]);

  async function loadMatch() {
    console.log('[MatchScreen] loadMatch — id:', id, '| user:', session?.user?.id);
    try {
      const m = await getMatch(id!);
      if (!m) throw new Error('Match not found');
      console.log('[MatchScreen] loadMatch — fetched match:', {
        id: m.id,
        status: m.status,
        exercise: m.exercise_type,
        challengerReady: m.challenger_ready,
        opponentReady: m.opponent_ready,
        challengerSubmitted: m.challenger_submitted_at,
        opponentSubmitted: m.opponent_submitted_at,
        deadline: m.submission_deadline,
      });
      setMatch(m);
      setActiveMatch(m);

      const ap = getAsyncPhase(m);

      if (ap === 'COMPLETED') {
        // Already completed — go to results
        const myFinalReps = isChallenger ? m.challenger_reps : m.opponent_reps;
        router.replace({
          pathname: '/match/results',
          params: {
            matchId: m.id,
            myReps: myFinalReps.toString(),
            isWinner: (session?.user?.id === m.winner_id).toString(),
          },
        });
        return;
      }

      if (ap === 'SUBMISSION_WINDOW') {
        setDeadlineMinutes(getMinutesUntilDeadline(m));
        setPhase('submission_window');
      } else if (ap === 'ACCEPTED' || ap === 'IN_PROGRESS') {
        setPhase('waiting');
      }

      subscriptionRef.current = subscribeToMatch(m.id, (updated) => {
        console.log('[MatchScreen] subscribeToMatch update — status:', updated.status,
          '| challengerReady:', updated.challenger_ready,
          '| opponentReady:', updated.opponent_ready,
          '| challengerSubmitted:', updated.challenger_submitted_at,
          '| opponentSubmitted:', updated.opponent_submitted_at);

        setMatch(updated);
        setActiveMatch(updated);

        const updatedPhase = getAsyncPhase(updated);

        if (updatedPhase === 'COMPLETED') {
          // Opponent submitted while we were waiting — go to results
          const isMyMatch = updated.challenger_id === session?.user?.id || updated.opponent_id === session?.user?.id;
          if (isMyMatch) {
            const myIsChallenger = updated.challenger_id === session?.user?.id;
            const myFinalReps = myIsChallenger ? updated.challenger_reps : updated.opponent_reps;
            router.replace({
              pathname: '/match/results',
              params: {
                matchId: updated.id,
                myReps: myFinalReps.toString(),
                isWinner: (session?.user?.id === updated.winner_id).toString(),
              },
            });
          }
          return;
        }

        if (updatedPhase === 'SUBMISSION_WINDOW') {
          setDeadlineMinutes(getMinutesUntilDeadline(updated));
          setPhase('submission_window');
          return;
        }

        // Both ready → start countdown
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
      if (deadlineTimerRef.current) clearInterval(deadlineTimerRef.current);
    };
  }, []);

  // ── Ready up ─────────────────────────────────────────────────────────────
  async function handleReady() {
    if (!match || !session?.user) return;
    console.log('[MatchScreen] handleReady — matchId:', match.id, '| isChallenger:', isChallenger);
    try {
      const updated = await setReady(match.id, session.user.id, isChallenger);
      console.log('[MatchScreen] handleReady — updated ready flags:', {
        challengerReady: updated.challenger_ready,
        opponentReady: updated.opponent_ready,
      });
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

  // ── Countdown 3…2…1 ──────────────────────────────────────────────────────
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

  // ── Phase label helper ───────────────────────────────────────────────────
  const phaseDimmed = (targetPhase: AsyncPhase) => asyncPhase !== targetPhase;

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
        {/* ── Top bar ── */}
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

        {/* ── Phase progress indicators ── */}
        <View style={styles.phaseRow}>
          {(['ACCEPTED', 'IN_PROGRESS', 'SUBMISSION_WINDOW', 'COMPLETED'] as AsyncPhase[]).map((p) => (
            <View
              key={p}
              style={[
                styles.phasePip,
                asyncPhase === p && styles.phasePipActive,
                phaseDimmed(p) && asyncPhase !== 'PENDING' && styles.phasePipDim,
              ]}
            >
              <Text style={[styles.phasePipText, asyncPhase === p && styles.phasePipTextActive]}>
                {p === 'ACCEPTED' ? 'Ready' :
                  p === 'IN_PROGRESS' ? 'Go' :
                  p === 'SUBMISSION_WINDOW' ? 'Pending' : 'Done'}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Match timer (active phase) ── */}
        {phase === 'active' && (
          <View style={styles.timerRow}>
            <Text style={[styles.timer, timeLeft <= 10 ? styles.timerUrgent : null]}>
              {formatTime(timeLeft)}
            </Text>
          </View>
        )}

        {/* ── Submission window countdown ── */}
        {phase === 'submission_window' && (
          <View style={styles.submissionWrap}>
            {opponentSubmittedButIHavent ? (
              <View style={styles.opponentSubmittedBanner}>
                <Clock size={20} color={colors.accent} />
                <Text style={styles.opponentSubmittedText}>
                  Opponent submitted!{' '}
                  {deadlineMinutes !== null
                    ? `You have ${deadlineMinutes} min to submit.`
                    : 'Submit your score now.'}
                </Text>
              </View>
            ) : (
              <Text style={styles.waitingTitle}>Score submitted!</Text>
            )}

            {deadlineMinutes !== null && (
              <View style={styles.deadlineRow}>
                <Clock
                  size={16}
                  color={deadlineMinutes < 15 ? colors.error : colors.textSecondary}
                />
                <Text
                  style={[
                    styles.deadlineText,
                    deadlineMinutes < 15 && styles.deadlineTextUrgent,
                  ]}
                >
                  {deadlineMinutes < 60
                    ? `${deadlineMinutes} min remaining`
                    : `${Math.floor(deadlineMinutes / 60)}h ${deadlineMinutes % 60}m remaining`}
                </Text>
              </View>
            )}

            {mySubmittedAt && (
              <Text style={styles.submittedConfirm}>
                Your score: {isChallenger ? match?.challenger_reps : match?.opponent_reps} reps
              </Text>
            )}

            <Text style={styles.waitingSubtext}>
              {opponentSubmittedButIHavent
                ? "Opponent's score is hidden until you submit."
                : 'Waiting for opponent to complete their set…'}
            </Text>
          </View>
        )}

        {/* ── Countdown ── */}
        {phase === 'countdown' && (
          <View style={styles.countdownWrap}>
            <Animated.Text
              style={[styles.countdownNum, { transform: [{ scale: countdownAnim }] }]}
            >
              {countdown}
            </Animated.Text>
            <Text style={styles.countdownLabel}>GET READY</Text>
          </View>
        )}

        {/* ── Waiting for ready ── */}
        {phase === 'waiting' && (
          <View style={styles.waitingWrap}>
            <Text style={styles.waitingTitle}>
              {isChallenger
                ? match?.challenger_ready ? 'Waiting for opponent...' : 'Tap ready when set!'
                : match?.opponent_ready ? 'Waiting for challenger...' : 'Tap ready when set!'}
            </Text>
          </View>
        )}

        {/* ── Loading ── */}
        {phase === 'loading' && (
          <View style={styles.waitingWrap}>
            <Text style={styles.waitingTitle}>Loading match...</Text>
          </View>
        )}

        {/* ── Active rep counter ── */}
        {phase === 'active' && (
          <View style={styles.repCountWrap}>
            <Animated.Text style={[styles.repCount, { transform: [{ scale: repAnim }] }]}>
              {myReps}
            </Animated.Text>
            <Text style={styles.repLabel}>REPS</Text>
          </View>
        )}

        {/* ── Bottom bar ── */}
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
  // ── Phase pip row ──────────────────────────────────────────────────────────
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    backgroundColor: 'rgba(8,12,20,0.5)',
  },
  phasePip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 3,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  phasePipActive: {
    backgroundColor: 'rgba(0,212,255,0.2)',
    borderColor: colors.primary,
  },
  phasePipDim: {
    opacity: 0.35,
  },
  phasePipText: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },
  phasePipTextActive: {
    color: colors.primary,
  },
  // ── Timers ─────────────────────────────────────────────────────────────────
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
  // ── Submission window ──────────────────────────────────────────────────────
  submissionWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  opponentSubmittedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accent,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
  },
  opponentSubmittedText: {
    flex: 1,
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.accent,
  },
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  deadlineText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  deadlineTextUrgent: {
    color: colors.error,
  },
  submittedConfirm: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.success,
  },
  waitingSubtext: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  // ── Countdown ──────────────────────────────────────────────────────────────
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
  // ── Waiting ────────────────────────────────────────────────────────────────
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
  // ── Rep counter ────────────────────────────────────────────────────────────
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
  // ── Bottom bar ─────────────────────────────────────────────────────────────
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
