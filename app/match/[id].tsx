import { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch, submitMatchScore, subscribeToMatch, isMatchExpired } from '@/services/match.service';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { FormFeedback } from '@/components/FormFeedback'; // Phase 4
import { colors, typography, spacing, radius } from '@/lib/theme';
import { EXERCISE_LABELS, DEV_MODE_ENABLED } from '@/lib/config';
import { X, Zap, Clock, Check, AlertCircle } from 'lucide-react-native';
import type { Match } from '@/types/database';

type MatchPhase = 'loading' | 'pre_record' | 'recording' | 'submitted' | 'expired' | 'results';

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const { setActiveMatch, updateMyReps, activeMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [phase, setPhase] = useState<MatchPhase>('loading');
  const [match, setMatch] = useState<Match | null>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const subscriptionRef = useRef<any>(null);

  const isChallenger = match?.challenger_id === session?.user?.id;
  const myReps = activeMatch?.myReps ?? 0;
  const timeLeft = activeMatch?.timeLeft ?? 60;

  // Deadline countdown state
  const [secondsUntilDeadline, setSecondsUntilDeadline] = useState(0);

  const repAnim = useRef(new Animated.Value(1)).current;

  const handleRepCounted = useCallback((total: number) => {
    if (DEV_MODE_ENABLED) console.log('[MatchScreen] handleRepCounted — total:', total);
    updateMyReps(total);
    Animated.sequence([
      Animated.timing(repAnim, { toValue: 1.4, duration: 80, useNativeDriver: true }),
      Animated.spring(repAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [updateMyReps, repAnim]);

  const {
    repCount,
    isReady: poseReady,
    processFrame,
    processFrameFromImage,
    manualIncrement,
    reset: resetPose,
    detectionError,
    lastFormQuality,
    lastFormIssues,
    velocityWarning, // Phase 3
  } = usePoseDetection({
    exerciseType: match?.exercise_type ?? 'push_ups',
    onRepCounted: handleRepCounted,
    enabled: phase === 'recording',
  });

  // Handle camera frame for pose detection
  const handleCameraFrame = useCallback(
    (frame: any) => {
      if (phase !== 'recording' || !poseReady) {
        return;
      }

      try {
        // On native, frame has data that we need to convert
        // On web, we might have canvas data
        if (Platform.OS === 'web') {
          // Web: convert canvas to image source
          // This is handled by processFrameFromImage when given canvas
          return;
        }

        // Native: process frame data
        // The frame object has pixel data we can use
        processFrameFromImage(frame);
      } catch (error) {
        console.error('[MatchScreen] Camera frame processing error:', error);
      }
    },
    [phase, poseReady, processFrameFromImage]
  );

  // Determine current phase based on match state
  const determinePhase = (m: Match): MatchPhase => {
    if (!session?.user) return 'loading';

    // Check if expired
    if (isMatchExpired(m)) {
      return 'expired';
    }

    // Check if completed (both submitted, winner determined)
    if (m.status === 'completed') {
      return 'results';
    }

    // Check if current user has submitted
    const userSubmitted = isChallenger ? m.challenger_ready : m.opponent_ready;
    if (userSubmitted) {
      return 'submitted';
    }

    // Not submitted yet
    return 'pre_record';
  };

  // Auto-submit when timer expires (60 seconds)
  const handleAutoSubmit = useCallback(async () => {
    if (!match || !session?.user) return;
    const finalReps = useMatchStore.getState().activeMatch?.myReps ?? 0;
    await submitScore(finalReps);
  }, [match, session]);

  const { start: startTimer } = useMatchTimer({ onComplete: handleAutoSubmit });

  // Fetch match and setup realtime subscription
  useEffect(() => {
    if (!id || !session?.user) return;
    loadMatch();
  }, [id, session]);

  async function loadMatch() {
    if (DEV_MODE_ENABLED) console.log('[MatchScreen] loadMatch — id:', id, '| user:', session?.user?.id);
    try {
      const m = await getMatch(id!);
      if (!m) throw new Error('Match not found');
      if (DEV_MODE_ENABLED) console.log('[MatchScreen] loadMatch — fetched match:', { id: m.id, status: m.status, exercise: m.exercise_type });
      setMatch(m);
      setActiveMatch(m);

      const initialPhase = determinePhase(m);
      setPhase(initialPhase);

      // Setup realtime subscription to watch for opponent submission
      subscriptionRef.current = subscribeToMatch(m.id, (updated) => {
        if (DEV_MODE_ENABLED) console.log('[MatchScreen] subscribeToMatch update — status:', updated.status, '| challenger_ready:', updated.challenger_ready, '| opponent_ready:', updated.opponent_ready);
        setMatch(updated);

        // Auto-advance phase based on updated match state
        const newPhase = determinePhase(updated);
        setPhase(newPhase);

        // If status changed to completed, show results
        if (updated.status === 'completed') {
          showToast({ type: 'success', title: 'Match completed!' });
        }
      });
    } catch (err) {
      console.error('[MatchScreen] loadMatch error:', err);
      showToast({ type: 'error', title: 'Match not found' });
      router.back();
    }
  }

  // Cleanup subscription on unmount
  useEffect(() => {
    return () => {
      subscriptionRef.current?.unsubscribe();
    };
  }, []);

  // Update deadline countdown every second
  useEffect(() => {
    if (!match || phase === 'loading' || phase === 'results') return;

    const interval = setInterval(() => {
      if (match?.submission_deadline) {
        const deadlineTime = new Date(match.submission_deadline).getTime();
        const nowTime = new Date().getTime();
        const secondsLeft = Math.max(0, Math.floor((deadlineTime - nowTime) / 1000));
        setSecondsUntilDeadline(secondsLeft);

        // If deadline passed, phase will be determined as 'expired' on next subscription update
        if (secondsLeft <= 0 && phase !== 'expired') {
          setPhase('expired');
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [match, phase]);

  // Submit score to database
  const submitScore = async (reps: number) => {
    if (!match || !session?.user) {
      showToast({ type: 'error', title: 'Error: Missing match or user' });
      return;
    }

    try {
      const updated = await submitMatchScore(match.id, session.user.id, reps);
      if (DEV_MODE_ENABLED) console.log('[MatchScreen] submitScore success:', { id: updated.id, status: updated.status });
      setMatch(updated);

      // If completed, show results
      if (updated.status === 'completed') {
        setPhase('results');
      } else {
        // Move to submitted phase, wait for opponent
        setPhase('submitted');
      }
    } catch (err) {
      console.error('[MatchScreen] submitScore error:', err);
      showToast({ type: 'error', title: 'Failed to submit score' });
    }
  };

  // Start recording
  const handleStartRecording = () => {
    if (DEV_MODE_ENABLED) console.log('[MatchScreen] handleStartRecording');
    setPhase('recording');
    resetPose();
    startTimer();
  };

  // Format time display
  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // Format deadline countdown
  const formatDeadline = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m ${secs}s`;
  };

  // Camera permission check
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
        {/* Top Bar */}
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

        {/* Center Content based on Phase */}

        {/* PRE-RECORD PHASE: Show exercise info + deadline + start button */}
        {phase === 'pre_record' && match && (
          <View style={styles.centerContent}>
            <View style={styles.infoCard}>
              <Text style={styles.phaseTitle}>Get Ready to Record</Text>
              <Text style={styles.phaseSubtitle}>{EXERCISE_LABELS[match.exercise_type]}</Text>

              <View style={styles.infoRow}>
                <Clock size={16} color={colors.accent} />
                <Text style={styles.infoText}>Deadline in {formatDeadline(secondsUntilDeadline)}</Text>
              </View>

              <View style={styles.infoRow}>
                <Zap size={16} color={colors.primary} />
                <Text style={styles.infoText}>60 seconds to record</Text>
              </View>

              <Text style={styles.infoDescription}>Tap START when ready to begin your 60-second recording.</Text>
            </View>
          </View>
        )}

        {/* RECORDING PHASE: Show timer + rep count */}
        {phase === 'recording' && (
          <>
            <View style={styles.timerRow}>
              <Text style={[styles.timer, timeLeft <= 10 ? styles.timerUrgent : null]}>
                {formatTime(timeLeft)}
              </Text>
            </View>

            <View style={styles.repCountWrap}>
              <Animated.Text style={[styles.repCount, { transform: [{ scale: repAnim }] }]}>
                {myReps}
              </Animated.Text>
              <Text style={styles.repLabel}>REPS</Text>
            </View>

            {/* Phase 4: FormFeedback component for real-time quality display */}
            <FormFeedback
              formQuality={lastFormQuality}
              formIssues={lastFormIssues}
              velocityWarning={velocityWarning}
              enabled={poseReady && !detectionError}
            />

            {detectionError && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>⚠️ {detectionError}</Text>
                <Text style={styles.errorSubtext}>Using manual counting as fallback</Text>
              </View>
            )}

            {!detectionError && !poseReady && (
              <View style={styles.loadingBanner}>
                <Text style={styles.loadingText}>Initializing pose detection...</Text>
              </View>
            )}
          </>
        )}

        {/* SUBMITTED PHASE: Show your reps + waiting for opponent + deadline */}
        {phase === 'submitted' && (
          <View style={styles.centerContent}>
            <View style={styles.submitCard}>
              <View style={styles.submittedBadge}>
                <Check size={20} color={colors.success} />
                <Text style={styles.submittedText}>SUBMITTED</Text>
              </View>

              <View style={styles.scoreDisplay}>
                <Text style={styles.scoreLabel}>Your Reps</Text>
                <Text style={styles.scoreBig}>{myReps}</Text>
              </View>

              <View style={styles.waitingBox}>
                <Text style={styles.waitingText}>Waiting for opponent...</Text>
              </View>

              <View style={styles.deadlineBox}>
                <Clock size={14} color={colors.accent} />
                <Text style={styles.deadlineText}>Opponent has {formatDeadline(secondsUntilDeadline)} to submit</Text>
              </View>

              <Text style={styles.hiddenOpponentText}>Opponent's score is hidden until they submit</Text>
            </View>
          </View>
        )}

        {/* EXPIRED PHASE: Deadline passed */}
        {phase === 'expired' && (
          <View style={styles.centerContent}>
            <View style={styles.expiredCard}>
              <AlertCircle size={48} color={colors.error} />
              <Text style={styles.expiredTitle}>Deadline Passed</Text>
              <Text style={styles.expiredText}>
                The submission window has closed. Both players have been refunded their wager.
              </Text>
            </View>
          </View>
        )}

        {/* RESULTS PHASE: Show both scores and winner */}
        {phase === 'results' && match && (
          <View style={styles.centerContent}>
            <View style={styles.resultsCard}>
              <Text style={styles.resultsTitle}>Match Results</Text>

              <View style={styles.scoreComparison}>
                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreColumnLabel}>You</Text>
                  <Text style={[styles.scoreColumnValue, isChallenger && myReps > (match.opponent_reps ?? 0) ? styles.scoreColumnWinner : null]}>
                    {myReps}
                  </Text>
                  <Text style={styles.scoreColumnUnit}>reps</Text>
                </View>

                <Text style={styles.vsText}>vs</Text>

                <View style={styles.scoreColumn}>
                  <Text style={styles.scoreColumnLabel}>Opponent</Text>
                  <Text style={[styles.scoreColumnValue, !isChallenger && (match.opponent_reps ?? 0) > myReps ? styles.scoreColumnWinner : null]}>
                    {match.opponent_reps ?? 0}
                  </Text>
                  <Text style={styles.scoreColumnUnit}>reps</Text>
                </View>
              </View>

              <View style={styles.winnerRow}>
                {match.winner_id === session?.user?.id ? (
                  <>
                    <Text style={styles.winnerText}>🎉 You Won! 🎉</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.loserText}>😢 Better luck next time</Text>
                  </>
                )}
              </View>
            </View>
          </View>
        )}

        {/* LOADING PHASE */}
        {phase === 'loading' && (
          <View style={styles.centerContent}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        )}

        {/* Bottom Bar with Action Buttons */}
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
          {phase === 'pre_record' && (
            <TouchableOpacity style={styles.actionBtn} onPress={handleStartRecording}>
              <Text style={styles.actionBtnText}>START RECORDING</Text>
            </TouchableOpacity>
          )}

          {phase === 'recording' && (
            <TouchableOpacity style={styles.devBtn} onPress={manualIncrement}>
              <Text style={styles.devBtnText}>TAP TO COUNT REP</Text>
            </TouchableOpacity>
          )}

          {phase === 'expired' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.back()}>
              <Text style={styles.actionBtnText}>BACK TO HOME</Text>
            </TouchableOpacity>
          )}

          {phase === 'results' && (
            <TouchableOpacity style={styles.actionBtn} onPress={() => router.push('/')}>
              <Text style={styles.actionBtnText}>BACK TO HOME</Text>
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

  // Center content wrapper
  centerContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },

  // PRE-RECORD PHASE
  infoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  phaseTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 20,
    color: colors.text,
    textAlign: 'center',
  },
  phaseSubtitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.primary,
    textAlign: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  infoText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  infoDescription: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.sm,
  },

  // RECORDING PHASE
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
  formBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
  formBadgeGood: { backgroundColor: 'rgba(34,197,94,0.25)' },
  formBadgeOk: { backgroundColor: 'rgba(255,184,0,0.25)' },
  formBadgeBad: { backgroundColor: 'rgba(255,59,48,0.25)' },
  formBadgeText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.text,
    letterSpacing: 0.5,
  },

  // SUBMITTED PHASE
  submitCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    width: '100%',
  },
  submittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(34,197,94,0.1)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignSelf: 'center',
  },
  submittedText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 12,
    color: colors.success,
    letterSpacing: 1,
  },
  scoreDisplay: {
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.md,
  },
  scoreLabel: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
  },
  scoreBig: {
    fontFamily: typography.fontDisplay,
    fontSize: 56,
    color: colors.primary,
  },
  waitingBox: {
    backgroundColor: 'rgba(0,212,255,0.05)',
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
  },
  waitingText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.primary,
    textAlign: 'center',
  },
  deadlineBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255,184,0,0.05)',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
  },
  deadlineText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.accent,
  },
  hiddenOpponentText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    fontStyle: 'italic',
  },

  // EXPIRED PHASE
  expiredCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  expiredTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 20,
    color: colors.error,
  },
  expiredText: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // RESULTS PHASE
  resultsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.lg,
    width: '100%',
  },
  resultsTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 18,
    color: colors.text,
    textAlign: 'center',
  },
  scoreComparison: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.lg,
  },
  scoreColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreColumnLabel: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
  },
  scoreColumnValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 48,
    color: colors.text,
  },
  scoreColumnWinner: {
    color: colors.success,
  },
  scoreColumnUnit: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  vsText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  winnerRow: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  winnerText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 20,
    color: colors.success,
  },
  loserText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // LOADING PHASE
  loadingText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.textSecondary,
  },

  // Bottom Bar
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(8,12,20,0.7)',
  },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  actionBtnText: {
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
  errorBanner: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(255, 59, 48, 0.9)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
  errorText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: '#fff',
  },
  errorSubtext: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: spacing.xs,
  },
  loadingBanner: {
    position: 'absolute',
    bottom: 100,
    left: spacing.lg,
    right: spacing.lg,
    backgroundColor: 'rgba(0, 212, 255, 0.9)',
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
  },
});
