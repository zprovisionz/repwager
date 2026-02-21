import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch, fileDispute } from '@/services/match.service';
import { getProfile } from '@/services/profile.service';
import { ChevronLeft, Trophy, AlertTriangle, User, Zap, DollarSign, Clock } from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import Button from '@/components/ui/Button';
import type { Match, Profile } from '@/types/database';
import { EXERCISE_LABELS } from '@/lib/config';

export default function TheatreScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [challenger, setChallenger] = useState<Profile | null>(null);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadMatch();
  }, [id]);

  async function loadMatch() {
    try {
      const m = await getMatch(id!);
      if (!m) return;
      setMatch(m);
      const [c, o] = await Promise.all([
        getProfile(m.challenger_id),
        m.opponent_id ? getProfile(m.opponent_id) : Promise.resolve(null),
      ]);
      setChallenger(c);
      setOpponent(o);
    } catch {}
  }

  async function handleDispute() {
    if (!disputeReason.trim() || !match) return;
    setDisputing(true);
    try {
      await fileDispute(match.id, disputeReason.trim());
      showToast({ type: 'warning', title: 'Dispute filed', message: 'Our team will review shortly.' });
      setShowDispute(false);
      loadMatch();
    } catch {
      showToast({ type: 'error', title: 'Could not file dispute' });
    } finally {
      setDisputing(false);
    }
  }

  const isParticipant = match && session?.user && (match.challenger_id === session.user.id || match.opponent_id === session.user.id);
  const canDispute = match?.status === 'completed' && isParticipant;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>Match Review</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {match ? (
          <>
            <View style={styles.vsCard}>
              <View style={styles.playerBlock}>
                <Avatar
                  gender={challenger?.avatar_gender ?? 'male'}
                  head={challenger?.avatar_head}
                  torso={challenger?.avatar_torso}
                  legs={challenger?.avatar_legs}
                  size={72}
                />
                <Text style={styles.playerName}>{challenger?.display_name ?? '---'}</Text>
                <Text style={styles.playerHandle}>@{challenger?.username}</Text>
                <Text style={styles.repScore}>{match.challenger_reps}</Text>
                <Text style={styles.repSub}>reps</Text>
                {match.winner_id === match.challenger_id && (
                  <View style={styles.winBadge}>
                    <Trophy size={12} color={colors.accent} />
                    <Text style={styles.winBadgeText}>WINNER</Text>
                  </View>
                )}
              </View>

              <View style={styles.vsBlock}>
                <Text style={styles.vs}>VS</Text>
                <View style={styles.wagerBlock}>
                  <DollarSign size={14} color={colors.accent} />
                  <Text style={styles.wagerText}>{match.wager_amount.toFixed(2)}</Text>
                </View>
              </View>

              <View style={styles.playerBlock}>
                <Avatar
                  gender={opponent?.avatar_gender ?? 'male'}
                  head={opponent?.avatar_head}
                  torso={opponent?.avatar_torso}
                  legs={opponent?.avatar_legs}
                  size={72}
                />
                <Text style={styles.playerName}>{opponent?.display_name ?? 'Waiting...'}</Text>
                <Text style={styles.playerHandle}>@{opponent?.username ?? '---'}</Text>
                <Text style={styles.repScore}>{match.opponent_reps}</Text>
                <Text style={styles.repSub}>reps</Text>
                {match.winner_id === match.opponent_id && (
                  <View style={styles.winBadge}>
                    <Trophy size={12} color={colors.accent} />
                    <Text style={styles.winBadgeText}>WINNER</Text>
                  </View>
                )}
              </View>
            </View>

            <View style={styles.detailsCard}>
              <View style={styles.detailRow}>
                <Zap size={16} color={colors.primary} />
                <Text style={styles.detailLabel}>Exercise</Text>
                <Text style={styles.detailValue}>{EXERCISE_LABELS[match.exercise_type]}</Text>
              </View>
              <View style={styles.detailRow}>
                <Clock size={16} color={colors.textSecondary} />
                <Text style={styles.detailLabel}>Duration</Text>
                <Text style={styles.detailValue}>{match.duration_seconds}s</Text>
              </View>
              <View style={styles.detailRow}>
                <DollarSign size={16} color={colors.accent} />
                <Text style={styles.detailLabel}>Wager</Text>
                <Text style={styles.detailValue}>${match.wager_amount.toFixed(2)}</Text>
              </View>
              {match.completed_at && (
                <View style={styles.detailRow}>
                  <Clock size={16} color={colors.textMuted} />
                  <Text style={styles.detailLabel}>Completed</Text>
                  <Text style={styles.detailValue}>{new Date(match.completed_at).toLocaleString()}</Text>
                </View>
              )}
            </View>

            {match.status === 'disputed' && (
              <View style={styles.disputeCard}>
                <AlertTriangle size={20} color={colors.warning} />
                <Text style={styles.disputeTitle}>Dispute Filed</Text>
                <Text style={styles.disputeReason}>{match.dispute_reason}</Text>
              </View>
            )}

            {canDispute && !showDispute && (
              <TouchableOpacity style={styles.disputeBtn} onPress={() => setShowDispute(true)}>
                <AlertTriangle size={16} color={colors.warning} />
                <Text style={styles.disputeBtnText}>File Dispute</Text>
              </TouchableOpacity>
            )}

            {showDispute && (
              <View style={styles.disputeForm}>
                <Text style={styles.disputeFormTitle}>Describe the issue</Text>
                <TextInput
                  style={styles.disputeInput}
                  value={disputeReason}
                  onChangeText={setDisputeReason}
                  placeholder="What went wrong with this match?"
                  placeholderTextColor={colors.textMuted}
                  multiline
                  numberOfLines={4}
                />
                <View style={styles.disputeActions}>
                  <Button label="Cancel" variant="ghost" onPress={() => setShowDispute(false)} size="sm" />
                  <Button label="Submit Dispute" variant="danger" onPress={handleDispute} loading={disputing} size="sm" />
                </View>
              </View>
            )}
          </>
        ) : (
          <View style={styles.loading}>
            <Text style={styles.loadingText}>Loading match...</Text>
          </View>
        )}
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
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: { fontFamily: typography.fontDisplay, fontSize: 16, color: colors.text, letterSpacing: 1 },
  scroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.lg, gap: spacing.md },
  vsCard: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.sm,
  },
  playerBlock: { flex: 1, alignItems: 'center', gap: spacing.xs },
  playerName: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text, textAlign: 'center' },
  playerHandle: { fontFamily: typography.fontBody, fontSize: 12, color: colors.textMuted },
  repScore: { fontFamily: typography.fontDisplay, fontSize: 40, color: colors.primary, marginTop: spacing.xs },
  repSub: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  winBadgeText: { fontFamily: typography.fontBodyBold, fontSize: 10, color: colors.accent, letterSpacing: 1 },
  vsBlock: { alignItems: 'center', gap: spacing.xs },
  vs: { fontFamily: typography.fontDisplay, fontSize: 18, color: colors.textMuted, letterSpacing: 2 },
  wagerBlock: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wagerText: { fontFamily: typography.fontDisplayMedium, fontSize: 16, color: colors.accent },
  detailsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailLabel: { flex: 1, fontFamily: typography.fontBody, fontSize: 14, color: colors.textSecondary },
  detailValue: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  disputeCard: {
    backgroundColor: 'rgba(255,140,0,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.xs,
    alignItems: 'center',
  },
  disputeTitle: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.warning },
  disputeReason: { fontFamily: typography.fontBody, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  disputeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.warning,
    backgroundColor: 'rgba(255,140,0,0.08)',
  },
  disputeBtnText: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.warning },
  disputeForm: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  disputeFormTitle: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  disputeInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontFamily: typography.fontBody,
    fontSize: 14,
    minHeight: 100,
    textAlignVertical: 'top',
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  disputeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: spacing.xxl },
  loadingText: { fontFamily: typography.fontBody, fontSize: 16, color: colors.textMuted },
});
