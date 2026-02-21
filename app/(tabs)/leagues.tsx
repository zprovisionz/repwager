import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Trophy } from 'lucide-react-native';

export default function LeaguesScreen() {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        <Trophy size={64} color={colors.primary} />
        <Text style={styles.title}>Leagues Coming Soon</Text>
        <Text style={styles.subtitle}>
          Join competitive leagues and climb the ranks against players worldwide
        </Text>
        <Text style={styles.description}>
          Phase 5 will introduce organized leagues with seasonal rankings and exclusive rewards.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 24,
    color: colors.text,
    marginTop: spacing.lg,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
  description: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
