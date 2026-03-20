import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import { Zap, DollarSign, Clock, Trophy } from 'lucide-react-native';
import type { Match } from '@/types/database';
import { EXERCISE_LABELS } from '@/lib/config';

interface MatchCardProps {
  match: Match & { profiles?: any };
  onPress?: () => void;
  myUserId?: string;
  showChallenger?: boolean;
}

const STATUS_COLOR: Record<string, string> = {
  pending: colors.accent,
  accepted: colors.primary,
  in_progress: colors.success,
  completed: colors.textMuted,
  disputed: colors.warning,
  cancelled: colors.textMuted,
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Open',
  accepted: 'Accepted',
  in_progress: 'Live',
  completed: 'Done',
  disputed: 'Disputed',
  cancelled: 'Cancelled',
};

export default function MatchCard({ match, onPress, myUserId, showChallenger }: MatchCardProps) {
  const isMyMatch = match.challenger_id === myUserId || match.opponent_id === myUserId;
  const statusColor = STATUS_COLOR[match.status] ?? colors.textMuted;

  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} activeOpacity={0.8}>
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.topRow}>
          <View style={styles.exerciseRow}>
            <Zap size={14} color={colors.primary} />
            <Text style={styles.exercise}>{EXERCISE_LABELS[match.exercise_type]}</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: statusColor + '22', borderColor: statusColor }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{STATUS_LABEL[match.status]}</Text>
          </View>
        </View>

        <View style={styles.midRow}>
          <View style={styles.wagerBlock}>
            <DollarSign size={16} color={colors.accent} />
            <Text style={styles.wagerAmount}>{match.wager_amount.toFixed(2)}</Text>
          </View>
          {showChallenger && match.profiles && (
            <Text style={styles.challenger}>@{match.profiles.username}</Text>
          )}
          {match.status === 'completed' && match.winner_id && (
            <View style={styles.winnerRow}>
              <Trophy size={14} color={colors.accent} />
              <Text style={styles.winnerText}>
                {match.winner_id === myUserId ? 'You won!' : 'You lost'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.bottomRow}>
          <Clock size={12} color={colors.textMuted} />
          <Text style={styles.time}>{new Date(match.created_at).toLocaleDateString()}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderLeftWidth: 3,
    gap: spacing.xs,
  },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  exercise: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.text,
  },
  statusBadge: {
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderWidth: 1,
  },
  statusText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    letterSpacing: 0.5,
  },
  midRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  wagerBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  wagerAmount: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.accent,
  },
  challenger: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.textSecondary,
    flex: 1,
    textAlign: 'right',
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
  },
  winnerText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.accent,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 2,
  },
  time: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textMuted,
  },
});
