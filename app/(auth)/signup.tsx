import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { signUp } from '@/services/auth.service';
import { ChevronLeft } from 'lucide-react-native';
import Avatar from '@/components/Avatar';

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [avatarGender, setAvatarGender] = useState<'male' | 'female'>('male');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSignup() {
    setError('');
    if (!email.trim() || !password || !username.trim() || !displayName.trim()) {
      setError('Please fill in all fields.');
      return;
    }
    if (username.length < 3) {
      setError('Username must be at least 3 characters.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    setLoading(true);
    try {
      await signUp(email.trim().toLowerCase(), password, username.trim().toLowerCase(), displayName.trim(), avatarGender);
    } catch (e: any) {
      const msg = e.message ?? '';
      if (msg.includes('already registered') || msg.includes('already exists')) {
        setError('Email or username is already taken.');
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
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity onPress={() => (step === 1 ? router.back() : setStep(1))} style={styles.back}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>

        {step === 1 && (
          <>
            <Text style={styles.title}>Create{'\n'}Account</Text>
            <Text style={styles.subtitle}>Join the competition. Start with $100.</Text>
            <View style={styles.form}>
              <Input label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} />
              <Input label="Password" value={password} onChangeText={setPassword} placeholder="Min. 6 characters" secureTextEntry />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Continue" onPress={() => {
                setError('');
                if (!email.trim() || !password) { setError('Fill in email and password.'); return; }
                if (password.length < 6) { setError('Password min 6 characters.'); return; }
                setStep(2);
              }} size="lg" />
            </View>
          </>
        )}

        {step === 2 && (
          <>
            <Text style={styles.title}>Your{'\n'}Identity</Text>
            <Text style={styles.subtitle}>Pick your name and fighter style</Text>

            <View style={styles.avatarRow}>
              <TouchableOpacity onPress={() => setAvatarGender('male')} style={[styles.genderOption, avatarGender === 'male' && styles.genderSelected]}>
                <Avatar gender="male" size={80} />
                <Text style={[styles.genderLabel, avatarGender === 'male' && styles.genderLabelSelected]}>Male</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setAvatarGender('female')} style={[styles.genderOption, avatarGender === 'female' && styles.genderSelected]}>
                <Avatar gender="female" size={80} />
                <Text style={[styles.genderLabel, avatarGender === 'female' && styles.genderLabelSelected]}>Female</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.form}>
              <Input label="Username" value={username} onChangeText={setUsername} placeholder="uniquehandle" autoCapitalize="none" autoCorrect={false} />
              <Input label="Display Name" value={displayName} onChangeText={setDisplayName} placeholder="How others see you" />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Create Account" onPress={handleSignup} loading={loading} size="lg" />
            </View>
          </>
        )}

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
  form: { gap: spacing.md },
  error: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
  },
  avatarRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xl,
    marginBottom: spacing.xl,
  },
  genderOption: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
  },
  genderSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  genderLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textMuted,
  },
  genderLabelSelected: { color: colors.primary },
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
