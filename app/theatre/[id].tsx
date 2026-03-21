import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch } from '@/services/match.service';
import { getProfile } from '@/services/profile.service';
import { fileDisputeWithEvidence } from '@/services/dispute.service';
import {
  ChevronLeft,
  Trophy,
  AlertTriangle,
  Zap,
  Clock,
  Coins,
  Play,
  Pause,
} from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import Button from '@/components/ui/Button';
import RepTimeline from '@/components/RepTimeline';
import type { Match, Profile } from '@/types/database';
import { EXERCISE_LABELS } from '@/lib/config';
import { playerAnonLabel } from '@/lib/theatreAnon';
import {
  fetchTheatreReactions,
  addTheatreReaction,
  fetchTheatreComments,
  addTheatreComment,
} from '@/services/theatreSocial.service';

const SPEED_OPTIONS = [0.25, 0.5, 1.0] as const;
type SpeedOption = (typeof SPEED_OPTIONS)[number];

export default function CourtroomScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session } = useAuthStore();
  const { show: showToast } = useToastStore();

  const [match, setMatch] = useState<Match | null>(null);
  const [challenger, setChallenger] = useState<Profile | null>(null);
  const [opponent, setOpponent] = useState<Profile | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState<SpeedOption>(1.0);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);

  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);
  const [reactions, setReactions] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [commentDraft, setCommentDraft] = useState('');
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    if (!id) return;
    loadMatch();
  }, [id]);

  async function loadSocial() {
    if (!id) return;
    try {
      const [r, c] = await Promise.all([
        fetchTheatreReactions(id),
        fetchTheatreComments(id),
      ]);
      setReactions(r);
      setComments(c);
    } catch {
      setReactions([]);
      setComments([]);
    }
  }

  useEffect(() => {
    if (match?.id) loadSocial();
  }, [match?.id]);

  async function loadMatch() {
    try {
      const m = await getMatch(id!);
      if (!m) return;
      setMatch(m);
      const duration = (m.duration_seconds ?? 60) * 1000;
      setDurationMs(duration);

      const [c, o] = await Promise.all([
        getProfile(m.challenger_id).catch(() => null),
        m.opponent_id ? getProfile(m.opponent_id).catch(() => null) : Promise.resolve(null),
      ]);
      setChallenger(c);
      setOpponent(o);

      /* Raw video URLs intentionally not used in Theatre UI — trust layer is skeleton + timelines. */
    } catch {}
  }

  useEffect(() => {
    if (!isPlaying) return;
    const id = setInterval(() => {
      setPositionMs((p) => {
        const step = 16 * speed;
        const next = p + step;
        if (next >= durationMs) {
          setIsPlaying(false);
          return durationMs;
        }
        return next;
      });
    }, 16);
    return () => clearInterval(id);
  }, [isPlaying, speed, durationMs]);

  const togglePlayback = useCallback(() => {
    setIsPlaying((p) => !p);
  }, []);

  const handleSpeedChange = useCallback((s: SpeedOption) => {
    setSpeed(s);
  }, []);

  const handleSeek = useCallback((ms: number) => {
    setPositionMs(ms);
  }, []);

  async function handleDispute() {
    if (!disputeReason.trim() || !match || !session?.user) return;
    setDisputing(true);
    try {
      await fileDisputeWithEvidence({
        matchId: match.id,
        reason: disputeReason.trim(),
        challengerVideoPath: match.challenger_video_path,
        opponentVideoPath: match.opponent_video_path,
        challengerRepEvents: match.challenger_rep_events,
        opponentRepEvents: match.opponent_rep_events,
        submittedBy: session.user.id,
      });
      showToast({ type: 'warning', title: 'Dispute filed', message: 'Our team will review shortly.' });
      setShowDispute(false);
      loadMatch();
    } catch {
      showToast({ type: 'error', title: 'Could not file dispute' });
    } finally {
      setDisputing(false);
    }
  }

  const isParticipant =
    match &&
    session?.user &&
    (match.challenger_id === session.user.id || match.opponent_id === session.user.id);
  const canDispute = match?.status === 'completed' && isParticipant;
  const cLabel =
    match && isParticipant
      ? challenger?.display_name ?? 'Challenger'
      : match
        ? playerAnonLabel(match.challenger_id)
        : '—';
  const oLabel =
    match && isParticipant
      ? opponent?.display_name ?? 'Opponent'
      : match?.opponent_id
        ? playerAnonLabel(match.opponent_id)
        : '…';

  const challengerRepEvents = match?.challenger_rep_events ?? [];
  const opponentRepEvents = match?.opponent_rep_events ?? [];

  async function onReact(kind: string) {
    if (!session?.user || !match) return;
    try {
      setSocialLoading(true);
      await addTheatreReaction(match.id, session.user.id, kind);
      await loadSocial();
    } catch {
      showToast({ type: 'error', title: 'Could not react' });
    } finally {
      setSocialLoading(false);
    }
  }

  async function onSendComment() {
    if (!session?.user || !match || !commentDraft.trim()) return;
    try {
      setSocialLoading(true);
      await addTheatreComment(match.id, session.user.id, commentDraft);
      setCommentDraft('');
      await loadSocial();
    } catch {
      showToast({ type: 'error', title: 'Could not post comment' });
    } finally {
      setSocialLoading(false);
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>THEATRE</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {match ? (
          <>
            <View style={styles.vsRow}>
              <View style={styles.playerChip}>
                <Avatar
                  gender={challenger?.avatar_gender ?? 'male'}
                  head={challenger?.avatar_head}
                  torso={challenger?.avatar_torso}
                  legs={challenger?.avatar_legs}
                  size={44}
                />
                <View>
                  <Text style={styles.playerName}>{cLabel}</Text>
                  <Text style={styles.playerReps}>
                    {match.challenger_reps} reps
                    {match.winner_id === match.challenger_id && (
                      <Text style={styles.winnerTag}> 🏆</Text>
                    )}
                  </Text>
                </View>
              </View>

              <View style={styles.vsBlock}>
                <Text style={styles.vs}>VS</Text>
                <View style={styles.wagerRow}>
                  <Coins size={12} color={colors.accent} />
                  <Text style={styles.wagerText}>{Math.round(match.wager_amount)} RC</Text>
                </View>
              </View>

              <View style={[styles.playerChip, styles.playerChipRight]}>
                <View style={styles.playerChipTextRight}>
                  <Text style={[styles.playerName, styles.textRight]}>{oLabel}</Text>
                  <Text style={[styles.playerReps, styles.textRight]}>
                    {match.opponent_reps} reps
                    {match.winner_id === match.opponent_id && (
                      <Text style={styles.winnerTag}> 🏆</Text>
                    )}
                  </Text>
                </View>
                <Avatar
                  gender={opponent?.avatar_gender ?? 'male'}
                  head={opponent?.avatar_head}
                  torso={opponent?.avatar_torso}
                  legs={opponent?.avatar_legs}
                  size={44}
                />
              </View>
            </View>

            <View style={styles.skeletonSection}>
              <Zap size={28} color={colors.primary} />
              <Text style={styles.skeletonTitle}>Theatre playback</Text>
              <Text style={styles.skeletonBody}>
                No raw video in Theatre — synced skeleton panes + rep timelines below. Keypoint replay
                storage can be wired to these panes when available.
              </Text>
              <View style={styles.dualSkeleton}>
                <View style={[styles.skeletonPane, { borderColor: colors.primary + '55' }]}>
                  <Text style={styles.skeletonPaneLabel}>{cLabel.split(' ')[0] ?? 'P1'}</Text>
                  <View style={styles.skeletonStickFigure}>
                    <View style={[styles.skeletonJoint, { backgroundColor: colors.primary }]} />
                    <View style={styles.skeletonBar} />
                    <View style={[styles.skeletonJoint, { backgroundColor: colors.primary }]} />
                  </View>
                </View>
                <View style={[styles.skeletonPane, { borderColor: colors.secondary + '55' }]}>
                  <Text style={styles.skeletonPaneLabel}>{oLabel.split(' ')[0] ?? 'P2'}</Text>
                  <View style={styles.skeletonStickFigure}>
                    <View style={[styles.skeletonJoint, { backgroundColor: colors.secondary }]} />
                    <View style={styles.skeletonBar} />
                    <View style={[styles.skeletonJoint, { backgroundColor: colors.secondary }]} />
                  </View>
                </View>
              </View>

              <View style={styles.controls}>
                <TouchableOpacity style={styles.playBtn} onPress={togglePlayback}>
                  {isPlaying ? (
                    <Pause size={22} color={colors.bg} />
                  ) : (
                    <Play size={22} color={colors.bg} />
                  )}
                </TouchableOpacity>

                <View style={styles.speedRow}>
                  {SPEED_OPTIONS.map((s) => (
                    <TouchableOpacity
                      key={s}
                      style={[styles.speedBtn, speed === s && styles.speedBtnActive]}
                      onPress={() => handleSpeedChange(s)}
                    >
                      <Text style={[styles.speedText, speed === s && styles.speedTextActive]}>
                        {s}×
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            </View>

            {challengerRepEvents.length > 0 && (
              <View style={styles.timelineCard}>
                <Text style={styles.timelineTitle}>REP TIMELINE</Text>
                <RepTimeline
                  repEvents={challengerRepEvents}
                  durationMs={durationMs}
                  currentPositionMs={positionMs}
                  onSeek={handleSeek}
                  label={cLabel.split(' ')[0] ?? 'P'}
                  tintColor={colors.primary}
                />
                {opponentRepEvents.length > 0 && (
                  <View style={styles.timelineGap}>
                    <RepTimeline
                      repEvents={opponentRepEvents}
                      durationMs={durationMs}
                      currentPositionMs={positionMs}
                      onSeek={handleSeek}
                      label={oLabel.split(' ')[0] ?? 'P'}
                      tintColor={colors.secondary}
                    />
                  </View>
                )}
              </View>
            )}

            <View style={styles.socialCard}>
              <Text style={styles.socialTitle}>Reactions</Text>
              <View style={styles.reactRow}>
                {(['fire', 'clap', 'skull'] as const).map((k) => (
                  <TouchableOpacity
                    key={k}
                    style={styles.reactBtn}
                    onPress={() => onReact(k)}
                    disabled={socialLoading || !session?.user}
                  >
                    <Text style={styles.reactEmoji}>
                      {k === 'fire' ? '🔥' : k === 'clap' ? '👏' : '💀'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.reactionMeta}>{reactions.length} on this session</Text>
              <Text style={styles.socialTitle}>Comments</Text>
              {comments.map((c) => (
                <View key={c.id} style={styles.commentRow}>
                  <Text style={styles.commentAuthor}>
                    {playerAnonLabel(c.user_id)}
                  </Text>
                  <Text style={styles.commentBody}>{c.body}</Text>
                </View>
              ))}
              {session?.user && (
                <View style={styles.commentComposer}>
                  <TextInput
                    style={styles.commentInput}
                    value={commentDraft}
                    onChangeText={setCommentDraft}
                    placeholder="Add a comment…"
                    placeholderTextColor={colors.textMuted}
                    multiline
                  />
                  <TouchableOpacity
                    style={styles.commentSend}
                    onPress={onSendComment}
                    disabled={socialLoading || !commentDraft.trim()}
                  >
                    <Text style={styles.commentSendText}>Post</Text>
                  </TouchableOpacity>
                </View>
              )}
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
                <Coins size={16} color={colors.accent} />
                <Text style={styles.detailLabel}>Wager</Text>
                <Text style={styles.detailValue}>{Math.round(match.wager_amount)} RepCoins</Text>
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

            {canDispute && !showDispute && match.status !== 'disputed' && (
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
                  <Button
                    label="Submit Dispute"
                    variant="danger"
                    onPress={handleDispute}
                    loading={disputing}
                    size="sm"
                  />
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
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  backBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 3,
  },
  scroll: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.md,
    paddingBottom: 80,
  },
  vsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.xs,
  },
  playerChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  playerChipRight: {
    justifyContent: 'flex-end',
  },
  playerChipTextRight: {
    alignItems: 'flex-end',
  },
  playerName: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.text,
  },
  playerReps: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
  textRight: { textAlign: 'right' },
  winnerTag: { color: colors.accent },
  vsBlock: { alignItems: 'center', gap: 2 },
  vs: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  wagerRow: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wagerText: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 12,
    color: colors.accent,
  },
  skeletonSection: {
    gap: spacing.sm,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
    alignItems: 'center',
  },
  skeletonTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
  },
  skeletonBody: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  dualSkeleton: {
    flexDirection: 'row',
    gap: spacing.sm,
    width: '100%',
    marginTop: spacing.sm,
  },
  skeletonPane: {
    flex: 1,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    minHeight: 140,
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  skeletonPaneLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  skeletonStickFigure: {
    alignItems: 'center',
    gap: 6,
  },
  skeletonJoint: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  skeletonBar: {
    width: 4,
    height: 48,
    backgroundColor: colors.border,
    borderRadius: 2,
  },
  videoSection: {
    gap: spacing.sm,
  },
  videoRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  videoWrapper: {
    flex: 1,
    gap: 4,
  },
  videoLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  video: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: radius.md,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    width: '100%',
    aspectRatio: 9 / 16,
    borderRadius: radius.md,
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  videoPlaceholderText: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  playBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  speedRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    flex: 1,
    justifyContent: 'flex-end',
  },
  speedBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  speedBtnActive: {
    backgroundColor: colors.primary + '22',
    borderColor: colors.primary,
  },
  speedText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textMuted,
  },
  speedTextActive: { color: colors.primary },
  publicTheatre: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.md,
  },
  publicTheatreTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
  },
  publicTheatreBody: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
  },
  socialCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  socialTitle: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  reactRow: { flexDirection: 'row', gap: spacing.md },
  reactBtn: {
    padding: spacing.sm,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
  },
  reactEmoji: { fontSize: 22 },
  reactionMeta: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  commentRow: {
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderSubtle,
  },
  commentAuthor: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.primary,
  },
  commentBody: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.text,
    marginTop: 2,
  },
  commentComposer: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-end', marginTop: spacing.sm },
  commentInput: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
    color: colors.text,
    fontFamily: typography.fontBody,
  },
  commentSend: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.primary,
    borderRadius: radius.md,
  },
  commentSendText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 13,
    color: colors.textInverse,
  },
  noVideoCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  noVideoText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
  },
  timelineCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  timelineTitle: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 2,
  },
  timelineGap: { marginTop: spacing.sm },
  detailsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  detailLabel: {
    flex: 1,
    fontFamily: typography.fontBody,
    fontSize: 14,
    color: colors.textSecondary,
  },
  detailValue: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  disputeCard: {
    backgroundColor: 'rgba(255,140,0,0.08)',
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.warning,
    gap: spacing.xs,
    alignItems: 'center',
  },
  disputeTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.warning,
  },
  disputeReason: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
  },
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
  disputeBtnText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.warning,
  },
  disputeForm: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  disputeFormTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
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
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
  },
  loadingText: {
    fontFamily: typography.fontBody,
    fontSize: 16,
    color: colors.textMuted,
  },
});
