import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { createUsernameProfile, isUsernameAvailable } from '@/services/auth.service';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';

type Availability = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;

export default function UsernameSetupScreen() {
  const router = useRouter();
  const { session, refreshProfile, authStage } = useAuthStore();
  const { show: showToast } = useToastStore();
  const [username, setUsername] = useState('');
  const [availability, setAvailability] = useState<Availability>('idle');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (authStage === 'authenticated') router.replace('/(tabs)');
    if (authStage === 'needs_email_verification') router.replace('/(auth)/verify-email');
  }, [authStage]);

  useEffect(() => {
    const trimmed = username.trim().toLowerCase();
    if (!trimmed) {
      setAvailability('idle');
      return;
    }
    if (!USERNAME_REGEX.test(trimmed)) {
      setAvailability('invalid');
      return;
    }
    setAvailability('checking');
    const handle = setTimeout(async () => {
      try {
        const available = await isUsernameAvailable(trimmed);
        setAvailability(available ? 'available' : 'taken');
      } catch {
        setAvailability('idle');
      }
    }, 350);
    return () => clearTimeout(handle);
  }, [username]);

  const availabilityText = useMemo(() => {
    switch (availability) {
      case 'checking':
        return 'Checking availability...';
      case 'available':
        return 'Username available';
      case 'taken':
        return 'Username already taken';
      case 'invalid':
        return 'Use 3-24 chars: a-z, 0-9, _';
      default:
        return '';
    }
  }, [availability]);

  const availabilityColor =
    availability === 'available'
      ? colors.success
      : availability === 'taken' || availability === 'invalid'
        ? colors.secondary
        : colors.textMuted;

  async function handleSubmit() {
    setError('');
    const value = username.trim().toLowerCase();
    if (!session?.user?.id) {
      setError('Session expired. Please sign in again.');
      return;
    }
    if (availability !== 'available') {
      setError('Pick an available username to continue.');
      return;
    }
    setLoading(true);
    try {
      await createUsernameProfile(session.user.id, value);
      await refreshProfile();
      showToast({
        type: 'success',
        title: 'Username locked in',
        message: `Welcome @${value}`,
      });
      router.replace('/(tabs)');
    } catch (e: any) {
      setError(e?.message ?? 'Could not save username.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.container}>
      <BlurView intensity={20} tint="dark" style={styles.card}>
        <Text style={styles.title}>Choose your username</Text>
        <Text style={styles.subtitle}>This is your permanent RepWager identity.</Text>
        <Input
          label="Username"
          value={username}
          onChangeText={(value) => setUsername(value.replace(/\s+/g, ''))}
          placeholder="e.g. beastmode_23"
          autoCapitalize="none"
          autoCorrect={false}
        />
        <View style={styles.availabilityRow}>
          {availability === 'checking' ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : null}
          <Text style={[styles.availabilityText, { color: availabilityColor }]}>
            {availabilityText}
          </Text>
        </View>
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Button label="Finish Setup" onPress={handleSubmit} loading={loading} size="lg" />
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
    gap: spacing.md,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    color: colors.text,
    letterSpacing: 1,
  },
  subtitle: {
    fontFamily: typography.fontBody,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  availabilityRow: {
    minHeight: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  availabilityText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
  },
  error: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
});
