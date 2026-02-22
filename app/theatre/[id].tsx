import { useState, useEffect } from 'react';
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
import * as Haptics from 'expo-haptics';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { useAuthStore } from '@/stores/authStore';
import { useToastStore } from '@/stores/toastStore';
import { getMatch, fileDispute } from '@/services/match.service';
import { theatreService } from '@/services/theatre.service';
import { videoService } from '@/services/video.service';
import {
  ChevronLeft,
  Trophy,
  AlertTriangle,
  DollarSign,
  Clock,
  Zap,
  Eye,
  EyeOff,
  BarChart2,
  FileText,
  Share2,
  RotateCcw,
} from 'lucide-react-native';
import Avatar from '@/components/Avatar';
import Button from '@/components/ui/Button';
import VideoPlayer from '@/components/VideoPlayer';
import RepTimeline from '@/components/RepTimeline';
import RepComparisonGraph from '@/components/RepComparisonGraph';
import ShareClipPreview from '@/components/ShareClipPreview';
import type { Match, Profile } from '@/types/database';
import type { TheatreMatch, FormQualityMarker } from '@/types/theatre';
import { EXERCISE_LABELS } from '@/lib/config';

type ActiveVideo = 'self' | 'opponent';
type BottomTab = 'stats' | 'notes' | 'share' | 'rematch';

export default function TheatreDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { session, profile } = useAuthStore();
  const { show: showToast } = useToastStore();

  // Match data
  const [match, setMatch] = useState<Match | null>(null);
  const [theatreMatch, setTheatreMatch] = useState<TheatreMatch | null>(null);
  const [selfUrl, setSelfUrl] = useState<string | null>(null);
  const [opponentUrl, setOpponentUrl] = useState<string | null>(null);
  const [repMarkers, setRepMarkers] = useState<FormQualityMarker[]>([]);
  const [notes, setNotes] = useState('');

  // UI state
  const [activeVideo, setActiveVideo] = useState<ActiveVideo>('self');
  const [maskingEnabled, setMaskingEnabled] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [seekToMs, setSeekToMs] = useState<number | null>(null);
  const [bottomTab, setBottomTab] = useState<BottomTab>('stats');
  const [savingNotes, setSavingNotes] = useState(false);

  // Dispute state
  const [showDispute, setShowDispute] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [disputing, setDisputing] = useState(false);

  const userId = session?.user?.id;

  useEffect(() => {
    if (!id || !userId) return;
    loadAll();
  }, [id, userId]);

  async function loadAll() {
    try {
      // Load raw match (for dispute + profile lookup)
      const rawMatch = await getMatch(id!);
      setMatch(rawMatch);

      // Load Theatre enriched match
      const tm = await theatreService.getMatchForPlayback(id!, userId!);
      setTheatreMatch(tm);

      if (tm) {
        const duration = tm.durationSeconds ?? 60;
        const markers = theatreService.getRepTimeline(tm.myReps, duration);
        setRepMarkers(markers);
      }

      // Load videos
      const videos = await videoService.getMatchVideos(id!, userId!);
      setSelfUrl(videos.self);
      setOpponentUrl(videos.opponent);

      // Load notes
      const savedNotes = await theatreService.getPrivateNotes(id!, userId!);
      if (savedNotes) setNotes(savedNotes);
    } catch (e) {
      console.error('[Theatre] loadAll error:', e);
    }
  }

  async function handleDispute() {
    if (!disputeReason.trim() || !match) return;
    setDisputing(true);
    try {
      await fileDispute(match.id, disputeReason.trim());
      showToast({ type: 'warning', title: 'Dispute filed', message: 'Our team will review shortly.' });
      setShowDispute(false);
      loadAll();
    } catch {
      showToast({ type: 'error', title: 'Could not file dispute' });
    } finally {
      setDisputing(false);
    }
  }

  async function handleSaveNotes() {
    if (!userId || !id) return;
    setSavingNotes(true);
    await theatreService.savePrivateNotes(id, userId, notes);
    setSavingNotes(false);
    showToast({ type: 'success', title: 'Notes saved' });
  }

  function toggleMasking() {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setMaskingEnabled((v) => !v);
  }

  function handleRepTap(marker: FormQualityMarker) {
    setSeekToMs(marker.timestamp);
    // Reset after a tick so the same value can be re-set
    setTimeout(() => setSeekToMs(null), 100);
  }

  const currentVideoUri = activeVideo === 'self' ? selfUrl : opponentUrl;
  const maskColor = videoService.getMaskColor(activeVideo);
  const duration = theatreMatch?.durationSeconds ?? 60;
  const isParticipant = match && userId && (match.challenger_id === userId || match.opponent_id === userId);
  const canDispute = match?.status === 'completed' && isParticipant;

  // Derive profiles from theatreMatch for display
  const myReps = theatreMatch?.myReps ?? 0;
  const opponentReps = theatreMatch?.opponentReps ?? 0;
  const outcome = theatreMatch?.outcome ?? 'loss';

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Top bar */}
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>THEATRE</Text>
        <TouchableOpacity onPress={toggleMasking} style={styles.maskBtn}>
          {maskingEnabled
            ? <EyeOff size={22} color={colors.primary} />
            : <Eye size={22} color={colors.textMuted} />}
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* VS card */}
        {theatreMatch && (
          <View style={styles.vsCard}>
            {/* My side */}
            <View style={styles.playerBlock}>
              <View style={[
                styles.avatarWrap,
                maskingEnabled && { backgroundColor: 'rgba(0,212,255,0.3)', borderRadius: 40 }
              ]}>
                <Avatar
                  gender={profile?.avatar_gender ?? 'male'}
                  head={profile?.avatar_head}
                  torso={profile?.avatar_torso}
                  legs={profile?.avatar_legs}
                  size={56}
                />
              </View>
              <Text style={styles.playerLabel}>YOU</Text>
              <Text style={styles.repScore}>{myReps}</Text>
              <Text style={styles.repSub}>reps</Text>
              {outcome === 'win' && (
                <View style={styles.winBadge}>
                  <Trophy size={11} color={colors.accent} />
                  <Text style={styles.winBadgeText}>WINNER</Text>
                </View>
              )}
            </View>

            <View style={styles.vsBlock}>
              <Text style={styles.vs}>VS</Text>
              {!!theatreMatch.wagerAmount && (
                <View style={styles.wagerBlock}>
                  <DollarSign size={13} color={colors.accent} />
                  <Text style={styles.wagerText}>{theatreMatch.wagerAmount.toFixed(2)}</Text>
                </View>
              )}
              <View style={[
                styles.outcomePill,
                { borderColor: outcome === 'win' ? colors.accent : outcome === 'loss' ? colors.secondary : colors.warning },
              ]}>
                <Text style={[
                  styles.outcomePillText,
                  { color: outcome === 'win' ? colors.accent : outcome === 'loss' ? colors.secondary : colors.warning },
                ]}>
                  {outcome.toUpperCase()}
                </Text>
              </View>
            </View>

            {/* Opponent side */}
            <View style={styles.playerBlock}>
              <View style={[
                styles.avatarWrap,
                maskingEnabled && { backgroundColor: 'rgba(255,45,120,0.3)', borderRadius: 40 }
              ]}>
                {theatreMatch.opponentAvatar ? (
                  <Avatar
                    gender={theatreMatch.opponentAvatar.gender}
                    head={theatreMatch.opponentAvatar.head}
                    torso={theatreMatch.opponentAvatar.torso}
                    legs={theatreMatch.opponentAvatar.legs}
                    size={56}
                  />
                ) : (
                  <View style={[styles.avatarWrap, { backgroundColor: colors.bgHighlight }]} />
                )}
              </View>
              <Text style={styles.playerLabel} numberOfLines={1}>{theatreMatch.opponentName}</Text>
              <Text style={styles.repScore}>{opponentReps}</Text>
              <Text style={styles.repSub}>reps</Text>
              {outcome === 'loss' && (
                <View style={[styles.winBadge, { borderColor: colors.secondary, backgroundColor: colors.secondary + '18' }]}>
                  <Trophy size={11} color={colors.secondary} />
                  <Text style={[styles.winBadgeText, { color: colors.secondary }]}>WINNER</Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Video toggle */}
        <View style={styles.videoToggleRow}>
          <TouchableOpacity
            style={[styles.toggleBtn, activeVideo === 'self' && styles.toggleBtnActive]}
            onPress={() => setActiveVideo('self')}
          >
            <View style={[styles.toggleDot, { backgroundColor: colors.primary }]} />
            <Text style={[styles.toggleText, activeVideo === 'self' && { color: colors.primary }]}>
              My Video
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.toggleBtn, activeVideo === 'opponent' && styles.toggleBtnActiveOpp]}
            onPress={() => setActiveVideo('opponent')}
          >
            <View style={[styles.toggleDot, { backgroundColor: colors.secondary }]} />
            <Text style={[styles.toggleText, activeVideo === 'opponent' && { color: colors.secondary }]}>
              Opponent Video
            </Text>
          </TouchableOpacity>
        </View>

        {/* Video player */}
        <VideoPlayer
          uri={currentVideoUri}
          maskingEnabled={maskingEnabled}
          maskColor={maskColor}
          onTimeUpdate={setCurrentMs}
          seekToMs={seekToMs}
        />

        {/* Rep timeline */}
        {repMarkers.length > 0 && (
          <RepTimeline
            markers={repMarkers}
            durationMs={duration * 1000}
            currentMs={currentMs}
            onRepTap={handleRepTap}
          />
        )}

        {/* Bottom action tabs */}
        <View style={styles.bottomTabBar}>
          {([
            { key: 'stats', icon: BarChart2, label: 'Stats' },
            { key: 'notes', icon: FileText, label: 'Notes' },
            { key: 'share', icon: Share2, label: 'Share' },
            { key: 'rematch', icon: RotateCcw, label: 'Rematch' },
          ] as const).map(({ key, icon: Icon, label }) => (
            <TouchableOpacity
              key={key}
              style={[styles.bottomTab, bottomTab === key && styles.bottomTabActive]}
              onPress={() => setBottomTab(key)}
            >
              <Icon size={18} color={bottomTab === key ? colors.primary : colors.textMuted} />
              <Text style={[styles.bottomTabText, bottomTab === key && { color: colors.primary }]}>
                {label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        {bottomTab === 'stats' && theatreMatch && (
          <View style={{ gap: spacing.md }}>
            <RepComparisonGraph
              selfReps={myReps}
              opponentReps={opponentReps}
              selfName="You"
              opponentName={theatreMatch.opponentName}
            />
            <View style={styles.detailsCard}>
              <DetailRow icon={<Zap size={15} color={colors.primary} />} label="Exercise" value={EXERCISE_LABELS[theatreMatch.exerciseType]} />
              <DetailRow icon={<Clock size={15} color={colors.textSecondary} />} label="Duration" value={`${duration}s`} />
              {!!theatreMatch.wagerAmount && (
                <DetailRow icon={<DollarSign size={15} color={colors.accent} />} label="Wager" value={`$${theatreMatch.wagerAmount.toFixed(2)}`} />
              )}
              <DetailRow
                icon={<Trophy size={15} color={colors.textSecondary} />}
                label="Mode"
                value={theatreMatch.mode === 'competitive' ? 'Competitive' : 'Casual'}
              />
            </View>
          </View>
        )}

        {bottomTab === 'notes' && (
          <View style={styles.notesCard}>
            <Text style={styles.notesLabel}>Private Notes</Text>
            <TextInput
              style={styles.notesInput}
              value={notes}
              onChangeText={setNotes}
              placeholder="Add your notes for this match..."
              placeholderTextColor={colors.textMuted}
              multiline
              numberOfLines={5}
              textAlignVertical="top"
            />
            <Button
              label={savingNotes ? 'Saving...' : 'Save Notes'}
              onPress={handleSaveNotes}
              variant="outline"
              size="sm"
              loading={savingNotes}
            />
          </View>
        )}

        {bottomTab === 'share' && theatreMatch && (
          <ShareClipPreview
            matchId={id!}
            exerciseType={EXERCISE_LABELS[theatreMatch.exerciseType]}
            opponentName={theatreMatch.opponentName}
            myReps={myReps}
            opponentReps={opponentReps}
          />
        )}

        {bottomTab === 'rematch' && theatreMatch && (
          <View style={styles.rematchCard}>
            <Text style={styles.rematchTitle}>Challenge Again?</Text>
            <Text style={styles.rematchBody}>
              Ready for a rematch against {theatreMatch.opponentName}?
            </Text>
            <Button
              label="Go to Home to Challenge"
              onPress={() => router.replace('/(tabs)')}
              variant="primary"
              size="md"
            />
          </View>
        )}

        {/* Dispute section */}
        {match?.status === 'disputed' && (
          <View style={styles.disputeCard}>
            <AlertTriangle size={20} color={colors.warning} />
            <Text style={styles.disputeTitle}>Dispute Filed</Text>
            <Text style={styles.disputeReason}>{match.dispute_reason}</Text>
          </View>
        )}

        {canDispute && !showDispute && match?.status !== 'disputed' && (
          <TouchableOpacity style={styles.disputeBtn} onPress={() => setShowDispute(true)}>
            <AlertTriangle size={15} color={colors.warning} />
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
              textAlignVertical="top"
            />
            <View style={styles.disputeActions}>
              <Button label="Cancel" variant="ghost" onPress={() => setShowDispute(false)} size="sm" />
              <Button label="Submit Dispute" variant="danger" onPress={handleDispute} loading={disputing} size="sm" />
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function DetailRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <View style={detailRowStyles.row}>
      {icon}
      <Text style={detailRowStyles.label}>{label}</Text>
      <Text style={detailRowStyles.value}>{value}</Text>
    </View>
  );
}

const detailRowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: { flex: 1, fontFamily: typography.fontBody, fontSize: 14, color: colors.textSecondary },
  value: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
});

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
  backBtn: { padding: spacing.xs },
  title: { fontFamily: typography.fontDisplay, fontSize: 16, color: colors.text, letterSpacing: 2 },
  maskBtn: { padding: spacing.xs },
  scroll: { paddingHorizontal: spacing.md, paddingVertical: spacing.md, gap: spacing.md },

  // VS card
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
  playerBlock: { flex: 1, alignItems: 'center', gap: 4 },
  avatarWrap: { overflow: 'hidden' },
  playerLabel: { fontFamily: typography.fontBodyBold, fontSize: 12, color: colors.textSecondary, letterSpacing: 0.5 },
  repScore: { fontFamily: typography.fontDisplay, fontSize: 36, color: colors.primary },
  repSub: { fontFamily: typography.fontBody, fontSize: 11, color: colors.textMuted },
  winBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: 'rgba(255,184,0,0.15)',
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: colors.accent,
  },
  winBadgeText: { fontFamily: typography.fontBodyBold, fontSize: 10, color: colors.accent, letterSpacing: 0.5 },
  vsBlock: { alignItems: 'center', gap: spacing.xs },
  vs: { fontFamily: typography.fontDisplay, fontSize: 16, color: colors.textMuted, letterSpacing: 2 },
  wagerBlock: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  wagerText: { fontFamily: typography.fontDisplayMedium, fontSize: 14, color: colors.accent },
  outcomePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
    borderWidth: 1,
  },
  outcomePillText: { fontFamily: typography.fontBodyBold, fontSize: 10, letterSpacing: 0.5 },

  // Video toggle
  videoToggleRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgCard,
  },
  toggleBtnActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary + '18',
  },
  toggleBtnActiveOpp: {
    borderColor: colors.secondary,
    backgroundColor: colors.secondary + '18',
  },
  toggleDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  toggleText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textMuted,
  },

  // Bottom tabs
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.sm,
    gap: 3,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  bottomTabActive: {
    backgroundColor: colors.primary + '12',
  },
  bottomTabText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 10,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },

  // Stats
  detailsCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.sm,
  },

  // Notes
  notesCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  notesLabel: { fontFamily: typography.fontBodyBold, fontSize: 14, color: colors.text },
  notesInput: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    color: colors.text,
    fontFamily: typography.fontBody,
    fontSize: 14,
    minHeight: 100,
    borderWidth: 1,
    borderColor: colors.border,
  },

  // Rematch
  rematchCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    gap: spacing.md,
  },
  rematchTitle: { fontFamily: typography.fontBodyBold, fontSize: 16, color: colors.text },
  rematchBody: { fontFamily: typography.fontBody, fontSize: 14, color: colors.textMuted, textAlign: 'center' },

  // Dispute
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
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  disputeActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
});
