/*
  League Matchmaking Screen

  Allows league admins to:
  - Search for opponent leagues
  - Filter by focus type
  - Schedule a League vs League match
  - Auto-splits into 1v1 matches when accepted
*/

import { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TextInput,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { colors, typography, spacing, radius } from '@/lib/theme';
import {
  getLeagueDetail,
  getOpponentLeagueCandidates,
  scheduleLeagueMatch,
  type League,
} from '@/services/leagueTournament.service';
import { useAuth } from '@/store/auth';
import { Search, Swords } from 'lucide-react-native';

export default function MatchmakingScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();

  const [league, setLeague] = useState<League | null>(null);
  const [candidates, setCandidates] = useState<League[]>([]);
  const [searchText, setSearchText] = useState('');
  const [selectedOpponent, setSelectedOpponent] = useState<League | null>(null);
  const [exerciseType, setExerciseType] = useState('push_ups');
  const [wagerAmount, setWagerAmount] = useState('0');
  const [loading, setLoading] = useState(true);
  const [scheduling, setScheduling] = useState(false);

  const leagueId = typeof id === 'string' ? id : '';

  useEffect(() => {
    loadData();
  }, [leagueId]);

  const loadData = async () => {
    try {
      const [leagueData, candidatesData] = await Promise.all([
        getLeagueDetail(leagueId),
        getOpponentLeagueCandidates(leagueId),
      ]);

      setLeague(leagueData);
      setCandidates(candidatesData);
    } catch (error) {
      console.error('Failed to load matchmaking data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleScheduleMatch = async () => {
    if (!user || !league || !selectedOpponent) return;

    setScheduling(true);
    try {
      const match = await scheduleLeagueMatch(user.id, leagueId, selectedOpponent.id, {
        exercise_type: exerciseType,
        wager_amount: parseFloat(wagerAmount) || 0,
      });

      if (match) {
        router.back();
      }
    } catch (error) {
      console.error('Failed to schedule match:', error);
    } finally {
      setScheduling(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Current League Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your League</Text>
          <View style={styles.leagueCard}>
            <Text style={styles.leagueCardName}>{league?.name}</Text>
            <Text style={styles.leagueCardType}>{league?.focus_type}</Text>
          </View>
        </View>

        {/* Opponent Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Select Opponent</Text>

          {!selectedOpponent ? (
            <>
              {/* Search Box */}
              <View style={styles.searchBox}>
                <Search size={20} color={colors.textSecondary} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search leagues..."
                  placeholderTextColor={colors.textSecondary}
                  value={searchText}
                  onChangeText={setSearchText}
                />
              </View>

              {/* Candidates List */}
              <FlatList
                data={candidates.filter((c) =>
                  c.name.toLowerCase().includes(searchText.toLowerCase())
                )}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.candidateCard}
                    onPress={() => setSelectedOpponent(item)}
                  >
                    <View style={styles.candidateInfo}>
                      <Text style={styles.candidateName}>{item.name}</Text>
                      <Text style={styles.candidateMeta}>
                        {item.focus_type} • {item.member_count || 0} members
                      </Text>
                    </View>
                    <Text style={styles.selectButton}>→</Text>
                  </TouchableOpacity>
                )}
                scrollEnabled={false}
              />
            </>
          ) : (
            <View style={styles.selectedOpponentCard}>
              <Text style={styles.selectedOpponentName}>{selectedOpponent.name}</Text>
              <TouchableOpacity
                style={styles.changeOpponentButton}
                onPress={() => setSelectedOpponent(null)}
              >
                <Text style={styles.changeOpponentButtonText}>Choose Different</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {selectedOpponent && (
          <>
            {/* Exercise Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Exercise</Text>
              <View style={styles.exerciseGrid}>
                {['push_ups', 'squats'].map((type) => (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.exerciseButton,
                      exerciseType === type && styles.exerciseButtonActive,
                    ]}
                    onPress={() => setExerciseType(type)}
                  >
                    <Text style={styles.exerciseButtonText}>
                      {type === 'push_ups' ? '💪 Push-Ups' : '🦵 Squats'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Wager Amount */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Wager Per Member</Text>
              <View style={styles.wagerInput}>
                <Text style={styles.wagerSymbol}>$</Text>
                <TextInput
                  style={styles.wagerField}
                  value={wagerAmount}
                  onChangeText={(val) => {
                    const num = parseFloat(val);
                    if (!isNaN(num) && num >= 0 && num <= 1000) {
                      setWagerAmount(num.toString());
                    } else if (val === '') {
                      setWagerAmount('');
                    }
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>
            </View>

            {/* Match Summary */}
            <View style={styles.matchSummary}>
              <Text style={styles.matchSummaryTitle}>Match Summary</Text>
              <View style={styles.matchSummaryRow}>
                <Text style={styles.matchSummaryLabel}>Your league</Text>
                <Text style={styles.matchSummaryValue}>{league?.name}</Text>
              </View>
              <View style={styles.matchSummaryRow}>
                <Text style={styles.matchSummaryLabel}>Opponent</Text>
                <Text style={styles.matchSummaryValue}>{selectedOpponent.name}</Text>
              </View>
              <View style={styles.matchSummaryRow}>
                <Text style={styles.matchSummaryLabel}>Exercise</Text>
                <Text style={styles.matchSummaryValue}>{exerciseType}</Text>
              </View>
              <View style={[styles.matchSummaryRow, styles.matchSummaryRowLast]}>
                <Text style={styles.matchSummaryLabel}>Wager</Text>
                <Text style={styles.matchSummaryValue}>${wagerAmount || '0'} per member</Text>
              </View>
            </View>

            {/* Schedule Button */}
            <TouchableOpacity
              style={[styles.scheduleButton, scheduling && styles.scheduleButtonDisabled]}
              onPress={handleScheduleMatch}
              disabled={scheduling}
            >
              {scheduling ? (
                <ActivityIndicator color={colors.textInverse} />
              ) : (
                <>
                  <Swords size={20} color={colors.textInverse} />
                  <Text style={styles.scheduleButtonText}>Schedule Match</Text>
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <View style={{ height: spacing.xl }} />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  sectionTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.sm,
  },
  leagueCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  leagueCardName: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  leagueCardType: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 13,
    color: colors.primary,
    marginTop: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginLeft: spacing.sm,
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.text,
  },
  candidateCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    marginBottom: spacing.sm,
  },
  candidateInfo: {
    flex: 1,
  },
  candidateName: {
    fontFamily: typography.fontDisplay,
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  candidateMeta: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  selectButton: {
    fontFamily: typography.fontDisplay,
    fontSize: 20,
    color: colors.primary,
  },
  selectedOpponentCard: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 2,
    borderColor: colors.primary,
  },
  selectedOpponentName: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.md,
  },
  changeOpponentButton: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    alignItems: 'center',
  },
  changeOpponentButtonText: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  exerciseGrid: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  exerciseButton: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
  },
  exerciseButtonActive: {
    borderColor: colors.primary,
  },
  exerciseButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  wagerInput: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  wagerSymbol: {
    fontFamily: typography.fontDisplay,
    fontSize: 18,
    color: colors.primary,
    fontWeight: '600',
  },
  wagerField: {
    flex: 1,
    paddingVertical: spacing.sm,
    marginLeft: spacing.xs,
    fontFamily: typography.fontBodyMedium,
    fontSize: 16,
    color: colors.text,
  },
  matchSummary: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  matchSummaryTitle: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: spacing.md,
  },
  matchSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  matchSummaryRowLast: {
    borderBottomWidth: 0,
  },
  matchSummaryLabel: {
    fontFamily: typography.fontBodyMedium,
    fontSize: 14,
    color: colors.textSecondary,
  },
  matchSummaryValue: {
    fontFamily: typography.fontDisplay,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  scheduleButton: {
    flexDirection: 'row',
    marginHorizontal: spacing.md,
    marginVertical: spacing.md,
    backgroundColor: colors.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  scheduleButtonDisabled: {
    opacity: 0.6,
  },
  scheduleButtonText: {
    fontFamily: typography.fontDisplay,
    fontSize: 16,
    fontWeight: '600',
    color: colors.textInverse,
  },
});
