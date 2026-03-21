import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Colors } from '@/constants/theme';
import { ChevronLeft, Swords } from 'lucide-react-native';

const LEAGUE_PURPLE = Colors.accent.purple;

/**
 * League Wars hub — commissioner flows + bracket tie-ins land here.
 * Backed by `league_wars` (see migration `20260320000014_league_wars.sql`).
 */
export default function LeagueWarHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>LEAGUE WARS</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Swords size={40} color={LEAGUE_PURPLE} />
          <Text style={styles.heroTitle}>Declare war. Battle for the ladder.</Text>
          <Text style={styles.heroBody}>
            Wars are league-scoped events: standings feed matchmaking, brackets close seasons, and
            commissioners can open a war from their league tools (UI wiring next).
          </Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Schema</Text>
          <Text style={styles.cardBody}>
            Table `league_wars` is created in Supabase — reconcile with any remote branch before
            enabling writes from the app.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  backBtn: { width: 40 },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 2,
  },
  scroll: { padding: spacing.md, paddingBottom: 80, gap: spacing.lg },
  hero: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: LEAGUE_PURPLE + '44',
    backgroundColor: Colors.accent.purpleDim,
  },
  heroTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 17,
    color: colors.text,
    textAlign: 'center',
  },
  heroBody: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    gap: spacing.xs,
  },
  cardTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  cardBody: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    lineHeight: 20,
  },
});
