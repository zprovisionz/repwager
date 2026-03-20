import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { createDirectChallenge, createMatch } from '@/services/match.service';
import { MIN_WAGER, MAX_WAGER, EXERCISE_LABELS } from '@/lib/config';
import Button from '@/components/ui/Button';
import { X, Zap, ChevronLeft, Lock } from 'lucide-react-native';

const CASUAL_UNLOCK_THRESHOLD = 10;

const WAGER_PRESETS = [5, 10, 25, 50];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { opponent, rematch_of } = useLocalSearchParams<{ opponent?: string; rematch_of?: string }>();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [exercise, setExercise] = useState<'push_ups' | 'squats'>('push_ups');
  const [wager, setWager] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wagerNum = Math.round(parseFloat(wager) || 0);
  const repcoins = (profile as any)?.repcoins ?? 100;
  const casualMatchCount: number = (profile as any)?.casual_matches_played ?? 0;
  const wagersUnlocked = casualMatchCount >= CASUAL_UNLOCK_THRESHOLD;
  const canCreate = wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER && repcoins >= wagerNum && wagersUnlocked;

  async function handleCreate() {
    setError('');
    if (!canCreate) {
      setError(`Wager must be between ${MIN_WAGER} and ${MAX_WAGER} RepCoins`);
      return;
    }
    if (repcoins < wagerNum) {
      setError('Insufficient RepCoins');
      return;
    }
    setLoading(true);
    try {
      const match = opponent
        ? await createDirectChallenge(session!.user!.id, opponent, exercise, wagerNum)
        : await createMatch(session!.user!.id, exercise, wagerNum);
      showToast({
        type: 'success',
        title: 'Challenge created!',
        message: opponent ? `Challenge sent to @${opponent}` : 'Waiting for an opponent...',
      });
      await refreshProfile();
      router.replace({ pathname: '/match/[id]', params: { id: match.id } });
    } catch (e: any) {
      setError(e.message ?? 'Could not create challenge');
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={() => router.back()}>
            <ChevronLeft size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <Text style={styles.screenTitle}>{opponent ? `Challenge @${opponent}` : 'New Challenge'}</Text>
          <View style={{ width: 24 }} />
        </View>

        <Text style={styles.sectionLabel}>EXERCISE</Text>
        <View style={styles.exerciseRow}>
          {(['push_ups', 'squats'] as const).map((ex) => (
            <TouchableOpacity
              key={ex}
              style={[styles.exerciseOption, exercise === ex && styles.exerciseSelected]}
              onPress={() => setExercise(ex)}
            >
              <Zap size={22} color={exercise === ex ? colors.primary : colors.textMuted} />
              <Text style={[styles.exerciseLabel, exercise === ex && styles.exerciseLabelSelected]}>
                {EXERCISE_LABELS[ex]}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {!wagersUnlocked && (
          <View style={styles.wagerLockBanner}>
            <Lock size={14} color={colors.accent} />
            <Text style={styles.wagerLockText}>
              Complete {CASUAL_UNLOCK_THRESHOLD - casualMatchCount} more casual match{CASUAL_UNLOCK_THRESHOLD - casualMatchCount !== 1 ? 'es' : ''} to unlock wagers
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>WAGER AMOUNT</Text>
        <View style={[styles.wagerRow, !wagersUnlocked && { opacity: 0.35 }]}>
          {WAGER_PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.preset, wagerNum === p && styles.presetSelected]}
              onPress={() => setWager(p.toString())}
            >
              <Text style={[styles.presetText, wagerNum === p && styles.presetTextSelected]}>{p} RC</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.customWager, !wagersUnlocked && { opacity: 0.35 }]}>
          <TextInput
            style={styles.wagerInput}
            value={wager}
            onChangeText={setWager}
            keyboardType="numeric"
            placeholder="Custom"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
            editable={wagersUnlocked}
          />
        </View>

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Your RepCoins:</Text>
          <Text style={styles.balanceValue}>{repcoins} RC</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Match Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Exercise</Text>
            <Text style={styles.summaryValue}>{EXERCISE_LABELS[exercise]}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Submission window</Text>
            <Text style={styles.summaryValue}>2 hours each</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Your wager</Text>
            <Text style={styles.summaryValue}>{wagerNum} RC</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Potential win</Text>
            <Text style={[styles.summaryValue, styles.winColor]}>{Math.round(wagerNum * 2 * 0.9)} RC</Text>
          </View>
          <Text style={styles.rakeLine}>10% platform rake on winnings</Text>
        </View>

        <Button
          label="POST CHALLENGE"
          onPress={handleCreate}
          loading={loading}
          disabled={!canCreate}
          size="lg"
          style={styles.createBtn}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  wagerLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginBottom: spacing.sm,
  },
  wagerLockText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.accent,
    flex: 1,
  },
  scroll: { flexGrow: 1, paddingHorizontal: spacing.md },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xl,
  },
  screenTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.text,
    letterSpacing: 1,
  },
  sectionLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
    marginBottom: spacing.sm,
    marginTop: spacing.lg,
  },
  exerciseRow: { flexDirection: 'row', gap: spacing.sm },
  exerciseOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.border,
  },
  exerciseSelected: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,212,255,0.08)',
  },
  exerciseLabel: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.textMuted,
  },
  exerciseLabelSelected: { color: colors.primary },
  wagerRow: { flexDirection: 'row', gap: spacing.sm },
  preset: {
    flex: 1,
    paddingVertical: spacing.sm + 2,
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  presetSelected: { borderColor: colors.accent, backgroundColor: 'rgba(255,184,0,0.08)' },
  presetText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.textMuted,
  },
  presetTextSelected: { color: colors.accent },
  customWager: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  wagerInput: {
    flex: 1,
    fontFamily: typography.fontBodyBold,
    fontSize: 18,
    color: colors.text,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  balanceLabel: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textMuted },
  balanceValue: { fontFamily: typography.fontBodyBold, fontSize: 13, color: colors.accent },
  error: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  summary: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: spacing.lg,
    gap: spacing.sm,
  },
  summaryTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
    marginBottom: spacing.xs,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textSecondary },
  summaryValue: { fontFamily: typography.fontBodyBold, fontSize: 13, color: colors.text },
  winColor: { color: colors.success },
  rakeLine: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  createBtn: { marginTop: spacing.xl },
});
