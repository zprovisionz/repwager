import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { signUp } from '@/services/auth.service';
import { ChevronLeft } from 'lucide-react-native';
import { useToastStore } from '@/stores/toastStore';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToastStore();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in email and password.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password);
      router.replace({
        pathname: '/(auth)/verify-email',
        params: { email: email.trim().toLowerCase() },
      });
    } catch (e: any) {
      const msg = e.message ?? '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        showToast({
          type: 'info',
          title: 'Account exists',
          message: 'Verify your email and continue setup.',
        });
        router.replace({
          pathname: '/(auth)/verify-email',
          params: { email: email.trim().toLowerCase() },
        });
      } else {
        setError(msg || 'Sign up failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {
            paddingTop: insets.top + spacing.lg,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        <Text style={styles.title}>Create{'\n'}Account</Text>
        <Text style={styles.subtitle}>
          Step 1 of 3. Sign up with email, verify, then set your username.
        </Text>

        <BlurView intensity={20} tint="dark" style={styles.card}>
          <View style={styles.form}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="Min. 6 characters"
              secureTextEntry
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Button
              label="Continue to Verify Email"
              onPress={handleSignup}
              loading={loading}
              size="lg"
            />
          </View>
        </BlurView>

        <TouchableOpacity onPress={() => router.replace('/(auth)/login')} style={styles.switchLink}>
          <Text style={styles.switchText}>Already have an account? </Text>
          <Text style={[styles.switchText, styles.switchAccent]}>Sign In</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.xl },
  back: { marginBottom: spacing.xl },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 40,
    color: colors.text,
    lineHeight: 48,
    letterSpacing: 1,
    marginBottom: spacing.sm,
  },
  subtitle: {
    fontFamily: typography.fontBody,
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  card: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(0,212,255,0.35)',
    backgroundColor: 'rgba(13,20,36,0.55)',
    overflow: 'hidden',
    padding: spacing.lg,
  },
  form: { gap: spacing.md },
  error: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  switchLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: spacing.xl,
  },
  switchText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 15,
    color: colors.textSecondary,
  },
  switchAccent: { color: colors.primary },
});
