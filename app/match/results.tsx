import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, TouchableOpacity, ScrollView, Modal, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useMatchStore } from '@/stores/matchStore';
import { useToastStore } from '@/stores/toastStore';
import { Trophy, Frown, Zap, AlertTriangle } from 'lucide-react-native';
import Button from '@/components/ui/Button';
import { LevelUpAnimation } from '@/components/LevelUpAnimation';
import { checkAndAwardBadges } from '@/services/badge.service';
import { getMatch, fileDispute } from '@/services/match.service';
import { calculateLevel } from '@/lib/levelSystem';
import type { Match } from '@/types/database';
import type { Level } from '@/lib/levelSystem';

function ConfettiPiece({ delay, color }: { delay: number; color: string }) {
  const anim = useRef(new Animated.Value(0)).current;
  const x = useRef(Math.random() * 400 - 200).current;
  const rot = useRef(Math.random() * 720).current;

  useEffect(() => {
    setTimeout(() => {
      Animated.timing(anim, { toValue: 1, duration: 1800, useNativeDriver: true }).start();
    }, delay);
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 0,
        left: '50%',
        width: 8,
        height: 8,
        borderRadius: 2,
        backgroundColor: color,
        transform: [
          { translateX: anim.interpolate({ inputRange: [0, 1], outputRange: [0, x] }) },
          { translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 700] }) },
          { rotate: anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${rot}deg`] }) },
        ],
        opacity: anim.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
      }}
    />
  );
}

const CONFETTI_COLORS = [colors.primary, colors.secondary, colors.accent, colors.success, '#ff6b6b', '#ffd93d'];

export default function ResultsScreen() {
  const { matchId, myReps, isWinner } = useLocalSearchParams<{ matchId: string; myReps: string; isWinner: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile, refreshProfile } = useAuthStore();
  const { setActiveMatch } = useMatchStore();
  const { show: showToast } = useToastStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [newLevel, setNewLevel] = useState<Level>(1);
  const [previousLevel, setPreviousLevel] = useState<Level>(1);
  const [newXp, setNewXp] = useState(0);
  const [disputeVisible, setDisputeVisible] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputeLoading, setDisputeLoading] = useState(false);

  const won = isWinner === 'true';
  const reps = parseInt(myReps ?? '0');

  const titleAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, tension: 60, friction: 6 }),
      Animated.timing(titleAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
    ]).start();

    if (matchId) {
      getMatch(matchId).then((m) => {
        if (m) setMatch(m);
      });
    }

    if (session?.user && profile) {
      const prevLevel = calculateLevel(profile.total_xp ?? 0);

      checkAndAwardBadges(session.user.id, profile, reps).then((badges) => {
        badges.forEach((b) => {
          showToast({ type: 'badge', title: 'Badge Earned!', message: b.replace(/_/g, ' ') });
        });
      });

      refreshProfile().then(() => {
        const updatedProfile = useAuthStore.getState().profile;
        if (updatedProfile) {
          const updatedXp = updatedProfile.total_xp ?? 0;
          const updatedLevel = calculateLevel(updatedXp);
          if (updatedLevel > prevLevel) {
            setPreviousLevel(prevLevel);
            setNewLevel(updatedLevel);
            setNewXp(updatedXp);
            setLevelUpVisible(true);
          }
        }
      });
    }

    return () => {
      setActiveMatch(null);
    };
  }, [matchId, session?.user?.id]);

  async function handleFileDispute() {
    if (!matchId || !disputeReason.trim()) return;
    setDisputeLoading(true);
    try {
      await fileDispute(matchId, disputeReason.trim());
      showToast({ type: 'success', title: 'Dispute filed', message: 'Our team will review this match.' });
      setDisputeVisible(false);
      setDisputeReason('');
    } catch {
      showToast({ type: 'error', title: 'Failed to file dispute' });
    } finally {
      setDisputeLoading(false);
    }
  }

  const confettiPieces = won
    ? Array.from({ length: 40 }, (_, i) => ({
        delay: i * 60,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
      }))
    : [];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {confettiPieces.map((p, i) => (
        <ConfettiPiece key={i} delay={p.delay} color={p.color} />
      ))}

      <LevelUpAnimation
        visible={levelUpVisible}
        level={newLevel}
        previousLevel={previousLevel}
        xp={newXp}
        onDismiss={() => setLevelUpVisible(false)}
      />

      <Modal visible={disputeVisible} transparent animationType="fade" onRequestClose={() => setDisputeVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + spacing.lg }]}>
            <View style={styles.modalHeader}>
              <AlertTriangle size={22} color={colors.warning} />
              <Text style={styles.modalTitle}>File a Dispute</Text>
            </View>
            <Text style={styles.modalSubtitle}>Describe the issue with this match. Our team will review it.</Text>
            <TextInput
              style={styles.disputeInput}
              value={disputeReason}
              onChangeText={setDisputeReason}
              placeholder="Describe what went wrong..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setDisputeVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitDisputeBtn, (!disputeReason.trim() || disputeLoading) && styles.btnDisabled]}
                onPress={handleFileDispute}
                disabled={!disputeReason.trim() || disputeLoading}
              >
                <Text style={styles.submitDisputeBtnText}>{disputeLoading ? 'Filing...' : 'Submit'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View style={[styles.heroSection, { opacity: titleAnim, transform: [{ scale: scaleAnim }] }]}>
          {won ? (
            <Trophy size={80} color={colors.accent} />
          ) : (
            <Frown size={80} color={colors.textMuted} />
          )}
          <Text style={[styles.resultTitle, won ? styles.winTitle : styles.loseTitle]}>
            {won ? 'YOU WON!' : 'YOU LOST'}
          </Text>
          <Text style={styles.repDisplay}>{reps}</Text>
          <Text style={styles.repSub}>REPS</Text>
        </Animated.View>

        {match && (
          <View style={styles.scoreComparison}>
            <View style={styles.scoreColumn}>
              <Text style={styles.scoreColumnLabel}>Your Reps</Text>
              <Text style={[styles.scoreColumnValue, won && styles.winColor]}>{match.challenger_id === session?.user?.id ? match.challenger_reps : match.opponent_reps}</Text>
            </View>
            <Text style={styles.vsText}>vs</Text>
            <View style={styles.scoreColumn}>
              <Text style={styles.scoreColumnLabel}>Opponent Reps</Text>
              <Text style={[styles.scoreColumnValue, !won && styles.winColor]}>{match.challenger_id === session?.user?.id ? match.opponent_reps : match.challenger_reps}</Text>
            </View>
          </View>
        )}

        <View style={styles.statsCard}>
          <View style={styles.statRow}>
            <Zap size={18} color={colors.primary} />
            <Text style={styles.statLabel}>Match ID</Text>
            <Text style={styles.statValue}>#{matchId?.slice(-8)}</Text>
          </View>
          <View style={[styles.statRow, styles.statRowBorder]}>
            <Trophy size={18} color={colors.accent} />
            <Text style={styles.statLabel}>Result</Text>
            <Text style={[styles.statValue, won ? styles.winColor : styles.loseColor]}>
              {won ? 'Victory' : 'Defeat'}
            </Text>
          </View>
        </View>

        <View style={styles.actions}>
          <Button
            label="Back to Home"
            onPress={() => router.replace('/(tabs)')}
            variant="primary"
            size="lg"
            style={styles.actionBtn}
          />
          <Button
            label="View Match"
            onPress={() => router.replace({ pathname: '/theatre/[id]', params: { id: matchId! } })}
            variant="outline"
            size="lg"
            style={styles.actionBtn}
          />
          <TouchableOpacity style={styles.disputeLink} onPress={() => setDisputeVisible(true)}>
            <AlertTriangle size={14} color={colors.textMuted} />
            <Text style={styles.disputeLinkText}>File a dispute</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  scroll: {
    flexGrow: 1,
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xxxl,
    paddingTop: spacing.xl,
  },
  heroSection: {
    alignItems: 'center',
    marginBottom: spacing.xxl,
  },
  resultTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 42,
    marginTop: spacing.md,
    letterSpacing: 3,
  },
  winTitle: { color: colors.accent },
  loseTitle: { color: colors.textMuted },
  repDisplay: {
    fontFamily: typography.fontDisplay,
    fontSize: 96,
    color: colors.text,
    marginTop: spacing.lg,
  },
  repSub: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 16,
    color: colors.textSecondary,
    letterSpacing: 6,
  },
  scoreComparison: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  scoreColumn: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  scoreColumnLabel: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  scoreColumnValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 48,
    color: colors.text,
  },
  vsText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    color: colors.textMuted,
    marginHorizontal: spacing.md,
  },
  statsCard: {
    width: '100%',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.xl,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
  },
  statRowBorder: {
    borderTopWidth: 1,
    borderTopColor: colors.borderSubtle,
  },
  statLabel: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  statValue: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  winColor: { color: colors.success },
  loseColor: { color: colors.error },
  actions: {
    width: '100%',
    gap: spacing.sm,
    alignItems: 'center',
  },
  actionBtn: { width: '100%' },
  disputeLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    marginTop: spacing.xs,
  },
  disputeLinkText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textDecorationLine: 'underline',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalCard: {
    backgroundColor: colors.bgCard,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    padding: spacing.xl,
    gap: spacing.md,
    borderTopWidth: 1,
    borderColor: colors.border,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 18,
    color: colors.text,
  },
  modalSubtitle: {
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  disputeInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.text,
    minHeight: 100,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.textSecondary,
  },
  submitDisputeBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.warning,
  },
  submitDisputeBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: '#000',
  },
  btnDisabled: {
    opacity: 0.4,
  },
});
