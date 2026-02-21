import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { createMatch } from '@/services/match.service';
import { MIN_WAGER, MAX_WAGER, EXERCISE_LABELS } from '@/lib/config';
import Button from '@/components/ui/Button';
import { Zap, DollarSign, ChevronLeft, Trophy, Dumbbell } from 'lucide-react-native';

const WAGER_PRESETS = [5, 10, 25, 50];

export default function CreateChallengeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [exercise, setExercise] = useState<'push_ups' | 'squats'>('push_ups');
  const [mode, setMode] = useState<'competitive' | 'casual'>('competitive');
  const [wager, setWager] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wagerNum = parseFloat(wager) || 0;
  const canCreate = wagerNum >= MIN_WAGER && wagerNum <= MAX_WAGER && (profile?.balance ?? 0) >= wagerNum;

  async function handleCreate() {
    setError('');
    if (!canCreate) {
      setError(`Wager must be between $${MIN_WAGER} and $${MAX_WAGER}`);
      return;
    }
    if ((profile?.balance ?? 0) < wagerNum) {
      setError('Insufficient balance');
      return;
    }
    setLoading(true);
    try {
      const match = await createMatch(session!.user!.id, exercise, wagerNum, undefined, mode);
      showToast({ type: 'success', title: 'Challenge created!', message: 'Waiting for an opponent...' });
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
          <Text style={styles.screenTitle}>New Challenge</Text>
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

        <Text style={styles.sectionLabel}>MATCH MODE</Text>
        <View style={styles.exerciseRow}>
          {(['competitive', 'casual'] as const).map((m) => (
            <TouchableOpacity
              key={m}
              style={[styles.exerciseOption, mode === m && styles.exerciseSelected]}
              onPress={() => setMode(m)}
            >
              {m === 'competitive' ? (
                <Trophy size={20} color={mode === m ? colors.primary : colors.textMuted} />
              ) : (
                <Dumbbell size={20} color={mode === m ? colors.primary : colors.textMuted} />
              )}
              <Text style={[styles.exerciseLabel, mode === m && styles.exerciseLabelSelected]}>
                {m === 'competitive' ? 'Competitive' : 'Casual'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={styles.modeNote}>
          {mode === 'competitive' ? '1.5x XP — Affects leaderboard ranking' : '1x XP — Does not affect leaderboard'}
        </Text>

        <Text style={styles.sectionLabel}>WAGER AMOUNT</Text>
        <View style={styles.wagerRow}>
          {WAGER_PRESETS.map((p) => (
            <TouchableOpacity
              key={p}
              style={[styles.preset, wagerNum === p && styles.presetSelected]}
              onPress={() => setWager(p.toString())}
            >
              <Text style={[styles.presetText, wagerNum === p && styles.presetTextSelected]}>${p}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.customWager}>
          <DollarSign size={18} color={colors.accent} />
          <TextInput
            style={styles.wagerInput}
            value={wager}
            onChangeText={setWager}
            keyboardType="numeric"
            placeholder="Custom"
            placeholderTextColor={colors.textMuted}
            selectTextOnFocus
          />
        </View>

        <View style={styles.balanceRow}>
          <Text style={styles.balanceLabel}>Your balance:</Text>
          <Text style={styles.balanceValue}>${profile?.balance.toFixed(2) ?? '0.00'}</Text>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Match Summary</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Exercise</Text>
            <Text style={styles.summaryValue}>{EXERCISE_LABELS[exercise]}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Mode</Text>
            <Text style={[styles.summaryValue, mode === 'competitive' ? styles.winColor : null]}>
              {mode === 'competitive' ? 'Competitive' : 'Casual'}
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Duration</Text>
            <Text style={styles.summaryValue}>60 seconds</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Your wager</Text>
            <Text style={styles.summaryValue}>${wagerNum.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Potential win</Text>
            <Text style={[styles.summaryValue, styles.winColor]}>${(wagerNum * 2 * 0.9).toFixed(2)}</Text>
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
  modeNote: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  createBtn: { marginTop: spacing.xl },
});
