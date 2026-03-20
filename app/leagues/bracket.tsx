import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  getLeagueMembers,
  buildPlayoffBracket,
} from '@/services/league.service';
import type { LeagueMember, BracketSlot } from '@/services/league.service';
import { ChevronLeft, Trophy } from 'lucide-react-native';

function BracketMatchup({ slot }: { slot: BracketSlot }) {
  const p1Name = slot.player1?.profiles?.display_name ?? 'TBD';
  const p2Name = slot.player2?.profiles?.display_name ?? 'TBD';
  const p1Elo = slot.player1?.league_elo ?? 0;
  const p2Elo = slot.player2?.league_elo ?? 0;
  const p1Won = slot.winnerId === slot.player1?.user_id;
  const p2Won = slot.winnerId === slot.player2?.user_id;

  return (
    <View style={styles.matchup}>
      <View style={[styles.matchupPlayer, p1Won && styles.matchupPlayerWon]}>
        <Text style={[styles.matchupName, p1Won && styles.matchupNameWon]} numberOfLines={1}>
          {p1Name}
        </Text>
        {p1Elo > 0 && <Text style={styles.matchupElo}>{p1Elo}</Text>}
        {p1Won && <Trophy size={10} color={colors.accent} />}
      </View>
      <View style={styles.matchupDivider} />
      <View style={[styles.matchupPlayer, p2Won && styles.matchupPlayerWon]}>
        <Text style={[styles.matchupName, p2Won && styles.matchupNameWon]} numberOfLines={1}>
          {p2Name}
        </Text>
        {p2Elo > 0 && <Text style={styles.matchupElo}>{p2Elo}</Text>}
        {p2Won && <Trophy size={10} color={colors.accent} />}
      </View>
    </View>
  );
}

export default function BracketScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [members, setMembers] = useState<LeagueMember[]>([]);
  const [bracket, setBracket] = useState<BracketSlot[][]>([]);

  useEffect(() => {
    if (!id) return;
    getLeagueMembers(id)
      .then((m) => {
        setMembers(m);
        setBracket(buildPlayoffBracket(m));
      })
      .catch(() => {});
  }, [id]);

  const roundNames = ['Quarterfinals', 'Semifinals', 'Final'];

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={24} color={colors.textSecondary} />
        </TouchableOpacity>
        <Text style={styles.title}>PLAYOFF BRACKET</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        horizontal
        contentContainerStyle={styles.bracketScroll}
        showsHorizontalScrollIndicator={false}
      >
        {bracket.map((round, roundIdx) => (
          <View key={roundIdx} style={styles.round}>
            <Text style={styles.roundLabel}>{roundNames[roundIdx] ?? `Round ${roundIdx + 1}`}</Text>
            <View style={styles.roundMatches}>
              {round.map((slot, slotIdx) => (
                <BracketMatchup key={slotIdx} slot={slot} />
              ))}
            </View>
          </View>
        ))}

        {bracket.length === 0 && (
          <View style={styles.empty}>
            <Trophy size={48} color={colors.textMuted} strokeWidth={1} />
            <Text style={styles.emptyTitle}>Bracket not yet seeded</Text>
            <Text style={styles.emptyText}>
              Need at least 2 members to generate the playoff bracket.
            </Text>
          </View>
        )}
      </ScrollView>

      {members.length > 0 && (
        <View style={styles.seedInfo}>
          <Text style={styles.seedLabel}>
            Top {Math.min(members.length, 8)} by League ELO
          </Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={styles.seedRow}>
              {members.slice(0, 8).map((m, i) => (
                <View key={m.id} style={styles.seedChip}>
                  <Text style={styles.seedNum}>#{i + 1}</Text>
                  <Text style={styles.seedName} numberOfLines={1}>
                    {m.profiles?.display_name ?? '???'}
                  </Text>
                  <Text style={styles.seedElo}>{m.league_elo}</Text>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      )}
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
    fontSize: 14,
    color: colors.text,
    letterSpacing: 2,
  },
  bracketScroll: {
    padding: spacing.lg,
    gap: spacing.xl,
    flexDirection: 'row',
    alignItems: 'center',
  },
  round: {
    width: 140,
    gap: spacing.md,
  },
  roundLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
  roundMatches: {
    gap: spacing.md,
  },
  matchup: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  matchupPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: spacing.xs,
  },
  matchupPlayerWon: {
    backgroundColor: 'rgba(255,184,0,0.08)',
  },
  matchupName: {
    flex: 1,
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  matchupNameWon: { color: colors.accent },
  matchupElo: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.textMuted,
  },
  matchupDivider: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.sm,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xl,
    gap: spacing.md,
  },
  emptyTitle: {
    fontFamily: typography.fontBodyBold,
    fontSize: 16,
    color: colors.textSecondary,
  },
  emptyText: {
    fontFamily: typography.fontBody,
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  seedInfo: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },
  seedLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 1,
  },
  seedRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  seedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.bgCard,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  seedNum: {
    fontFamily: typography.fontBodyBold,
    fontSize: 10,
    color: colors.textMuted,
  },
  seedName: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.text,
    maxWidth: 80,
  },
  seedElo: {
    fontFamily: typography.fontBody,
    fontSize: 10,
    color: colors.primary,
  },
});
