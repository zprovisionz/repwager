import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { colors, spacing, typography, radius } from '@/lib/theme';

export default function TermsScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Terms & Privacy</Text>
      <TouchableOpacity onPress={() => Linking.openURL('https://example.com/terms')}>
        <Text style={styles.link}>Open Terms of Service</Text>
      </TouchableOpacity>
      <TouchableOpacity onPress={() => Linking.openURL('https://example.com/privacy')}>
        <Text style={styles.link}>Open Privacy Policy</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.button} onPress={() => router.push('/onboarding/tutorial')}>
        <Text style={styles.buttonText}>Accept & Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg, justifyContent: 'center', gap: spacing.md },
  title: { fontFamily: typography.fontDisplay, fontSize: 24, color: colors.text },
  link: { fontFamily: typography.fontBodyMedium, fontSize: 14, color: colors.primary },
  button: { marginTop: spacing.md, backgroundColor: colors.primary, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center' },
  buttonText: { fontFamily: typography.fontBodyBold, color: '#00131A' },
});
