import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function FitnessDisclaimerScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Fitness Disclaimer</Text>
      <Text style={styles.body}>RepWager is for fitness motivation only. Exercise at your own risk and stop if you feel pain.</Text>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/terms')}>
        <Text style={styles.buttonText}>I Understand</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center', gap: spacing.lg },
  title: { fontFamily: typography.fontDisplay, fontSize: 24, color: colors.text },
  body: { fontFamily: typography.fontBody, fontSize: 15, color: colors.textSecondary, lineHeight: 24 },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { fontFamily: typography.fontBodyBold, color: '#00131A' },
});
