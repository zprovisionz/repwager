import { View, Text, StyleSheet } from 'react-native';
import { colors, typography, spacing, radius } from '@/lib/theme';
import Avatar from '@/components/Avatar';
import type { Profile } from '@/types/database';
import { RANK_TIER_COLORS } from '@/types/database';
import { Flame, Trophy, Zap } from 'lucide-react-native';

interface ShareCardProps {
  profile: Profile;
  matchResult?: {
    myReps: number;
    opponentReps: number;
    won: boolean;
    exerciseLabel: string;
  };
}

export default function ShareCard({ profile, matchResult }: ShareCardProps) {
  const rankColor =
    (RANK_TIER_COLORS as Record<string, string>)[profile.rank_tier] ?? colors.primary;
  const winRate =
    profile.wins + profile.losses > 0
      ? Math.round((profile.wins / (profile.wins + profile.losses)) * 100)
      : 0;

  return (
    <View style={styles.card}>
      <View style={styles.bg} />

      <View style={styles.topRow}>
        <View style={styles.avatarWrap}>
          <Avatar
            gender={profile.avatar_gender}
            head={profile.avatar_head}
            torso={profile.avatar_torso}
            legs={profile.avatar_legs}
            size={80}
          />
          <View style={[styles.rankBadge, { borderColor: rankColor }]}>
            <Text style={[styles.rankText, { color: rankColor }]}>{profile.rank_tier}</Text>
          </View>
        </View>

        <View style={styles.info}>
          <Text style={styles.displayName}>{profile.display_name}</Text>
          <Text style={styles.username}>@{profile.username}</Text>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Trophy size={12} color={colors.accent} />
              <Text style={styles.statVal}>{profile.wins}W-{profile.losses}L</Text>
            </View>
            <View style={styles.stat}>
              <Flame size={12} color={colors.secondary} />
              <Text style={styles.statVal}>{profile.current_streak} streak</Text>
            </View>
            <View style={styles.stat}>
              <Zap size={12} color={colors.primary} />
              <Text style={styles.statVal}>{profile.total_reps} reps</Text>
            </View>
          </View>
        </View>
      </View>

      {matchResult && (
        <View style={[styles.result, { borderColor: matchResult.won ? colors.success : colors.error }]}>
          <Text style={[styles.resultOutcome, { color: matchResult.won ? colors.success : colors.error }]}>
            {matchResult.won ? '🏆 I WON!' : '💪 I LOST — COME GET ME'}
          </Text>
          <Text style={styles.resultScore}>
            {matchResult.myReps} vs {matchResult.opponentReps} reps — {matchResult.exerciseLabel}
          </Text>
          <Text style={styles.winRate}>{winRate}% win rate</Text>
        </View>
      )}

      <View style={styles.cta}>
        <Text style={styles.ctaText}>Beat me on RepWager</Text>
        <Text style={styles.ctaSubtext}>repwager://profile/{profile.username}</Text>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>REPWAGER</Text>
        <Text style={styles.footerTagline}>Prove it. Rep it. Win it.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 320,
    backgroundColor: colors.bgCard,
    borderRadius: radius.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
    overflow: 'hidden',
  },
  bg: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,212,255,0.06)',
  },
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  avatarWrap: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  rankBadge: {
    borderRadius: radius.full,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  rankText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    letterSpacing: 0.5,
  },
  info: {
    flex: 1,
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  displayName: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.3,
  },
  username: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
    marginTop: 2,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  statVal: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  result: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    padding: spacing.sm,
    gap: 3,
    alignItems: 'center',
  },
  resultOutcome: {
    fontFamily: typography.fontDisplayMedium,
    fontSize: 14,
    letterSpacing: 0.5,
  },
  resultScore: {
    fontFamily: typography.fontBody,
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  winRate: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
  },
  cta: {
    backgroundColor: colors.primary + '1A',
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderColor: colors.primary + '44',
  },
  ctaText: {
    fontFamily: typography.fontBodyBold,
    fontSize: 14,
    color: colors.primary,
  },
  ctaSubtext: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  footer: {
    alignItems: 'center',
    gap: 2,
    paddingTop: 2,
  },
  footerText: {
    fontFamily: typography.fontDisplay,
    fontSize: 12,
    color: colors.textMuted,
    letterSpacing: 3,
  },
  footerTagline: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
});
