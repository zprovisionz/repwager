import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Animated } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Zap, Trophy, DollarSign, Dumbbell, ChevronRight } from 'lucide-react-native';

interface OnboardingModalProps {
  visible: boolean;
  onDismiss: () => void;
}

const STEPS = [
  {
    icon: <Zap size={36} color={colors.primary} />,
    title: 'Challenge anyone',
    body: 'Create a match, set your wager, pick your exercise. Anyone can accept.',
  },
  {
    icon: <Dumbbell size={36} color={colors.success} />,
    title: 'Record in 60 seconds',
    body: 'Once accepted you have 2 hours to record your reps. Camera counts them automatically.',
  },
  {
    icon: <Trophy size={36} color={colors.accent} />,
    title: 'Most reps wins',
    body: "Scores stay hidden until both players submit. Winner takes the pot minus 10% rake.",
  },
  {
    icon: <DollarSign size={36} color={colors.secondary} />,
    title: 'Start with $100',
    body: "You've been given $100 to start. Win matches to grow your balance and climb the ranks.",
  },
];

export default function OnboardingModal({ visible, onDismiss }: OnboardingModalProps) {
  const insets = useSafeAreaInsets();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, tension: 70, friction: 8 }),
      ]).start();
    }
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <Animated.View
          style={[
            styles.card,
            { paddingBottom: insets.bottom + spacing.lg },
            { transform: [{ translateY: slideAnim }] },
          ]}
        >
          <View style={styles.pill} />
          <Text style={styles.heading}>Welcome to RepWager</Text>
          <Text style={styles.sub}>Here's how it works</Text>

          <View style={styles.steps}>
            {STEPS.map((step, i) => (
              <View key={i} style={styles.stepRow}>
                <View style={styles.stepIcon}>{step.icon}</View>
                <View style={styles.stepText}>
                  <Text style={styles.stepTitle}>{step.title}</Text>
                  <Text style={styles.stepBody}>{step.body}</Text>
                </View>
              </View>
            ))}
          </View>

          <TouchableOpacity style={styles.btn} onPress={onDismiss} activeOpacity={0.85}>
            <Text style={styles.btnText}>Let's go</Text>
            <ChevronRight size={18} color={colors.textInverse} />
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.xl,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  pill: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginBottom: spacing.lg,
  },
  heading: {
    fontFamily: typography.fontDisplay,
    fontSize: 22,
    color: colors.text,
    letterSpacing: 1,
    marginBottom: spacing.xs,
  },
  sub: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  steps: {
    gap: spacing.lg,
    marginBottom: spacing.xl,
  },
  stepRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  stepIcon: {
    width: 52,
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  stepText: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  stepTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.text,
  },
  stepBody: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 19,
  },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  btnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textInverse,
    letterSpacing: 1,
  },
});
