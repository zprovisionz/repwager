import { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { useChallengeUiStore } from '@/stores/challengeUiStore';
import { createDirectChallenge, createMatch } from '@/services/match.service';
import { MIN_WAGER, MAX_WAGER, EXERCISE_LABELS } from '@/lib/config';
import Button from '@/components/ui/Button';
import { BarlowText } from '@/components/ui/BarlowText';
import { Zap, ChevronLeft, Lock } from 'lucide-react-native';
import type { MatchMode } from '@/types/database';

const CASUAL_UNLOCK_THRESHOLD = 10;
const WAGER_PRESETS = [5, 10, 25, 50];
const STEPS = ['Exercise', 'Stakes', 'Opponent & window', 'Review'] as const;
const SUBMISSION_WINDOWS = [1, 2, 6, 24] as const;
type OpponentMode = 'open' | 'callout';

export default function CreateChallengeScreen() {
  const router = useRouter();
  const { opponent, rematch_of } = useLocalSearchParams<{ opponent?: string; rematch_of?: string }>();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { show: showToast } = useToastStore();
  const setFabTone = useChallengeUiStore((s) => s.setFabTone);

  const [step, setStep] = useState(0);
  const [exercise, setExercise] = useState<'push_ups' | 'squats'>('push_ups');
  const [opponentMode, setOpponentMode] = useState<OpponentMode>('open');
  const [submissionWindowHours, setSubmissionWindowHours] = useState<(typeof SUBMISSION_WINDOWS)[number]>(2);
  const [matchMode, setMatchMode] = useState<MatchMode>('casual');
  const [wager, setWager] = useState('10');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const wagerNum = Math.round(parseFloat(wager) || 0);
  const repcoins = (profile as any)?.repcoins ?? 100;
  const casualMatchCount: number = (profile as any)?.casual_matches_played ?? 0;
  const wagersUnlocked = casualMatchCount >= CASUAL_UNLOCK_THRESHOLD;

  useFocusEffect(
    useCallback(() => {
      setFabTone(matchMode === 'wager' ? 'amber' : 'cyan');
      return () => setFabTone('cyan');
    }, [matchMode, setFabTone])
  );

  useEffect(() => {
    if (opponent?.trim()) setOpponentMode('callout');
  }, [opponent]);

  const canProceedStep1 =
    matchMode === 'casual' ||
    (wagersUnlocked &&
      wagerNum >= MIN_WAGER &&
      wagerNum <= MAX_WAGER &&
      repcoins >= wagerNum);

  const opponentOk = opponentMode === 'open' || !!opponent?.trim();
  const canSubmit =
    opponentOk &&
    (matchMode === 'casual' ||
      (wagersUnlocked &&
        wagerNum >= MIN_WAGER &&
        wagerNum <= MAX_WAGER &&
        repcoins >= wagerNum));

  async function handleCreate() {
    setError('');
    if (!canSubmit) {
      setError(
        matchMode === 'wager'
          ? `Wager must be between ${MIN_WAGER} and ${MAX_WAGER} RepCoins`
          : ''
      );
      return;
    }
    if (!session?.user) return;

    setLoading(true);
    try {
      let match;
      const amount = matchMode === 'casual' ? 0 : wagerNum;

      if (opponentMode === 'callout' && opponent) {
        match = await createDirectChallenge(
          session.user.id,
          opponent,
          exercise,
          amount,
          matchMode,
          submissionWindowHours
        );
      } else {
        match = await createMatch(
          session.user.id,
          exercise,
          amount,
          matchMode,
          undefined,
          submissionWindowHours
        );
      }

      showToast({
        type: 'success',
        title: 'Challenge created!',
        message: opponent
          ? `Challenge sent to @${opponent}`
          : 'Waiting for an opponent...',
      });
      await refreshProfile();
      router.replace({ pathname: '/match/[id]', params: { id: match.id } });
    } catch (e: any) {
      setError(e.message ?? 'Could not create challenge');
    } finally {
      setLoading(false);
    }
  }

  function next() {
    setError('');
    if (step === 1 && !canProceedStep1) {
      setError(
        matchMode === 'wager'
          ? wagersUnlocked
            ? 'Check wager amount and RepCoins'
            : 'Complete more casual matches to unlock wagers'
          : ''
      );
      return;
    }
    if (step === 2 && opponentMode === 'callout' && !opponent?.trim()) {
      setError('Callout challenges need an opponent — use search to pick someone.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function back() {
    setError('');
    if (step === 0) router.back();
    else setStep((s) => s - 1);
  }

  const primaryTone = matchMode === 'wager' ? 'wager' : 'casual';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
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
        <View style={styles.topBar}>
          <TouchableOpacity onPress={back}>
            <ChevronLeft size={24} color={colors.textSecondary} />
          </TouchableOpacity>
          <View style={styles.titleBlock}>
            <BarlowText variant="displayMedium" style={styles.screenTitle}>
              {opponent ? `vs @${opponent}` : 'New challenge'}
            </BarlowText>
            <BarlowText variant="label" color={colors.textMuted} style={styles.stepLabel}>
              {STEPS[step]} · Step {step + 1}/{STEPS.length}
            </BarlowText>
          </View>
          <View style={{ width: 24 }} />
        </View>

        <View style={styles.stepDots}>
          {STEPS.map((_, i) => (
            <View
              key={i}
              style={[styles.dot, i === step && styles.dotActive, i < step && styles.dotDone]}
            />
          ))}
        </View>

        {step === 0 && (
          <>
            <BarlowText variant="label" color={colors.textMuted} style={styles.sectionLabel}>
              Exercise
            </BarlowText>
            <View style={styles.exerciseRow}>
              <TouchableOpacity
                style={[styles.exerciseOption, exercise === 'push_ups' && styles.exerciseSelected]}
                onPress={() => setExercise('push_ups')}
              >
                <Zap size={22} color={exercise === 'push_ups' ? colors.primary : colors.textMuted} />
                <Text
                  style={[
                    styles.exerciseLabel,
                    exercise === 'push_ups' && styles.exerciseLabelSelected,
                  ]}
                >
                  {EXERCISE_LABELS.push_ups}
                </Text>
              </TouchableOpacity>
              <View style={[styles.exerciseOption, styles.exerciseLocked]}>
                <Lock size={22} color={colors.textMuted} />
                <Text style={styles.exerciseLabel}>{EXERCISE_LABELS.squats}</Text>
                <Text style={styles.lockedHint}>Launch</Text>
              </View>
            </View>
          </>
        )}

        {step === 1 && (
          <>
            <BarlowText variant="label" color={colors.textMuted} style={styles.sectionLabel}>
              Match type
            </BarlowText>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  matchMode === 'casual' && styles.modeBtnActiveCyan,
                ]}
                onPress={() => setMatchMode('casual')}
              >
                <BarlowText
                  variant="bodyBold"
                  color={matchMode === 'casual' ? colors.textInverse : colors.text}
                >
                  Casual
                </BarlowText>
                <Text style={styles.modeSub}>Cyan · no stake</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  matchMode === 'wager' && styles.modeBtnActiveAmber,
                ]}
                onPress={() => setMatchMode('wager')}
              >
                <BarlowText
                  variant="bodyBold"
                  color={matchMode === 'wager' ? colors.textInverse : colors.text}
                >
                  Wager
                </BarlowText>
                <Text style={styles.modeSub}>Amber · RepCoins</Text>
              </TouchableOpacity>
            </View>

            {!wagersUnlocked && matchMode === 'wager' && (
              <View style={styles.wagerLockBanner}>
                <Lock size={14} color={colors.accent} />
                <Text style={styles.wagerLockText}>
                  Complete {CASUAL_UNLOCK_THRESHOLD - casualMatchCount} more casual match
                  {CASUAL_UNLOCK_THRESHOLD - casualMatchCount !== 1 ? 'es' : ''} to unlock
                  wagers
                </Text>
              </View>
            )}

            {matchMode === 'wager' && (
              <>
                <BarlowText
                  variant="label"
                  color={colors.textMuted}
                  style={styles.sectionLabel}
                >
                  Wager amount
                </BarlowText>
                <View
                  style={[styles.wagerRow, !wagersUnlocked && { opacity: 0.35 }]}
                >
                  {WAGER_PRESETS.map((p) => (
                    <TouchableOpacity
                      key={p}
                      style={[
                        styles.preset,
                        wagerNum === p && styles.presetSelected,
                      ]}
                      onPress={() => setWager(p.toString())}
                      disabled={!wagersUnlocked}
                    >
                      <Text
                        style={[
                          styles.presetText,
                          wagerNum === p && styles.presetTextSelected,
                        ]}
                      >
                        {p} RC
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <View
                  style={[styles.customWager, !wagersUnlocked && { opacity: 0.35 }]}
                >
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
              </>
            )}
          </>
        )}

        {step === 2 && (
          <View style={styles.step3Card}>
            <BarlowText variant="label" color={colors.textMuted} style={styles.sectionLabel}>
              Opponent
            </BarlowText>
            <View style={styles.modeRow}>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  opponentMode === 'open' && styles.modeBtnActiveCyan,
                ]}
                onPress={() => setOpponentMode('open')}
              >
                <BarlowText
                  variant="bodyBold"
                  color={opponentMode === 'open' ? colors.textInverse : colors.text}
                >
                  Open
                </BarlowText>
                <Text style={styles.modeSub}>Anyone can accept</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.modeBtn,
                  opponentMode === 'callout' && styles.modeBtnActiveAmber,
                ]}
                onPress={() => setOpponentMode('callout')}
              >
                <BarlowText
                  variant="bodyBold"
                  color={opponentMode === 'callout' ? colors.textInverse : colors.text}
                >
                  Callout
                </BarlowText>
                <Text style={styles.modeSub}>Challenge someone</Text>
              </TouchableOpacity>
            </View>

            {opponentMode === 'callout' && (
              <TouchableOpacity
                style={styles.calloutSearch}
                onPress={() => router.push('/challenge/search')}
              >
                <BarlowText variant="bodyBold" color={colors.primary}>
                  {opponent?.trim() ? `@${opponent}` : 'Find opponent'}
                </BarlowText>
                <Text style={styles.calloutHint}>
                  Search by username — no league wars in this flow.
                </Text>
              </TouchableOpacity>
            )}

            <BarlowText variant="label" color={colors.textMuted} style={[styles.sectionLabel, { marginTop: spacing.md }]}>
              Submission window
            </BarlowText>
            <View style={styles.windowRow}>
              {SUBMISSION_WINDOWS.map((h) => (
                <TouchableOpacity
                  key={h}
                  style={[
                    styles.windowChip,
                    submissionWindowHours === h && styles.windowChipActive,
                  ]}
                  onPress={() => setSubmissionWindowHours(h)}
                >
                  <Text
                    style={[
                      styles.windowChipText,
                      submissionWindowHours === h && styles.windowChipTextActive,
                    ]}
                  >
                    {h}H
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.forfeitHint}>
              Miss the window and you forfeit — stake returns to your opponent on wager matches.
            </Text>

            <View style={[styles.rulesCard, { marginTop: spacing.md }]}>
              <BarlowText variant="displayMedium" style={styles.rulesTitle}>
                How it works
              </BarlowText>
              <Text style={styles.rulesBody}>
                • After accept, each player must record within the window above.{'\n'}
                • Rep count uses on-device pose detection only.{'\n'}
                • Scores stay hidden until both submit.{'\n'}
                • Winner takes the pot minus rake on wagers.
              </Text>
            </View>
          </View>
        )}

        {step === 3 && (
          <View style={styles.summary}>
            <BarlowText variant="displayMedium" style={styles.summaryTitle}>
              Review
            </BarlowText>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Exercise</Text>
              <Text style={styles.summaryValue}>{EXERCISE_LABELS[exercise]}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Opponent</Text>
              <Text style={styles.summaryValue}>
                {opponentMode === 'open' ? 'Open challenge' : opponent?.trim() ? `@${opponent}` : 'Callout (pick opponent)'}
              </Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Submission window</Text>
              <Text style={styles.summaryValue}>{submissionWindowHours} hours</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Type</Text>
              <Text style={styles.summaryValue}>
                {matchMode === 'casual' ? 'Casual (0 RC)' : 'Wager'}
              </Text>
            </View>
            {matchMode === 'wager' && (
              <>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Wager</Text>
                  <Text style={styles.summaryValue}>{wagerNum} RC</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Balance after post</Text>
                  <Text style={styles.summaryValue}>{Math.max(0, repcoins - wagerNum)} RC</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>ELO on the line</Text>
                  <Text style={styles.summaryValue}>Ranked — win/loss adjusts ELO</Text>
                </View>
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Potential win</Text>
                  <Text style={[styles.summaryValue, styles.winColor]}>
                    {Math.round(wagerNum * 2 * 0.9)} RC
                  </Text>
                </View>
                <Text style={styles.rakeLine}>10% platform rake on winnings</Text>
              </>
            )}
            {matchMode === 'casual' && (
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>ELO</Text>
                <Text style={styles.summaryValue}>Casual — streak & unlocks</Text>
              </View>
            )}
          </View>
        )}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <View style={styles.footerRow}>
          {step < STEPS.length - 1 ? (
            <Button label="Next" onPress={next} tone={primaryTone} size="lg" style={styles.footerBtn} />
          ) : (
            <View style={styles.reviewActions}>
              <Button
                label="Discard"
                onPress={() => router.back()}
                variant="outline"
                tone={primaryTone}
                size="lg"
                style={styles.discardBtn}
              />
              <Button
                label="Post challenge"
                onPress={handleCreate}
                loading={loading}
                disabled={!canSubmit}
                tone={primaryTone}
                size="lg"
                style={styles.postBtn}
              />
            </View>
          )}
        </View>
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
    marginBottom: spacing.md,
  },
  titleBlock: { flex: 1, alignItems: 'center' },
  screenTitle: { fontSize: 18, color: colors.text, textAlign: 'center' },
  stepLabel: { marginTop: 4, letterSpacing: 1.2 },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 6,
    marginBottom: spacing.lg,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.border,
  },
  dotActive: { backgroundColor: colors.primary, width: 22 },
  dotDone: { backgroundColor: colors.primary + '80' },
  sectionLabel: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
    letterSpacing: 2,
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
    backgroundColor: 'rgba(0,196,212,0.08)',
  },
  exerciseLabel: {
    fontFamily: typography.fontBodyBold,
    fontSize: 15,
    color: colors.textMuted,
  },
  exerciseLabelSelected: { color: colors.primary },
  exerciseLocked: { opacity: 0.55 },
  lockedHint: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
    marginTop: 2,
  },
  step3Card: { gap: 0 },
  calloutSearch: {
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.primary + '50',
    backgroundColor: colors.bgCard,
    gap: 4,
  },
  calloutHint: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  windowRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  windowChip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.bgElevated,
  },
  windowChipActive: {
    borderColor: colors.primary,
    backgroundColor: 'rgba(0,196,212,0.12)',
  },
  windowChipText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.textMuted,
  },
  windowChipTextActive: { color: colors.primary },
  forfeitHint: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.md,
    lineHeight: 18,
  },
  reviewActions: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
  },
  discardBtn: { flex: 1 },
  postBtn: { flex: 1.4 },
  modeRow: { flexDirection: 'row', gap: spacing.sm },
  modeBtn: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
    alignItems: 'center',
    gap: 4,
  },
  modeBtnActiveCyan: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  modeBtnActiveAmber: {
    borderColor: colors.accent,
    backgroundColor: colors.accent,
  },
  modeSub: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
  },
  wagerLockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.accent + '14',
    borderWidth: 1,
    borderColor: colors.accent + '40',
    borderRadius: radius.md,
    padding: spacing.sm,
    marginTop: spacing.md,
  },
  wagerLockText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.accent,
    flex: 1,
  },
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
  presetSelected: {
    borderColor: colors.accent,
    backgroundColor: 'rgba(240,160,48,0.11)',
  },
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
  balanceLabel: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
  },
  balanceValue: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.accent,
  },
  rulesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rulesTitle: { fontSize: 20, color: colors.text, marginBottom: spacing.md },
  rulesBody: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  summary: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  summaryTitle: { fontSize: 18, color: colors.text, marginBottom: spacing.xs },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryLabel: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
  },
  winColor: { color: colors.success },
  rakeLine: {
    fontFamily: typography.fontBody,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  error: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
  footerRow: { marginTop: spacing.xl },
  footerBtn: { width: '100%' },
});
