import { useState, useRef, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, Animated, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { X, Dumbbell, Check } from 'lucide-react-native';
import { useAuthStore } from '@/stores/authStore';
import { usePoseDetection } from '@/hooks/usePoseDetection';
import { recordPracticeSession } from '@/services/practice.service';

const DURATION = 60;

type PracticePhase = 'select' | 'recording' | 'done';

interface QuickPracticeModalProps {
  visible: boolean;
  onClose: () => void;
}

export default function QuickPracticeModal({ visible, onClose }: QuickPracticeModalProps) {
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const [permission, requestPermission] = useCameraPermissions();
  const [exercise, setExercise] = useState<'push_ups' | 'squats'>('push_ups');
  const [phase, setPhase] = useState<PracticePhase>('select');
  const [timeLeft, setTimeLeft] = useState(DURATION);
  const [finalReps, setFinalReps] = useState(0);
  const repAnim = useRef(new Animated.Value(1)).current;
  const latestRepsRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleRepCounted = useCallback((total: number) => {
    latestRepsRef.current = total;
    Animated.sequence([
      Animated.timing(repAnim, { toValue: 1.35, duration: 70, useNativeDriver: true }),
      Animated.spring(repAnim, { toValue: 1, useNativeDriver: true }),
    ]).start();
  }, [repAnim]);

  const { repCount, manualIncrement, reset: resetPose } = usePoseDetection({
    exerciseType: exercise,
    onRepCounted: handleRepCounted,
    enabled: phase === 'recording',
  });

  async function handleTimerDone() {
    const reps = latestRepsRef.current;
    setFinalReps(reps);
    setPhase('done');
    if (session?.user && reps > 0) {
      try {
        await recordPracticeSession(session.user.id, exercise, reps);
      } catch {}
    }
  }

  useEffect(() => {
    if (phase !== 'recording') return;
    setTimeLeft(DURATION);
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          handleTimerDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  function handleStart() {
    latestRepsRef.current = 0;
    resetPose();
    setPhase('recording');
  }

  function handleClose() {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase('select');
    setTimeLeft(DURATION);
    resetPose();
    onClose();
  }

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

  return (
    <Modal visible={visible} transparent={false} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {Platform.OS !== 'web' && phase === 'recording' && (
          <CameraView style={StyleSheet.absoluteFill} facing="front" />
        )}

        <View style={[StyleSheet.absoluteFill, styles.overlay]}>
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
              <X size={20} color={colors.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>QUICK PRACTICE</Text>
            <View style={{ width: 36 }} />
          </View>

          {phase === 'select' && (
            <View style={styles.center}>
              <View style={styles.card}>
                <Dumbbell size={40} color={colors.primary} />
                <Text style={styles.cardTitle}>Choose Exercise</Text>
                <View style={styles.exerciseRow}>
                  {(['push_ups', 'squats'] as const).map((ex) => (
                    <TouchableOpacity
                      key={ex}
                      style={[styles.exBtn, exercise === ex && styles.exBtnActive]}
                      onPress={() => setExercise(ex)}
                    >
                      <Text style={[styles.exBtnText, exercise === ex && styles.exBtnTextActive]}>
                        {ex === 'push_ups' ? 'Push-Ups' : 'Squats'}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <Text style={styles.hint}>60 seconds · No wager · Saves to your history</Text>
                {permission && !permission.granted && (
                  <TouchableOpacity onPress={requestPermission} style={styles.permBtn}>
                    <Text style={styles.permBtnText}>Allow Camera</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={styles.startBtn} onPress={handleStart}>
                  <Text style={styles.startBtnText}>START</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {phase === 'recording' && (
            <>
              <View style={styles.timerRow}>
                <Text style={[styles.timer, timeLeft <= 10 && styles.timerUrgent]}>
                  {formatTime(timeLeft)}
                </Text>
              </View>
              <View style={styles.repWrap}>
                <Animated.Text style={[styles.repCount, { transform: [{ scale: repAnim }] }]}>
                  {repCount}
                </Animated.Text>
                <Text style={styles.repLabel}>REPS</Text>
              </View>
              <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
                <TouchableOpacity style={styles.tapBtn} onPress={manualIncrement}>
                  <Text style={styles.tapBtnText}>TAP TO COUNT REP</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          {phase === 'done' && (
            <View style={styles.center}>
              <View style={styles.card}>
                <View style={styles.checkCircle}>
                  <Check size={36} color={colors.success} />
                </View>
                <Text style={styles.cardTitle}>Session Saved!</Text>
                <Text style={styles.finalReps}>{finalReps}</Text>
                <Text style={styles.finalLabel}>
                  {exercise === 'push_ups' ? 'Push-Up' : 'Squat'} reps
                </Text>
                <TouchableOpacity style={styles.startBtn} onPress={handleClose}>
                  <Text style={styles.startBtnText}>DONE</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  overlay: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(8,12,20,0.7)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  headerTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 13, color: colors.text, letterSpacing: 2,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing.lg },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.xl,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
  },
  cardTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 18, color: colors.text,
  },
  exerciseRow: { flexDirection: 'row', gap: spacing.sm, width: '100%' },
  exBtn: {
    flex: 1, paddingVertical: spacing.sm, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  exBtnActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  exBtnText: { fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.textSecondary },
  exBtnTextActive: { color: colors.textInverse },
  hint: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textMuted, textAlign: 'center' },
  permBtn: {
    backgroundColor: colors.bgElevated, borderRadius: radius.md,
    paddingVertical: spacing.sm, paddingHorizontal: spacing.lg,
    borderWidth: 1, borderColor: colors.border,
  },
  permBtnText: { fontFamily: typography.fontBodyMedium, fontSize: 13, color: colors.text },
  startBtn: {
    backgroundColor: colors.primary, borderRadius: radius.md,
    paddingVertical: spacing.md, paddingHorizontal: spacing.xl,
    width: '100%', alignItems: 'center',
  },
  startBtnText: {
    fontFamily: typography.fontDisplay, fontSize: 14,
    color: colors.textInverse, letterSpacing: 2,
  },
  timerRow: { alignItems: 'center', marginTop: spacing.lg },
  timer: {
    fontFamily: typography.fontDisplay, fontSize: 52,
    color: colors.text, letterSpacing: 2,
  },
  timerUrgent: { color: colors.error },
  repWrap: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  repCount: {
    fontFamily: typography.fontDisplay, fontSize: 120,
    color: colors.success,
    textShadowColor: colors.success,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  repLabel: {
    fontFamily: typography.fontDisplayMedium, fontSize: 18,
    color: colors.successDark, letterSpacing: 6,
  },
  bottomBar: {
    paddingHorizontal: spacing.xl, paddingTop: spacing.md,
    backgroundColor: 'rgba(8,12,20,0.7)',
  },
  tapBtn: {
    backgroundColor: colors.secondary, borderRadius: radius.md,
    paddingVertical: spacing.md, alignItems: 'center',
  },
  tapBtnText: {
    fontFamily: typography.fontBodyBold, fontSize: 16, color: colors.text,
  },
  checkCircle: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: 'rgba(0,255,136,0.1)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.success,
  },
  finalReps: {
    fontFamily: typography.fontDisplay, fontSize: 80, color: colors.primary,
  },
  finalLabel: {
    fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.textSecondary,
  },
});
