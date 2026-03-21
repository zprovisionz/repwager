import { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Platform,
  AppState,
  AppStateStatus,
  Share,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withRepeat,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  getMatchForDisplay,
  submitReps,
  saveRepsLocally,
  getLocalReps,
  subscribeToMatch,
  buildMatchDisplay,
  cancelMatch,
} from '@/services/match.service';
import { recordMaskAndUpload, type VideoUploadProgress } from '@/services/video.service';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { BarlowText } from '@/components/ui/BarlowText';
import { X, Zap, Clock, CheckCircle, Send, Share2 } from 'lucide-react-native';
import type { MatchDisplay, RepEvent } from '@/types/database';

type AsyncPhase =
  | 'loading'
  | 'waiting_for_opponent'
  | 'window_open'
  | 'countdown'
  | 'recording'
  | 'reviewing'
  | 'submitting'
  | 'submitted_waiting'
  | 'reveal'
  | 'expired'
  | 'error';

function formatCountdown(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s.toString().padStart(2, '0')}s`;
  return `${s}s`;
}

export default function MatchScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [phase, setPhase] = useState<AsyncPhase>('loading');
  const [matchDisplay, setMatchDisplay] = useState<MatchDisplay | null>(null);
  const [countdown, setCountdown] = useState(3);
  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const [isUrgent, setIsUrgent] = useState(false);

  const [recordedReps, setRecordedReps] = useState(0);
  const [recordedEvents, setRecordedEvents] = useState<RepEvent[]>([]);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [showInvalidOverlay, setShowInvalidOverlay] = useState(false);
  const [showValidFlash, setShowValidFlash] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<VideoUploadProgress | null>(null);
  const eventsRef = useRef<RepEvent[]>([]);
  const recordingSecondsRef = useRef(0);

  const [permission, requestPermission] = useCameraPermissions();
  const subscriptionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownAnim = useSharedValue(1);
  const repAnim = useSharedValue(1);
  const lobbyPulse = useSharedValue(1);

  const handleRepCounted = useCallback(
    async (total: number) => {
      const event: RepEvent = {
        rep: total,
        valid: true,
        elbowAngle: 0,
        shoulderAngle: 0,
        timestamp: recordingSecondsRef.current,
      };
      eventsRef.current = [...eventsRef.current, event];
      setRecordedReps(total);
      setRecordedEvents(eventsRef.current);

      if (total % 5 === 0 && id) {
        await saveRepsLocally(id, total, eventsRef.current);
      }

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      repAnim.value = withSequence(
        withSpring(1.4, { damping: 8 }),
        withSpring(1, { damping: 10 })
      );
    },
    [id]
  );

  const { repCount, reset: resetPose, lastRepValid } = usePoseDetection({
    exerciseType: 'push_ups',
    onRepCounted: handleRepCounted,
    enabled: phase === 'recording',
  });

  useEffect(() => {
    if (lastRepValid === true && phase === 'recording') {
      setShowValidFlash(true);
      const t = setTimeout(() => setShowValidFlash(false), 220);
      return () => clearTimeout(t);
    }
    if (lastRepValid === false && phase === 'recording') {
      setShowInvalidOverlay(true);
      const t = setTimeout(() => setShowInvalidOverlay(false), 1500);
      return () => clearTimeout(t);
    }
  }, [lastRepValid, phase]);

  useEffect(() => {
    if (!id || !session?.user) return;
    loadMatch();
    return () => {
      subscriptionRef.current?.unsubscribe();
      clearAllTimers();
    };
  }, [id]);

  useEffect(() => {
    if (phase !== 'waiting_for_opponent') return;
    lobbyPulse.value = withRepeat(withTiming(1.14, { duration: 900 }), -1, true);
    return () => {
      lobbyPulse.value = 1;
    };
  }, [phase]);

  useEffect(() => {
    const sub = AppState.addEventListener(
      'change',
      async (nextState: AppStateStatus) => {
        if (nextState === 'active' && id && session?.user) {
          await loadMatch();
        }
      }
    );
    return () => sub.remove();
  }, [id, session?.user?.id]);

  function clearAllTimers() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
  }

  async function loadMatch() {
    if (!id || !session?.user) return;

    try {
      const display = await getMatchForDisplay(id, session.user.id);
      if (!display) {
        showToast({ type: 'error', title: 'Match not found' });
        router.back();
        return;
      }

      setMatchDisplay(display);
      determinePhase(display);

      if (!display.iHaveSubmitted) {
        const local = await getLocalReps(id);
        if (local && local.reps > 0) {
          setRecordedReps(local.reps);
          setRecordedEvents(local.repEvents);
          eventsRef.current = local.repEvents;
          showToast({
            type: 'info',
            title: 'Session recovered',
            message: `${local.reps} reps restored from last session`,
          });
        }
      }

      subscriptionRef.current = subscribeToMatch(id, (updatedMatch) => {
        if (!session?.user) return;
        const updatedDisplay = buildMatchDisplay(updatedMatch, session.user.id);
        setMatchDisplay(updatedDisplay);
        determinePhase(updatedDisplay);
      });
    } catch (err: any) {
      showToast({ type: 'error', title: 'Could not load match' });
      router.back();
    }
  }

  function determinePhase(display: MatchDisplay) {
    const { match, iHaveSubmitted, isExpired, isRevealed } = display;

    if (isRevealed) {
      setPhase('reveal');
      navigateToReveal(display);
      return;
    }
    if (isExpired || match.status === 'expired') {
      setPhase('expired');
      stopDeadlineTimer();
      return;
    }
    if (match.status === 'pending') {
      setPhase('waiting_for_opponent');
      return;
    }
    if (iHaveSubmitted) {
      setPhase('submitted_waiting');
      startDeadlineTimer(display);
      return;
    }
    if (
      match.status === 'accepted' ||
      match.status === 'challenger_submitted' ||
      match.status === 'opponent_submitted'
    ) {
      setPhase('window_open');
      startDeadlineTimer(display);
      return;
    }
  }

  function startDeadlineTimer(display: MatchDisplay) {
    stopDeadlineTimer();
    if (!display.match.submission_deadline) return;

    const tick = () => {
      const remaining = Math.floor(
        (new Date(display.match.submission_deadline!).getTime() - Date.now()) / 1000
      );
      if (remaining <= 0) {
        setTimeRemaining(0);
        setPhase('expired');
        stopDeadlineTimer();
        return;
      }
      setTimeRemaining(remaining);
      setIsUrgent(remaining < 1800);
    };

    tick();
    timerRef.current = setInterval(tick, 1000);
  }

  function stopDeadlineTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }

  function navigateToReveal(display: MatchDisplay) {
    router.replace({
      pathname: '/match/reveal',
      params: {
        matchId: display.match.id,
        myReps: (display.myReps ?? 0).toString(),
        opponentReps: (display.opponentReps ?? 0).toString(),
        isWinner: (
          display.match.winner_id === session?.user?.id
        ).toString(),
      },
    });
  }

  function startCountdown() {
    setPhase('countdown');
    setCountdown(3);
    resetPose();
    setRecordedReps(0);
    setRecordedEvents([]);
    eventsRef.current = [];
    setRecordingSeconds(0);
    recordingSecondsRef.current = 0;

    let count = 3;
    const tick = () => {
      countdownAnim.value = withSequence(
        withSpring(1.5, { damping: 8 }),
        withTiming(0.8, { duration: 700 })
      );

      if (count > 1) {
        count--;
        setCountdown(count);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        setTimeout(tick, 1000);
      } else {
        setTimeout(() => {
          setPhase('recording');
          startRecordingTimer();
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }, 1000);
      }
    };
    tick();
  }

  async function handleShareChallenge() {
    if (!matchDisplay?.match?.id) return;
    const link = `repwager://challenge/${matchDisplay.match.id}`;
    await Share.share({
      message: `I just opened a RepWager challenge. Accept it: ${link}`,
    });
  }

  async function handleCancelPendingChallenge() {
    if (!matchDisplay?.match?.id) return;
    try {
      await cancelMatch(matchDisplay.match.id);
      showToast({
        type: 'success',
        title: 'Challenge cancelled',
        message: 'Your RepCoins were returned.',
      });
      router.replace('/(tabs)');
    } catch {
      showToast({ type: 'error', title: 'Could not cancel challenge' });
    }
  }

  function startRecordingTimer() {
    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((s) => {
        recordingSecondsRef.current = s + 1;
        return s + 1;
      });
    }, 1000);
  }

  function stopRecording() {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setPhase('reviewing');
  }

  async function handleSubmit() {
    if (!id || !session?.user) return;
    setPhase('submitting');

    // Attempt video upload (non-blocking failure — submission proceeds regardless)
    try {
      await recordMaskAndUpload(id, session.user.id, 'skipped', (p) => {
        setUploadStatus(p);
      });
    } catch {
      // Upload failure does not block rep submission
    }

    try {
      const result = await submitReps(
        id,
        session.user.id,
        recordedReps,
        recordedEvents
      );

      if (result.revealed) {
        router.replace({
          pathname: '/match/reveal',
          params: {
            matchId: id,
            myReps: result.my_reps.toString(),
            opponentReps: (result.opponent_reps ?? 0).toString(),
            isWinner: (result.winner_id === session.user.id).toString(),
          },
        });
      } else {
        setPhase('submitted_waiting');
        showToast({
          type: 'success',
          title: 'Reps locked in!',
          message: `${result.my_reps} reps submitted. Waiting for opponent.`,
        });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Submission failed',
        message: err.message,
      });
      setPhase('reviewing');
    }
  }

  const countdownAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: countdownAnim.value }],
  }));

  const repAnimStyle = useAnimatedStyle(() => ({
    transform: [{ scale: repAnim.value }],
  }));
  const lobbyPulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: lobbyPulse.value }],
    opacity: lobbyPulse.value > 1.08 ? 0.75 : 1,
  }));

  if (!permission) return <View style={styles.fill} />;

  if (!permission.granted) {
    return (
      <View style={[styles.fill, styles.center]}>
        <Text style={styles.permText}>
          Camera access needed to count your reps.
        </Text>
        <TouchableOpacity
          style={styles.permBtn}
          onPress={requestPermission}
        >
          <Text style={styles.permBtnText}>Allow Camera</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const match = matchDisplay?.match;

  return (
    <View style={styles.fill}>
      {(phase === 'recording' || phase === 'countdown') &&
      Platform.OS !== 'web' ? (
        <CameraView style={StyleSheet.absoluteFill} facing="front" />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.cameraBg]} />
      )}

      <View style={[StyleSheet.absoluteFill, styles.overlay]}>
        <View
          style={[
            styles.topBar,
            { paddingTop: insets.top + spacing.sm },
          ]}
        >
          <TouchableOpacity
            onPress={() => router.back()}
            style={styles.closeBtn}
          >
            <X size={18} color={colors.text} />
          </TouchableOpacity>

          <View style={styles.exerciseBadge}>
            <Zap size={12} color={colors.primary} />
            <Text style={styles.exerciseLabel}>Push-Ups</Text>
          </View>

          <View style={styles.wagerBadge}>
            <Text style={styles.wagerLabel}>
              {match?.wager_amount ?? 0} RC
            </Text>
          </View>
        </View>

        {timeRemaining !== null &&
          (phase === 'window_open' || phase === 'submitted_waiting') && (
            <View style={styles.deadlineRow}>
              <Clock
                size={13}
                color={isUrgent ? colors.secondary : colors.textMuted}
              />
              <Text
                style={[
                  styles.deadlineText,
                  isUrgent && { color: colors.secondary },
                ]}
              >
                {formatCountdown(timeRemaining)} remaining
              </Text>
            </View>
          )}

        {phase === 'loading' && (
          <View style={styles.centreContent}>
            <Text style={styles.phaseTitle}>Loading match...</Text>
          </View>
        )}

        {phase === 'waiting_for_opponent' && (
          <View style={styles.centreContent}>
            <Animated.View style={[styles.waitingPulse, lobbyPulseStyle]} />
            <Text style={styles.phaseTitle}>Waiting for opponent</Text>
            <Text style={styles.phaseSubtitle}>
              Share your challenge to find an opponent faster
            </Text>
            <View style={styles.waitingActions}>
              <TouchableOpacity
                style={styles.waitingShareBtn}
                onPress={handleShareChallenge}
              >
                <Share2 size={14} color={colors.primary} />
                <Text style={styles.waitingShareText}>Share Challenge</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.waitingCancelBtn}
                onPress={handleCancelPendingChallenge}
              >
                <Text style={styles.waitingCancelText}>Cancel Challenge</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {phase === 'window_open' && (
          <View style={styles.centreContent}>
            {matchDisplay?.opponentHasSubmitted ? (
              <>
                <View style={styles.opponentSubmittedBadge}>
                  <CheckCircle size={20} color={colors.success} />
                  <Text style={styles.opponentSubmittedText}>
                    Opponent submitted!
                  </Text>
                </View>
                <Text style={styles.phaseSubtitle}>
                  Their score is locked. Beat it.
                </Text>
              </>
            ) : (
              <Text style={styles.phaseSubtitle}>
                Record your set whenever you're ready.{'\n'}
                You have{' '}
                {timeRemaining !== null
                  ? formatCountdown(timeRemaining)
                  : '2 hours'}.
              </Text>
            )}
          </View>
        )}

        {phase === 'countdown' && (
          <View style={styles.centreContent}>
            <Animated.Text
              style={[styles.countdownNum, countdownAnimStyle]}
            >
              {countdown}
            </Animated.Text>
            <Text style={styles.countdownLabel}>GET READY</Text>
          </View>
        )}

        {phase === 'recording' && (
          <View style={styles.centreContent}>
            <BarlowText variant="label" color={colors.primary} style={styles.poseNotice}>
              Pose detection active
            </BarlowText>
            {showValidFlash && <View style={styles.validFlash} />}
            {showInvalidOverlay && (
              <View style={styles.invalidOverlay}>
                <Text style={styles.invalidOverlayText}>INVALID - go deeper</Text>
              </View>
            )}
            <Animated.Text style={[styles.repCount, repAnimStyle]}>
              {repCount}
            </Animated.Text>
            <Text style={styles.repLabel}>REPS</Text>
          </View>
        )}

        {phase === 'reviewing' && (
          <View style={styles.centreContent}>
            <Text style={styles.reviewTitle}>YOUR DETECTED SCORE</Text>
            <Text style={styles.reviewReps}>{recordedReps}</Text>
            <Text style={styles.reviewRepsLabel}>reps (pose pipeline)</Text>
            <Text style={styles.reviewNote}>
              Dispute from Theatre if something looks off. No manual rep entry — score locks on submit.
            </Text>
          </View>
        )}

        {phase === 'submitting' && (
          <View style={styles.centreContent}>
            <Send size={40} color={colors.primary} />
            <Text style={styles.phaseTitle}>Locking in your reps...</Text>
            {uploadStatus && uploadStatus.status === 'uploading' && (
              <Text style={styles.uploadStatusText}>
                Uploading video... {uploadStatus.progress}%
              </Text>
            )}
            {uploadStatus && uploadStatus.status === 'masking' && (
              <Text style={styles.uploadStatusText}>Processing video...</Text>
            )}
          </View>
        )}

        {phase === 'submitted_waiting' && (
          <View style={styles.centreContent}>
            <CheckCircle size={48} color={colors.success} />
            <Text style={styles.phaseTitle}>
              {matchDisplay?.myReps ?? recordedReps} reps locked in
            </Text>
            <Text style={styles.phaseSubtitle}>
              Waiting for opponent to submit.{'\n'}
              You'll be notified when scores reveal.
            </Text>
          </View>
        )}

        {phase === 'expired' && (
          <View style={styles.centreContent}>
            <Clock size={48} color={colors.textMuted} />
            <Text style={styles.phaseTitle}>Window Expired</Text>
            <Text style={styles.phaseSubtitle}>
              The submission window closed.{'\n'}
              Your RepCoins have been refunded.
            </Text>
          </View>
        )}

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: insets.bottom + spacing.md },
          ]}
        >
          {phase === 'window_open' && (
            <TouchableOpacity
              style={styles.primaryAction}
              onPress={startCountdown}
            >
              <Text style={styles.primaryActionText}>
                {matchDisplay?.opponentHasSubmitted
                  ? 'Record Now — Beat Their Score'
                  : 'Start Recording'}
              </Text>
            </TouchableOpacity>
          )}

          {phase === 'recording' && (
            <View style={styles.recordingActions}>
              <Text style={styles.poseOnlyNote}>Pose-only reps — no manual counter</Text>
              <TouchableOpacity
                style={styles.doneBtn}
                onPress={stopRecording}
              >
                <Text style={styles.doneBtnText}>Done</Text>
              </TouchableOpacity>
            </View>
          )}

          {phase === 'reviewing' && (
            <View style={styles.reviewActions}>
              <TouchableOpacity
                style={styles.retryBtn}
                onPress={() => {
                  setPhase('window_open');
                  resetPose();
                  setRecordedReps(0);
                  setRecordedEvents([]);
                  eventsRef.current = [];
                }}
              >
                <Text style={styles.retryBtnText}>Re-record</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={handleSubmit}
              >
                <Text style={styles.submitBtnText}>
                  Submit {recordedReps} Reps
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {(phase === 'waiting_for_opponent' ||
            phase === 'submitted_waiting' ||
            phase === 'expired') && (
            <TouchableOpacity
              style={styles.backBtn}
              onPress={() => router.replace('/(tabs)')}
            >
              <Text style={styles.backBtnText}>Back to Home</Text>
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
  cameraBg: { backgroundColor: colors.bg },
  overlay: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    backgroundColor: 'rgba(8,12,20,0.75)',
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
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,212,255,0.15)',
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
    backgroundColor: 'rgba(255,184,0,0.15)',
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
  deadlineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    alignSelf: 'center',
    marginTop: spacing.sm,
    backgroundColor: 'rgba(8,12,20,0.6)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  deadlineText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  centreContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  phaseTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 22,
    color: colors.text,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  phaseSubtitle: {
    fontFamily: typography.fontBody,
    fontSize: 15,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
  },
  waitingPulse: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.primary,
    marginBottom: spacing.md,
  },
  waitingActions: {
    marginTop: spacing.md,
    alignItems: 'center',
    gap: spacing.sm,
  },
  waitingShareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.12)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  waitingShareText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.primary,
  },
  waitingCancelBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  waitingCancelText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  opponentSubmittedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: 'rgba(0,255,136,0.1)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderWidth: 1,
    borderColor: colors.success,
  },
  opponentSubmittedText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.success,
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
  },
  poseNotice: {
    position: 'absolute',
    top: '18%',
    letterSpacing: 2,
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
  validFlash: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34,197,94,0.20)',
    borderRadius: radius.lg,
  },
  invalidOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.22)',
    borderRadius: radius.lg,
  },
  invalidOverlayText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 20,
    color: '#FCA5A5',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  reviewTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.text,
    letterSpacing: 1,
  },
  reviewReps: {
    fontFamily: typography.fontDisplay,
    fontSize: 80,
    color: colors.primary,
  },
  reviewRepsLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
    letterSpacing: 2,
  },
  reviewNote: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.md,
    backgroundColor: 'rgba(8,12,20,0.75)',
    gap: spacing.sm,
  },
  primaryAction: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  primaryActionText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  recordingActions: { gap: spacing.sm, alignItems: 'stretch' },
  poseOnlyNote: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.xs,
  },
  devCountBtn: {
    backgroundColor: colors.secondary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  devCountBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.text,
  },
  doneBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  doneBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  retryBtn: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  retryBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  submitBtn: {
    flex: 2,
    backgroundColor: colors.success,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    shadowColor: colors.success,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  submitBtnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textInverse,
    letterSpacing: 1,
  },
  backBtn: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  backBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  uploadStatusText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
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
