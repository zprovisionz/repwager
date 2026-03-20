import { useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Zap, Trophy, DollarSign } from 'lucide-react-native';

const { width, height } = Dimensions.get('window');

function FeaturePill({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={styles.pill}>
      {icon}
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const titleAnim = useRef(new Animated.Value(0)).current;
  const subtitleAnim = useRef(new Animated.Value(0)).current;
  const pillsAnim = useRef(new Animated.Value(0)).current;
  const btnsAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 2000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0.4, duration: 2000, useNativeDriver: true }),
      ])
    ).start();

    Animated.stagger(180, [
      Animated.timing(titleAnim, { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(subtitleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(pillsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(btnsAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();
  }, []);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#00D4FF22', '#080C14', '#FF2D7811']}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <Animated.View
        style={[
          styles.glow,
          { opacity: glowAnim },
        ]}
      />

      <View style={[styles.content, { paddingTop: insets.top + spacing.xxl, paddingBottom: insets.bottom + spacing.xl }]}>
        <Animated.View style={{ opacity: titleAnim, transform: [{ translateY: titleAnim.interpolate({ inputRange: [0, 1], outputRange: [30, 0] }) }] }}>
          <Text style={styles.logo}>REP</Text>
          <Text style={styles.logoAccent}>WAGER</Text>
        </Animated.View>

        <Animated.Text
          style={[
            styles.tagline,
            {
              opacity: subtitleAnim,
              transform: [{ translateY: subtitleAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          Bet on your body.{'\n'}Prove it with reps.
        </Animated.Text>

        <Animated.View style={[styles.pills, { opacity: pillsAnim }]}>
          <FeaturePill icon={<Zap size={16} color={colors.primary} />} label="AI Rep Counting" />
          <FeaturePill icon={<DollarSign size={16} color={colors.accent} />} label="Wager Matches" />
          <FeaturePill icon={<Trophy size={16} color={colors.secondary} />} label="Leaderboards" />
        </Animated.View>

        <Animated.View
          style={[
            styles.actions,
            {
              opacity: btnsAnim,
              transform: [{ translateY: btnsAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }],
            },
          ]}
        >
          <TouchableOpacity style={styles.primaryBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.primaryBtnText}>GET STARTED</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.secondaryBtnText}>I already have an account</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  glow: {
    position: 'absolute',
    top: -100,
    left: '50%',
    marginLeft: -150,
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: colors.primary,
    filter: 'blur(80px)',
  } as any,
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xl,
  },
  logo: {
    fontFamily: typography.fontDisplay,
    fontSize: 72,
    color: colors.text,
    textAlign: 'center',
    lineHeight: 72,
    letterSpacing: 8,
  },
  logoAccent: {
    fontFamily: typography.fontDisplay,
    fontSize: 72,
    color: colors.primary,
    textAlign: 'center',
    lineHeight: 72,
    letterSpacing: 8,
    textShadowColor: colors.primary,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 20,
  },
  tagline: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 22,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 34,
  },
  pills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
  },
  actions: {
    width: '100%',
    gap: spacing.md,
  },
  primaryBtn: {
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
  primaryBtnText: {
    fontFamily: typography.fontDisplay,
    fontSize: 15,
    color: colors.textInverse,
    letterSpacing: 3,
  },
  secondaryBtn: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  secondaryBtnText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 15,
    color: colors.textSecondary,
  },
});
