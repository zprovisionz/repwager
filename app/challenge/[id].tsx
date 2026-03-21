import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import {
  getMatchWithChallengerProfile,
  acceptMatch,
} from '@/services/match.service';
import { EXERCISE_LABELS } from '@/lib/config';
import Button from '@/components/ui/Button';
import { BarlowText } from '@/components/ui/BarlowText';
import { MatchTypeBadge } from '@/components/ui/MatchTypeBadge';
import { ELODiffBadge } from '@/components/ui/ELODiffBadge';
import { ChevronLeft } from 'lucide-react-native';
import type { Match, MatchMode } from '@/types/database';
import { RANK_TIER_COLORS } from '@/types/database';

function resolveMode(m: Match): MatchMode {
  if (m.match_mode) return m.match_mode;
  return (m.wager_amount ?? 0) === 0 ? 'casual' : 'wager';
}

export default function OpenChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [row, setRow] = useState<
    (Match & { profiles: Record<string, any> | null }) | null
  >(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await getMatchWithChallengerProfile(id);
      setRow(data);
    } catch {
      setRow(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleAccept() {
    if (!session?.user || !profile || !row) return;
    const repcoins = (profile as any).repcoins ?? 100;
    if (row.wager_amount > 0 && repcoins < row.wager_amount) {
      showToast({
        type: 'error',
        title: 'Insufficient RepCoins',
        message: `Need ${row.wager_amount} RC`,
      });
      return;
    }
    setAccepting(true);
    try {
      await acceptMatch(row.id, session.user.id);
      showToast({
        type: 'success',
        title: 'Challenge accepted!',
        message: `You have ${(row as any).submission_window_hours ?? 2} hour(s) to record your set.`,
      });
      await refreshProfile();
      router.replace({ pathname: '/match/[id]', params: { id: row.id } });
    } catch (e: any) {
      showToast({
        type: 'error',
        title: 'Could not accept',
        message: e.message,
      });
    } finally {
      setAccepting(false);
    }
  }

  const challenger = row?.profiles;
  const myElo = (profile as any)?.elo ?? 1000;
  const theirElo = challenger?.elo ?? 1000;
  const mode = row ? resolveMode(row) : 'casual';
  const tone = mode === 'wager' ? 'wager' : 'casual';

  if (loading) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!row || row.status !== 'pending' || row.challenger_id === session?.user?.id) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top, paddingHorizontal: spacing.md }]}>
        <BarlowText variant="body" color={colors.textSecondary} style={{ textAlign: 'center' }}>
          This challenge is not available or you posted it.
        </BarlowText>
        <Button label="Go back" onPress={() => router.back()} tone="casual" style={{ marginTop: spacing.lg }} />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.md,
        paddingBottom: insets.bottom + spacing.xl,
        paddingHorizontal: spacing.md,
      }}
    >
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <BarlowText variant="displayMedium" style={styles.title}>
          Open challenge
        </BarlowText>
        <View style={{ width: 24 }} />
      </View>

      <View style={styles.card}>
        <View style={styles.badgeRow}>
          <MatchTypeBadge mode={mode} />
          <ELODiffBadge myElo={myElo} theirElo={theirElo} />
        </View>
        <BarlowText variant="display" style={styles.name}>
          @{challenger?.username ?? '???'}
        </BarlowText>
        {challenger?.rank_tier && (
          <Text
            style={[
              styles.rank,
              {
                color:
                  (RANK_TIER_COLORS as Record<string, string>)[challenger.rank_tier] ??
                  colors.textMuted,
              },
            ]}
          >
            {challenger.rank_tier}
          </Text>
        )}
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Exercise</Text>
          <Text style={styles.metaVal}>{EXERCISE_LABELS[row.exercise_type]}</Text>
        </View>
        <View style={styles.row}>
          <Text style={styles.metaLabel}>Stake</Text>
          <Text style={[styles.metaVal, { color: mode === 'casual' ? colors.primary : colors.accent }]}>
            {mode === 'casual' ? '0 RC (casual)' : `${row.wager_amount} RC`}
          </Text>
        </View>
      </View>

      <Button
        label={accepting ? 'Accepting…' : 'Accept challenge'}
        onPress={handleAccept}
        loading={accepting}
        disabled={accepting}
        tone={tone}
        size="lg"
        style={styles.cta}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  centered: {
    flex: 1,
    backgroundColor: colors.bg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: { fontSize: 18, color: colors.text },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  name: { fontSize: 26, color: colors.text, marginTop: spacing.xs },
  rank: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  metaLabel: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  metaVal: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  cta: { width: '100%' },
});
