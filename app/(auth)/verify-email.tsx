import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { MailCheck, RefreshCw } from 'lucide-react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Button from '@/components/ui/Button';
import { resendVerification } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { email = '' } = useLocalSearchParams<{ email?: string }>();
  const { session, refreshProfile, authStage } = useAuthStore();
  const { show: showToast } = useToastStore();
  const [resending, setResending] = useState(false);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (authStage === 'needs_username') {
      router.replace('/(auth)/username-setup');
    }
    if (authStage === 'authenticated') {
      router.replace('/(tabs)');
    }
  }, [authStage]);

  async function handleResend() {
    if (!email) return;
    setResending(true);
    try {
      await resendVerification(String(email));
      showToast({
        type: 'success',
        title: 'Verification email sent',
        message: 'Check inbox and spam folder.',
      });
    } catch (error: any) {
      showToast({
        type: 'error',
        title: 'Could not resend',
        message: error?.message ?? 'Please try again.',
      });
    } finally {
      setResending(false);
    }
  }

  async function handleIHaveVerified() {
    setChecking(true);
    try {
      await refreshProfile();
      if (session?.user?.email_confirmed_at) {
        router.replace('/(auth)/username-setup');
      } else {
        showToast({
          type: 'warning',
          title: 'Still unverified',
          message: 'Open the verification link in your email first.',
        });
      }
    } finally {
      setChecking(false);
    }
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={styles.card}>
        <MailCheck size={42} color={colors.success} />
        <Text style={styles.title}>Verify your email</Text>
        <Text style={styles.subtitle}>
          We sent a verification link to{'\n'}
          <Text style={styles.email}>{String(email || session?.user?.email || '')}</Text>
        </Text>
        <Button
          label="I've Verified - Continue"
          onPress={handleIHaveVerified}
          loading={checking}
          size="lg"
        />
        <TouchableOpacity style={styles.resendBtn} onPress={handleResend} disabled={resending}>
          <RefreshCw size={14} color={colors.primary} />
          <Text style={styles.resendText}>{resending ? 'Resending...' : 'Resend email'}</Text>
        </TouchableOpacity>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.lg,
  },
  card: {
    width: '100%',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
    backgroundColor: 'rgba(13,20,36,0.55)',
    overflow: 'hidden',
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 26,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    textAlign: 'center',
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  email: {
    color: colors.primary,
    fontFamily: typography.fontBodyBold,
  },
  resendBtn: {
    marginTop: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  resendText: {
    fontFamily: typography.fontBodyMedium,
    color: colors.primary,
    fontSize: 13,
  },
});
